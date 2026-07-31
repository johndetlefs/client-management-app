import ExcelJS from "exceljs";

import type {
  ExpenseGstCreditStatus,
  ExpenseGstTreatment,
  ExpenseTaxInvoiceStatus,
} from "@/types/expense";

export const ACCOUNTANT_EXPORT_VERSION = "accountant-export-v1";

export interface AccountantExpenseExportRow {
  id: string;
  date: string;
  merchantName: string;
  rawDescription?: string;
  categoryName: string;
  amountMinor: number;
  currency: string;
  businessUsePercent: number;
  claimableAmountMinor: number;
  privateAmountMinor: number;
  gstTreatment: ExpenseGstTreatment;
  gstIncludedAmountMinor: number;
  gstAmountMinor: number;
  gstCreditStatus: ExpenseGstCreditStatus;
  gstRegistrationReviewRequired: boolean;
  taxInvoiceStatus: ExpenseTaxInvoiceStatus;
  isSubscription: boolean;
  isRecurring: boolean;
  notes?: string;
  sourceAccountKey?: string;
  importBatchId?: string;
  sourceFileId?: string;
  transactionFingerprint?: string;
  occurrenceIndex?: number;
}

export interface AccountantIncomeExportRow {
  id: string;
  issueDate: string;
  invoiceNumber: string;
  clientName: string;
  status: string;
  subtotalMinor: number;
  gstMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  balanceDueMinor: number;
  currency: string;
}

export interface AccountantImportSourceRow {
  id: string;
  sourceFormat: string;
  sourceAccountKey?: string;
  sourceAccountLabel?: string;
  statementStartDate?: string;
  statementEndDate?: string;
  status: string;
  totalRows: number;
  parsedRows: number;
  candidateRows: number;
  duplicateRows: number;
  failedRows: number;
  sourceFileId?: string;
}

export interface AccountantExportInput {
  periodStartDate: string;
  periodEndDate: string;
  generatedAt: string;
  expenses: AccountantExpenseExportRow[];
  income: AccountantIncomeExportRow[];
  importSources: AccountantImportSourceRow[];
}

export interface AccountantExportTotals {
  expenseCount: number;
  grossExpensesMinor: number;
  claimableExpensesMinor: number;
  privateAdjustmentMinor: number;
  potentialGstMinor: number;
  claimableGstMinor: number;
  incomeInvoiceCount: number;
  invoicedIncomeMinor: number;
  invoicedGstMinor: number;
  cumulativePaidMinor: number;
  outstandingIncomeMinor: number;
  reviewNeededCount: number;
}

export interface AccountantExportResult {
  bytes: Buffer;
  totals: AccountantExportTotals;
  reviewNeeded: AccountantReviewRow[];
}

interface AccountantReviewRow {
  entityType: "Expense" | "Income";
  date: string;
  reference: string;
  name: string;
  reason: string;
  amountMinor: number;
  currency: string;
}

const CURRENCY_FORMAT = '"$"#,##0.00;[Red]-"$"#,##0.00';
const HEADER_FILL = "FF27272A";
const HEADER_TEXT = "FFFFFFFF";
const TOTAL_FILL = "FFE4E4E7";

export async function buildAccountantWorkbook(
  input: AccountantExportInput,
): Promise<AccountantExportResult> {
  const expenses = [...input.expenses].sort(compareExpenseRows);
  const income = [...input.income].sort(compareIncomeRows);
  const importSources = [...input.importSources].sort(compareSourceRows);
  const reviewNeeded = buildReviewRows(expenses, income);
  const totals = calculateExportTotals(expenses, income, reviewNeeded.length);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Client Management App";
  workbook.created = new Date(input.generatedAt);
  workbook.modified = new Date(input.generatedAt);
  workbook.calcProperties.fullCalcOnLoad = true;

  addOverviewSheet(workbook, input, totals);
  addExpensesSheet(workbook, expenses, totals);
  addIncomeSheet(workbook, income, totals);
  addReviewSheet(workbook, reviewNeeded);
  addImportSourcesSheet(workbook, importSources);

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    bytes: Buffer.from(buffer),
    totals,
    reviewNeeded,
  };
}

export function calculateExportTotals(
  expenses: AccountantExpenseExportRow[],
  income: AccountantIncomeExportRow[],
  reviewNeededCount: number,
): AccountantExportTotals {
  return {
    expenseCount: expenses.length,
    grossExpensesMinor: sumMinor(expenses, (row) => row.amountMinor),
    claimableExpensesMinor: sumMinor(
      expenses,
      (row) => row.claimableAmountMinor,
    ),
    privateAdjustmentMinor: sumMinor(
      expenses,
      (row) => row.privateAmountMinor,
    ),
    potentialGstMinor: sumMinor(
      expenses,
      (row) => row.gstIncludedAmountMinor,
    ),
    claimableGstMinor: sumMinor(expenses, (row) => row.gstAmountMinor),
    incomeInvoiceCount: income.length,
    invoicedIncomeMinor: sumMinor(income, (row) => row.totalMinor),
    invoicedGstMinor: sumMinor(income, (row) => row.gstMinor),
    cumulativePaidMinor: sumMinor(income, (row) => row.amountPaidMinor),
    outstandingIncomeMinor: sumMinor(income, (row) => row.balanceDueMinor),
    reviewNeededCount,
  };
}

function addOverviewSheet(
  workbook: ExcelJS.Workbook,
  input: AccountantExportInput,
  totals: AccountantExportTotals,
): void {
  const sheet = workbook.addWorksheet("Overview", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Metric", key: "metric", width: 36 },
    { header: "Value", key: "value", width: 24 },
    { header: "Notes", key: "notes", width: 72 },
  ];
  styleHeader(sheet.getRow(1));

  const rows: Array<[string, string | number, string?]> = [
    ["Export version", ACCOUNTANT_EXPORT_VERSION],
    ["Period start", input.periodStartDate],
    ["Period end", input.periodEndDate],
    ["Generated at", input.generatedAt],
    ["Confirmed expense count", totals.expenseCount],
    [
      "Gross expenses",
      minorToMajor(totals.grossExpensesMinor),
      "Full purchase amount before business-use adjustment.",
    ],
    ["Claimable expenses", minorToMajor(totals.claimableExpensesMinor)],
    [
      "Private/mixed-use adjustment",
      minorToMajor(totals.privateAdjustmentMinor),
    ],
    ["Potential GST included", minorToMajor(totals.potentialGstMinor)],
    ["Currently claimable GST", minorToMajor(totals.claimableGstMinor)],
    ["Issued invoice count", totals.incomeInvoiceCount],
    ["Invoiced income", minorToMajor(totals.invoicedIncomeMinor)],
    ["Invoiced GST", minorToMajor(totals.invoicedGstMinor)],
    [
      "Cumulative amount paid",
      minorToMajor(totals.cumulativePaidMinor),
      "Existing invoices store cumulative paid amounts, not dated payment events.",
    ],
    ["Outstanding invoice balance", minorToMajor(totals.outstandingIncomeMinor)],
    ["Review-needed rows", totals.reviewNeededCount],
  ];
  rows.forEach(([metric, value, notes]) => sheet.addRow({ metric, value, notes }));
  [7, 8, 9, 10, 11, 13, 14, 15, 16].forEach((rowNumber) => {
    sheet.getCell(rowNumber, 2).numFmt = CURRENCY_FORMAT;
  });
  sheet.autoFilter = "A1:C1";
}

function addExpensesSheet(
  workbook: ExcelJS.Workbook,
  expenses: AccountantExpenseExportRow[],
  totals: AccountantExportTotals,
): void {
  const sheet = workbook.addWorksheet("Expenses", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Date", key: "date", width: 13 },
    { header: "Merchant", key: "merchant", width: 28 },
    { header: "Description", key: "description", width: 42 },
    { header: "Category", key: "category", width: 24 },
    { header: "Gross", key: "gross", width: 14 },
    { header: "Business Use %", key: "businessUse", width: 16 },
    { header: "Claimable", key: "claimable", width: 14 },
    { header: "Private Adjustment", key: "privateAdjustment", width: 18 },
    { header: "GST Treatment", key: "gstTreatment", width: 22 },
    { header: "Potential GST", key: "potentialGst", width: 14 },
    { header: "Claimable GST", key: "claimableGst", width: 14 },
    { header: "GST Credit Status", key: "gstStatus", width: 22 },
    {
      header: "GST Registration Review",
      key: "gstRegistrationReview",
      width: 24,
    },
    { header: "Tax Invoice", key: "taxInvoice", width: 18 },
    { header: "Subscription", key: "subscription", width: 13 },
    { header: "Recurring", key: "recurring", width: 11 },
    { header: "Notes", key: "notes", width: 36 },
    { header: "Source Account", key: "sourceAccount", width: 24 },
    { header: "Import Batch", key: "importBatch", width: 24 },
    { header: "Source File", key: "sourceFile", width: 24 },
    { header: "Transaction Fingerprint", key: "fingerprint", width: 32 },
    { header: "Occurrence", key: "occurrence", width: 12 },
    { header: "Expense ID", key: "expenseId", width: 28 },
  ];
  styleHeader(sheet.getRow(1));

  for (const expense of expenses) {
    sheet.addRow({
      date: expense.date,
      merchant: expense.merchantName,
      description: expense.rawDescription || "",
      category: expense.categoryName,
      gross: minorToMajor(expense.amountMinor),
      businessUse: expense.businessUsePercent / 100,
      claimable: minorToMajor(expense.claimableAmountMinor),
      privateAdjustment: minorToMajor(expense.privateAmountMinor),
      gstTreatment: expense.gstTreatment,
      potentialGst: minorToMajor(expense.gstIncludedAmountMinor),
      claimableGst: minorToMajor(expense.gstAmountMinor),
      gstStatus: expense.gstCreditStatus,
      gstRegistrationReview: expense.gstRegistrationReviewRequired
        ? "Review required"
        : "",
      taxInvoice: expense.taxInvoiceStatus,
      subscription: expense.isSubscription ? "Yes" : "No",
      recurring: expense.isRecurring ? "Yes" : "No",
      notes: expense.notes || "",
      sourceAccount: expense.sourceAccountKey || "",
      importBatch: expense.importBatchId || "",
      sourceFile: expense.sourceFileId || "",
      fingerprint: expense.transactionFingerprint || "",
      occurrence: expense.occurrenceIndex ?? "",
      expenseId: expense.id,
    });
  }

  const totalRow = sheet.addRow({
    category: "TOTAL",
    gross: minorToMajor(totals.grossExpensesMinor),
    claimable: minorToMajor(totals.claimableExpensesMinor),
    privateAdjustment: minorToMajor(totals.privateAdjustmentMinor),
    potentialGst: minorToMajor(totals.potentialGstMinor),
    claimableGst: minorToMajor(totals.claimableGstMinor),
  });
  styleTotal(totalRow);
  applyMoneyFormat(sheet, [5, 7, 8, 10, 11], 2, totalRow.number);
  applyPercentFormat(sheet, 6, 2, totalRow.number - 1);
  sheet.autoFilter = `A1:W${Math.max(1, totalRow.number - 1)}`;
}

function addIncomeSheet(
  workbook: ExcelJS.Workbook,
  income: AccountantIncomeExportRow[],
  totals: AccountantExportTotals,
): void {
  const sheet = workbook.addWorksheet("Income", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Issue Date", key: "issueDate", width: 13 },
    { header: "Invoice", key: "invoice", width: 20 },
    { header: "Client", key: "client", width: 28 },
    { header: "Status", key: "status", width: 18 },
    { header: "Subtotal", key: "subtotal", width: 14 },
    { header: "GST", key: "gst", width: 14 },
    { header: "Invoiced Total", key: "total", width: 16 },
    { header: "Cumulative Paid", key: "paid", width: 17 },
    { header: "Balance", key: "balance", width: 14 },
    { header: "Payment Timing", key: "paymentTiming", width: 42 },
    { header: "Invoice ID", key: "invoiceId", width: 28 },
  ];
  styleHeader(sheet.getRow(1));

  for (const invoice of income) {
    sheet.addRow({
      issueDate: invoice.issueDate,
      invoice: invoice.invoiceNumber,
      client: invoice.clientName,
      status: invoice.status,
      subtotal: minorToMajor(invoice.subtotalMinor),
      gst: minorToMajor(invoice.gstMinor),
      total: minorToMajor(invoice.totalMinor),
      paid: minorToMajor(invoice.amountPaidMinor),
      balance: minorToMajor(invoice.balanceDueMinor),
      paymentTiming:
        invoice.amountPaidMinor > 0
          ? "Review: cumulative paid amount has no dated payment event"
          : "",
      invoiceId: invoice.id,
    });
  }

  const totalRow = sheet.addRow({
    client: "TOTAL",
    gst: minorToMajor(totals.invoicedGstMinor),
    total: minorToMajor(totals.invoicedIncomeMinor),
    paid: minorToMajor(totals.cumulativePaidMinor),
    balance: minorToMajor(totals.outstandingIncomeMinor),
  });
  styleTotal(totalRow);
  applyMoneyFormat(sheet, [5, 6, 7, 8, 9], 2, totalRow.number);
  sheet.autoFilter = `A1:K${Math.max(1, totalRow.number - 1)}`;
}

function addReviewSheet(
  workbook: ExcelJS.Workbook,
  rows: AccountantReviewRow[],
): void {
  const sheet = workbook.addWorksheet("Review Needed", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Type", key: "type", width: 14 },
    { header: "Date", key: "date", width: 13 },
    { header: "Reference", key: "reference", width: 28 },
    { header: "Name", key: "name", width: 30 },
    { header: "Reason", key: "reason", width: 68 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
  ];
  styleHeader(sheet.getRow(1));
  rows.forEach((row) =>
    sheet.addRow({
      type: row.entityType,
      date: row.date,
      reference: row.reference,
      name: row.name,
      reason: row.reason,
      amount: minorToMajor(row.amountMinor),
      currency: row.currency,
    }),
  );
  applyMoneyFormat(sheet, [6], 2, rows.length + 1);
  sheet.autoFilter = `A1:G${Math.max(1, rows.length + 1)}`;
}

function addImportSourcesSheet(
  workbook: ExcelJS.Workbook,
  rows: AccountantImportSourceRow[],
): void {
  const sheet = workbook.addWorksheet("Import Sources", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Import Batch", key: "id", width: 28 },
    { header: "Format", key: "format", width: 10 },
    { header: "Source Account", key: "account", width: 24 },
    { header: "Account Label", key: "label", width: 24 },
    { header: "Statement Start", key: "start", width: 15 },
    { header: "Statement End", key: "end", width: 15 },
    { header: "Status", key: "status", width: 20 },
    { header: "Total Rows", key: "total", width: 12 },
    { header: "Parsed Rows", key: "parsed", width: 12 },
    { header: "Candidate Rows", key: "candidates", width: 15 },
    { header: "Duplicate Rows", key: "duplicates", width: 15 },
    { header: "Failed Rows", key: "failed", width: 12 },
    { header: "Source File", key: "sourceFile", width: 28 },
  ];
  styleHeader(sheet.getRow(1));
  rows.forEach((row) =>
    sheet.addRow({
      id: row.id,
      format: row.sourceFormat,
      account: row.sourceAccountKey || "",
      label: row.sourceAccountLabel || "",
      start: row.statementStartDate || "",
      end: row.statementEndDate || "",
      status: row.status,
      total: row.totalRows,
      parsed: row.parsedRows,
      candidates: row.candidateRows,
      duplicates: row.duplicateRows,
      failed: row.failedRows,
      sourceFile: row.sourceFileId || "",
    }),
  );
  sheet.autoFilter = `A1:M${Math.max(1, rows.length + 1)}`;
}

function buildReviewRows(
  expenses: AccountantExpenseExportRow[],
  income: AccountantIncomeExportRow[],
): AccountantReviewRow[] {
  const rows: AccountantReviewRow[] = [];
  for (const expense of expenses) {
    const reasons = expenseReviewReasons(expense);
    if (reasons.length > 0) {
      rows.push({
        entityType: "Expense",
        date: expense.date,
        reference: expense.id,
        name: expense.merchantName,
        reason: reasons.join("; "),
        amountMinor: expense.amountMinor,
        currency: expense.currency,
      });
    }
  }
  for (const invoice of income) {
    if (invoice.amountPaidMinor > 0) {
      rows.push({
        entityType: "Income",
        date: invoice.issueDate,
        reference: invoice.invoiceNumber,
        name: invoice.clientName,
        reason:
          "Cumulative paid amount has no dated payment event; do not use it for cash-basis period attribution.",
        amountMinor: invoice.amountPaidMinor,
        currency: invoice.currency,
      });
    }
  }
  return rows.sort(compareReviewRows);
}

function expenseReviewReasons(row: AccountantExpenseExportRow): string[] {
  const reasons: string[] = [];
  if (
    row.taxInvoiceStatus === "missing" ||
    row.taxInvoiceStatus === "review_required"
  ) {
    reasons.push(`Tax invoice ${row.taxInvoiceStatus.replaceAll("_", " ")}`);
  }
  if (
    row.gstTreatment === "review_required" ||
    row.gstCreditStatus === "review_required" ||
    row.gstCreditStatus === "evidence_missing"
  ) {
    reasons.push(`GST ${row.gstCreditStatus.replaceAll("_", " ")}`);
  }
  if (row.gstRegistrationReviewRequired) {
    reasons.push("GST registration settings changed since calculation");
  }
  if (!row.categoryName || row.categoryName === "Accountant review") {
    reasons.push("Category requires accountant review");
  }
  return reasons;
}

function compareExpenseRows(
  left: AccountantExpenseExportRow,
  right: AccountantExpenseExportRow,
): number {
  return (
    left.date.localeCompare(right.date) ||
    left.merchantName.localeCompare(right.merchantName) ||
    left.id.localeCompare(right.id)
  );
}

function compareIncomeRows(
  left: AccountantIncomeExportRow,
  right: AccountantIncomeExportRow,
): number {
  return (
    left.issueDate.localeCompare(right.issueDate) ||
    left.invoiceNumber.localeCompare(right.invoiceNumber) ||
    left.id.localeCompare(right.id)
  );
}

function compareSourceRows(
  left: AccountantImportSourceRow,
  right: AccountantImportSourceRow,
): number {
  return (
    (left.statementStartDate || "").localeCompare(
      right.statementStartDate || "",
    ) || left.id.localeCompare(right.id)
  );
}

function compareReviewRows(
  left: AccountantReviewRow,
  right: AccountantReviewRow,
): number {
  return (
    left.date.localeCompare(right.date) ||
    left.entityType.localeCompare(right.entityType) ||
    left.reference.localeCompare(right.reference)
  );
}

function sumMinor<T>(rows: T[], select: (row: T) => number): number {
  return rows.reduce((sum, row) => {
    const value = select(row);
    if (!Number.isSafeInteger(value)) {
      throw new Error("Export source contains a non-safe minor-unit value");
    }
    const next = sum + value;
    if (!Number.isSafeInteger(next)) {
      throw new Error("Export total exceeds safe integer range");
    }
    return next;
  }, 0);
}

function minorToMajor(value: number): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Currency value must be a safe minor-unit integer");
  }
  return value / 100;
}

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: HEADER_TEXT } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEADER_FILL },
  };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

function styleTotal(row: ExcelJS.Row): void {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: TOTAL_FILL },
  };
}

function applyMoneyFormat(
  sheet: ExcelJS.Worksheet,
  columns: number[],
  firstRow: number,
  lastRow: number,
): void {
  for (const column of columns) {
    for (let row = firstRow; row <= lastRow; row += 1) {
      sheet.getCell(row, column).numFmt = CURRENCY_FORMAT;
    }
  }
}

function applyPercentFormat(
  sheet: ExcelJS.Worksheet,
  column: number,
  firstRow: number,
  lastRow: number,
): void {
  for (let row = firstRow; row <= lastRow; row += 1) {
    sheet.getCell(row, column).numFmt = "0%";
  }
}
