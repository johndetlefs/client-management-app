import { Timestamp } from "firebase-admin/firestore";
import { periodBounds, sydneyDate } from "@/lib/finance/period";

import {
  buildAccountantWorkbook,
  type AccountantExpenseExportRow,
  type AccountantExportResult,
  type AccountantImportSourceRow,
  type AccountantIncomeExportRow,
} from "@/lib/expenses/accountant-export";
import {
  expenseRegistrationSnapshotMatches,
  normalizeGstRegistration,
} from "@/lib/expenses/calculations";
import {
  assertExpenseTenantAccess,
  tenantExpenseCollectionRefs,
} from "@/lib/expenses/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type {
  Expense,
  ExpenseCategory,
  ExpenseImportBatch,
  FirestoreTimestampLike,
} from "@/types/expense";
import type { Invoice } from "@/types/invoice";
import type {
  GstRegistrationSettings,
  TenantSettings,
} from "@/types/tenant";

export interface GenerateAccountantExportInput {
  tenantId: string;
  idToken: string;
  periodStartDate: string;
  periodEndDate: string;
  generatedAt?: string;
}

export async function generateTenantAccountantExport(
  input: GenerateAccountantExportInput,
): Promise<AccountantExportResult> {
  validateExportPeriod(input.periodStartDate, input.periodEndDate);
  await assertExpenseTenantAccess(input.tenantId, input.idToken);

  const refs = tenantExpenseCollectionRefs(input.tenantId);
  const bounds = periodBounds({ start: input.periodStartDate, end: input.periodEndDate, label: "Accountant export" });
  const startTimestamp = Timestamp.fromDate(bounds.start);
  const endTimestamp = Timestamp.fromDate(bounds.endExclusive);

  const [expenseSnapshot, categorySnapshot, invoiceSnapshot, settingsSnapshot] =
    await Promise.all([
      refs.expenses
        .where("date", ">=", input.periodStartDate)
        .where("date", "<=", input.periodEndDate)
        .orderBy("date", "asc")
        .get(),
      refs.categories.get(),
      adminDb
        .collection(`tenants/${input.tenantId}/invoices`)
        .where("issueDate", ">=", startTimestamp)
        .where("issueDate", "<", endTimestamp)
        .orderBy("issueDate", "asc")
        .get(),
      adminDb.doc(`tenants/${input.tenantId}/settings/business`).get(),
    ]);
  const settings = settingsSnapshot.data() as TenantSettings | undefined;
  const gstRegistration = normalizeGstRegistration(
    settings?.tax?.gstRegistration,
  );

  const categoryNames = new Map(
    categorySnapshot.docs.map((doc) => [
      doc.id,
      (doc.data() as ExpenseCategory).name,
    ]),
  );
  const expenses = expenseSnapshot.docs.map((doc) =>
    toExpenseExportRow(
      { ...doc.data(), id: doc.id } as Expense,
      categoryNames,
      gstRegistration,
    ),
  );
  const income = invoiceSnapshot.docs
    .map((doc) => ({ ...doc.data(), id: doc.id }) as Invoice)
    .filter(
      (invoice) =>
        invoice.status !== "draft" &&
        invoice.status !== "void" &&
        Boolean(invoice.issueDate),
    )
    .map(toIncomeExportRow);

  const importBatchIds = [
    ...new Set(
      expenses
        .map((expense) => expense.importBatchId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const importSources = await loadImportSources(
    input.tenantId,
    importBatchIds,
  );

  return buildAccountantWorkbook({
    periodStartDate: input.periodStartDate,
    periodEndDate: input.periodEndDate,
    generatedAt: input.generatedAt || new Date().toISOString(),
    expenses,
    income,
    importSources,
  });
}

function toExpenseExportRow(
  expense: Expense,
  categoryNames: Map<string, string>,
  gstRegistration: GstRegistrationSettings,
): AccountantExpenseExportRow {
  assertMinorUnits(
    expense.amountMinor,
    expense.claimableAmountMinor,
    expense.gstIncludedAmountMinor,
    expense.gstAmountMinor,
  );
  const privateAmountMinor =
    expense.amountMinor - expense.claimableAmountMinor;
  if (!Number.isSafeInteger(privateAmountMinor) || privateAmountMinor < 0) {
    throw new Error(`Expense ${expense.id} has invalid claimable amounts`);
  }
  const registrationSnapshotMatches =
    expense.gstRegistrationStatusAtCalculation !== undefined &&
    expenseRegistrationSnapshotMatches(expense, gstRegistration);

  return {
    id: expense.id,
    date: expense.date,
    merchantName: expense.merchantName,
    rawDescription: expense.rawDescription,
    categoryName:
      (expense.categoryId && categoryNames.get(expense.categoryId)) ||
      "Accountant review",
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    businessUsePercent: expense.businessUsePercent,
    claimableAmountMinor: expense.claimableAmountMinor,
    privateAmountMinor,
    gstTreatment: expense.gstTreatment,
    gstIncludedAmountMinor: expense.gstIncludedAmountMinor,
    gstAmountMinor: expense.gstAmountMinor,
    gstCreditStatus: expense.gstCreditStatus,
    gstRegistrationReviewRequired:
      expense.gstRegistrationReviewRequired === true ||
      !registrationSnapshotMatches,
    taxInvoiceStatus: expense.taxInvoiceStatus,
    isSubscription: expense.isSubscription,
    isRecurring: expense.isRecurring,
    notes: expense.notes,
    sourceAccountKey: expense.sourceAccountKey,
    importBatchId: expense.importBatchId,
    sourceFileId: expense.sourceFileId,
    transactionFingerprint: expense.transactionFingerprint,
    occurrenceIndex: expense.occurrenceIndex,
  };
}

function toIncomeExportRow(invoice: Invoice): AccountantIncomeExportRow {
  assertMinorUnits(
    invoice.subtotalMinor,
    invoice.taxMinor,
    invoice.totalMinor,
    invoice.amountPaidMinor,
    invoice.balanceDueMinor,
  );
  const issueDate = toIsoDate(invoice.issueDate);
  if (!issueDate) {
    throw new Error(`Invoice ${invoice.id} has no valid issue date`);
  }
  return {
    id: invoice.id,
    issueDate,
    invoiceNumber:
      invoice.invoiceDisplayNumber || invoice.invoiceNumber || invoice.id,
    clientName: invoice.clientName,
    status: invoice.status,
    subtotalMinor: invoice.subtotalMinor,
    gstMinor: invoice.taxMinor,
    totalMinor: invoice.totalMinor,
    amountPaidMinor: invoice.amountPaidMinor,
    balanceDueMinor: invoice.balanceDueMinor,
    currency: "AUD",
  };
}

async function loadImportSources(
  tenantId: string,
  importBatchIds: string[],
): Promise<AccountantImportSourceRow[]> {
  if (importBatchIds.length === 0) {
    return [];
  }
  const refs = tenantExpenseCollectionRefs(tenantId);
  const snapshots = await adminDb.getAll(
    ...importBatchIds.map((id) => refs.importBatches.doc(id)),
  );
  return snapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => {
      const batch = snapshot.data() as ExpenseImportBatch;
      return {
        id: snapshot.id,
        sourceFormat: batch.sourceFormat,
        sourceAccountKey: batch.sourceAccountKey,
        sourceAccountLabel: batch.sourceAccountLabel,
        statementStartDate: batch.statementStartDate,
        statementEndDate: batch.statementEndDate,
        status: batch.status,
        totalRows: batch.counts.totalRows,
        parsedRows: batch.counts.parsedRows,
        candidateRows: batch.counts.candidateRows,
        duplicateRows: batch.counts.duplicateRows,
        failedRows: batch.counts.failedRows,
        sourceFileId: batch.sourceFileId,
      };
    });
}

function validateExportPeriod(start: string, end: string): void {
  if (!isIsoDate(start) || !isIsoDate(end)) {
    throw new Error("Export dates must use YYYY-MM-DD");
  }
  if (start > end) {
    throw new Error("Export start date must be on or before end date");
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toIsoDate(value: FirestoreTimestampLike | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return sydneyDate(value);
  }
  if ("toDate" in value) {
    return sydneyDate(value.toDate());
  }
  if ("seconds" in value) {
    return sydneyDate(new Date(value.seconds * 1000));
  }
  return null;
}

function assertMinorUnits(...values: number[]): void {
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("Export source contains invalid minor-unit values");
  }
}
