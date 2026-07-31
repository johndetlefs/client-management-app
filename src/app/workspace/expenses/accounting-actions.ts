"use server";

import { FieldValue } from "firebase-admin/firestore";
import type { WithFieldValue } from "firebase-admin/firestore";

import {
  calculateExpenseAmounts,
  expenseRegistrationSnapshotMatches,
  normalizeGstRegistration,
} from "@/lib/expenses/calculations";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expenses/categories";
import {
  assertExpenseTenantAccess,
  expenseCandidateRef,
  expenseCategoryRef,
  expenseMerchantRuleRef,
  expenseRef,
  tenantExpenseCollectionRefs,
} from "@/lib/expenses/firestore";
import {
  createMerchantRuleId,
  normalizeMerchantRuleKey,
} from "@/lib/expenses/merchant-rules";
import { adminDb } from "@/lib/firebase-admin";
import type {
  Expense,
  ExpenseCandidate,
  ExpenseCategory,
  ExpenseGstCreditStatus,
  ExpenseGstTreatment,
  ExpenseMerchantRule,
  ExpenseTaxInvoiceStatus,
  FirestoreTimestampLike,
} from "@/types/expense";
import type { GstRegistrationSettings, TenantSettings } from "@/types/tenant";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  sortOrder: number;
}

export interface ExpenseAccountingContext {
  gstRegistration: GstRegistrationSettings;
  canManageSettings: boolean;
  categories: ExpenseCategoryRow[];
  merchantRules: MerchantRuleRow[];
}

export interface MerchantRuleRow {
  id: string;
  name: string;
  normalizedMerchantKey: string;
  categoryId?: string;
  categoryName: string;
  gstTreatment?: ExpenseGstTreatment;
  businessUsePercent?: number;
  isSubscription?: boolean;
  isRecurring?: boolean;
  confidence: number;
  active: boolean;
  createdFromExpenseId?: string;
  updatedAt?: string;
}

export interface ConfirmExpenseInput {
  candidateId: string;
  businessUsePercent: number;
  categoryId: string;
  gstTreatment: ExpenseGstTreatment;
  taxInvoiceStatus: ExpenseTaxInvoiceStatus;
  isSubscription: boolean;
  isRecurring: boolean;
  notes?: string;
}

export interface UpdateExpenseInput {
  expenseId: string;
  businessUsePercent: number;
  categoryId: string;
  gstTreatment: ExpenseGstTreatment;
  taxInvoiceStatus: ExpenseTaxInvoiceStatus;
  isSubscription: boolean;
  isRecurring: boolean;
  notes?: string;
}

export interface ConfirmedExpenseRow {
  id: string;
  candidateId?: string;
  importBatchId?: string;
  sourceAccountKey?: string;
  date: string;
  merchantName: string;
  rawDescription?: string;
  amountMinor: number;
  currency: string;
  businessUsePercent: number;
  claimableAmountMinor: number;
  categoryId: string;
  categoryName: string;
  gstTreatment: ExpenseGstTreatment;
  gstIncludedAmountMinor: number;
  gstAmountMinor: number;
  gstCreditStatus: ExpenseGstCreditStatus;
  gstRegistrationReviewRequired: boolean;
  taxInvoiceStatus: ExpenseTaxInvoiceStatus;
  receiptFileId?: string;
  isSubscription: boolean;
  isRecurring: boolean;
  notes?: string;
  merchantRuleId?: string;
  reviewStatus: Expense["reviewStatus"];
  createdAt?: string;
  updatedAt?: string;
}

class ExpenseAccountingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpenseAccountingError";
  }
}

export async function getExpenseAccountingContext(
  tenantId: string,
  idToken: string,
): Promise<ActionResult<ExpenseAccountingContext>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    await ensureDefaultExpenseCategories(tenantId, access.userId);
    const [settings, categories, merchantRules] = await Promise.all([
      getBusinessSettings(tenantId),
      getCategoryRows(tenantId),
      getMerchantRuleRows(tenantId),
    ]);

    return {
      success: true,
      data: {
        gstRegistration: normalizeGstRegistration(
          settings?.tax?.gstRegistration,
        ),
        canManageSettings: access.role === "owner",
        categories,
        merchantRules: merchantRules.map((rule) =>
          toMerchantRuleRow(rule, categories),
        ),
      },
    };
  } catch (error) {
    return accountingFailure(error, "Failed to load expense accounting settings");
  }
}

export async function saveMerchantRuleFromExpense(
  tenantId: string,
  idToken: string,
  expenseId: string,
): Promise<ActionResult<MerchantRuleRow>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    const confirmedExpenseDoc = expenseRef(tenantId, expenseId);
    let savedRuleId = "";

    await adminDb.runTransaction(async (transaction) => {
      const expenseSnap = await transaction.get(confirmedExpenseDoc);
      if (!expenseSnap.exists) {
        throw new ExpenseAccountingError("Confirmed expense not found");
      }

      const expense = expenseSnap.data() as Expense;
      const normalizedMerchantKey = normalizeMerchantRuleKey(
        expense.normalizedMerchantName || expense.merchantName,
      );
      if (!normalizedMerchantKey || !expense.categoryId) {
        throw new ExpenseAccountingError(
          "Confirmed expense requires a merchant and category",
        );
      }

      savedRuleId = createMerchantRuleId(normalizedMerchantKey);
      const ruleDoc = expenseMerchantRuleRef(tenantId, savedRuleId);
      const existingRuleSnap = await transaction.get(ruleDoc);
      const existingRule = existingRuleSnap.data() as
        | ExpenseMerchantRule
        | undefined;
      const now = FieldValue.serverTimestamp();
      const ruleData = omitUndefined({
        id: savedRuleId,
        tenantId,
        name: expense.merchantName,
        matchKind: "normalized",
        pattern: normalizedMerchantKey,
        normalizedMerchantKey,
        categoryId: expense.categoryId,
        gstTreatment: normalizeGstTreatment(expense.gstTreatment),
        businessUsePercent: expense.businessUsePercent,
        isSubscription: expense.isSubscription,
        isRecurring: expense.isRecurring,
        confidence: 1,
        active: true,
        source: "user",
        createdFromExpenseId: expense.id,
        lastAppliedAt: existingRule?.lastAppliedAt,
        createdAt: existingRule?.createdAt ?? now,
        updatedAt: now,
        createdBy: existingRule?.createdBy ?? access.userId,
        updatedBy: access.userId,
      }) as WithFieldValue<ExpenseMerchantRule>;

      transaction.set(ruleDoc, ruleData, { merge: true });
      transaction.update(confirmedExpenseDoc, {
        merchantRuleId: savedRuleId,
        updatedAt: now,
        updatedBy: access.userId,
      });
    });

    const [savedRuleSnap, categories] = await Promise.all([
      expenseMerchantRuleRef(tenantId, savedRuleId).get(),
      getCategoryRows(tenantId),
    ]);
    return {
      success: true,
      data: toMerchantRuleRow(
        {
          ...savedRuleSnap.data(),
          id: savedRuleSnap.id,
        } as ExpenseMerchantRule,
        categories,
      ),
    };
  } catch (error) {
    return accountingFailure(error, "Failed to save merchant rule");
  }
}

export async function setMerchantRuleActive(
  tenantId: string,
  idToken: string,
  merchantRuleId: string,
  active: boolean,
): Promise<ActionResult<MerchantRuleRow>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    const ruleDoc = expenseMerchantRuleRef(tenantId, merchantRuleId);
    const ruleSnap = await ruleDoc.get();
    if (!ruleSnap.exists) {
      throw new ExpenseAccountingError("Merchant rule not found");
    }

    await ruleDoc.update({
      active,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: access.userId,
    });

    const [updatedRuleSnap, categories] = await Promise.all([
      ruleDoc.get(),
      getCategoryRows(tenantId),
    ]);
    return {
      success: true,
      data: toMerchantRuleRow(
        {
          ...updatedRuleSnap.data(),
          id: updatedRuleSnap.id,
        } as ExpenseMerchantRule,
        categories,
      ),
    };
  } catch (error) {
    return accountingFailure(error, "Failed to update merchant rule");
  }
}

export async function updateExpenseGstRegistration(
  tenantId: string,
  idToken: string,
  registration: GstRegistrationSettings,
): Promise<ActionResult<GstRegistrationSettings>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    if (access.role !== "owner") {
      throw new ExpenseAccountingError(
        "Only owners can update GST registration",
      );
    }

    const normalized = normalizeGstRegistration(registration);
    await adminDb.doc(`tenants/${tenantId}/settings/business`).set(
      {
        tax: {
          gstRegistration: normalized,
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: access.userId,
      },
      { merge: true },
    );

    return { success: true, data: normalized };
  } catch (error) {
    return accountingFailure(error, "Failed to update GST registration");
  }
}

export async function saveExpenseCategory(
  tenantId: string,
  idToken: string,
  input: {
    id?: string;
    name: string;
    active?: boolean;
  },
): Promise<ActionResult<ExpenseCategoryRow>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    const name = normalizeCategoryName(input.name);
    const refs = tenantExpenseCollectionRefs(tenantId);
    const categoryRef = input.id
      ? expenseCategoryRef(tenantId, input.id)
      : refs.categories.doc();
    const existing = await categoryRef.get();
    const now = FieldValue.serverTimestamp();

    if (existing.exists) {
      await categoryRef.update({
        name,
        active: input.active ?? existing.get("active") ?? true,
        updatedAt: now,
        updatedBy: access.userId,
      });
    } else {
      const lastCategory = await refs.categories
        .orderBy("sortOrder", "desc")
        .limit(1)
        .get();
      const sortOrder =
        (lastCategory.docs[0]?.get("sortOrder") as number | undefined) ?? 0;
      const category: WithFieldValue<ExpenseCategory> = {
        id: categoryRef.id,
        tenantId,
        name,
        active: input.active ?? true,
        sortOrder: sortOrder + 10,
        createdAt: now,
        updatedAt: now,
        createdBy: access.userId,
        updatedBy: access.userId,
      };
      await categoryRef.set(category);
    }

    const saved = await categoryRef.get();
    return {
      success: true,
      data: toCategoryRow({
        ...(saved.data() as ExpenseCategory),
        id: saved.id,
      }),
    };
  } catch (error) {
    return accountingFailure(error, "Failed to save expense category");
  }
}

export async function confirmExpenseCandidate(
  tenantId: string,
  idToken: string,
  input: ConfirmExpenseInput,
): Promise<ActionResult<ConfirmedExpenseRow>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    validateAccountingInput(input);
    const candidateDoc = expenseCandidateRef(tenantId, input.candidateId);
    const confirmedExpenseDoc = expenseRef(tenantId, input.candidateId);
    const categoryDoc = expenseCategoryRef(tenantId, input.categoryId);
    const settingsDoc = adminDb.doc(`tenants/${tenantId}/settings/business`);

    await adminDb.runTransaction(async (transaction) => {
      const [candidateSnap, expenseSnap, categorySnap, settingsSnap] =
        await Promise.all([
          transaction.get(candidateDoc),
          transaction.get(confirmedExpenseDoc),
          transaction.get(categoryDoc),
          transaction.get(settingsDoc),
        ]);

      if (!candidateSnap.exists) {
        throw new ExpenseAccountingError("Expense candidate not found");
      }
      if (expenseSnap.exists) {
        throw new ExpenseAccountingError("Expense candidate is already confirmed");
      }
      if (!categorySnap.exists || categorySnap.get("active") !== true) {
        throw new ExpenseAccountingError("Select an active expense category");
      }

      const candidate = candidateSnap.data() as ExpenseCandidate;
      if (
        candidate.reviewStatus !== "business" &&
        candidate.reviewStatus !== "mixed_use"
      ) {
        throw new ExpenseAccountingError(
          "Only Business or Mixed use candidates can be confirmed",
        );
      }
      if (candidate.direction !== "debit") {
        throw new ExpenseAccountingError(
          "Only outgoing transactions can be confirmed as expenses",
        );
      }

      const businessUsePercent =
        candidate.reviewStatus === "business"
          ? 100
          : input.businessUsePercent;
      if (
        candidate.reviewStatus === "mixed_use" &&
        (businessUsePercent < 1 || businessUsePercent > 99)
      ) {
        throw new ExpenseAccountingError(
          "Mixed use expenses require a percentage from 1 to 99",
        );
      }

      const settings = settingsSnap.data() as TenantSettings | undefined;
      const calculation = calculateExpenseAmounts({
        amountMinor: candidate.amountMinor,
        businessUsePercent,
        expenseDate: candidate.postedDate,
        gstTreatment: input.gstTreatment,
        taxInvoiceStatus: input.taxInvoiceStatus,
        gstRegistration: settings?.tax?.gstRegistration,
      });
      const now = FieldValue.serverTimestamp();
      const expenseData = omitUndefined({
        id: confirmedExpenseDoc.id,
        tenantId,
        candidateId: candidate.id || candidateSnap.id,
        importBatchId: candidate.importBatchId,
        sourceFileId: candidate.sourceFileId,
        sourceFormat: candidate.sourceFormat,
        sourceAccountKey: candidate.sourceAccountKey,
        sourceTransactionId: candidate.sourceTransactionId,
        transactionFingerprint: candidate.transactionFingerprint,
        occurrenceIndex: candidate.occurrenceIndex,
        sourceReviewStatus: candidate.reviewStatus,
        date: candidate.postedDate,
        merchantName: candidate.normalizedMerchantName,
        normalizedMerchantName: candidate.normalizedMerchantName,
        rawDescription: candidate.rawDescription,
        amountMinor: candidate.amountMinor,
        currency: candidate.currency,
        businessUsePercent,
        claimableAmountMinor: calculation.claimableAmountMinor,
        categoryId: input.categoryId,
        gstTreatment: normalizeGstTreatment(input.gstTreatment),
        gstIncludedAmountMinor: calculation.gstIncludedAmountMinor,
        gstAmountMinor: calculation.gstAmountMinor,
        gstCreditStatus: calculation.gstCreditStatus,
        gstRegistrationStatusAtCalculation:
          calculation.gstRegistrationStatusAtCalculation,
        gstRegistrationEffectiveFromAtCalculation:
          calculation.gstRegistrationEffectiveFromAtCalculation,
        gstRegistrationEffectiveToAtCalculation:
          calculation.gstRegistrationEffectiveToAtCalculation,
        gstRegistrationReviewRequired: false,
        calculationVersion: calculation.calculationVersion,
        taxInvoiceStatus: input.taxInvoiceStatus,
        isSubscription: input.isSubscription,
        isRecurring: input.isRecurring,
        notes: normalizeNotes(input.notes),
        reviewStatus: calculation.reviewRequired ? "needs_review" : "reviewed",
        reviewedAt: now,
        reviewedBy: access.userId,
        createdAt: now,
        updatedAt: now,
        createdBy: access.userId,
        updatedBy: access.userId,
      }) as WithFieldValue<Expense>;

      transaction.create(confirmedExpenseDoc, expenseData);
      transaction.update(candidateDoc, {
        reviewStatus: "confirmed",
        existingExpenseId: confirmedExpenseDoc.id,
        retentionExpiresAt: FieldValue.delete(),
        minimizedAt: FieldValue.delete(),
        minimizedBy: FieldValue.delete(),
        reviewedAt: now,
        reviewedBy: access.userId,
        updatedAt: now,
        updatedBy: access.userId,
      });
    });

    const [expenseSnap, context] = await Promise.all([
      confirmedExpenseDoc.get(),
      loadExpenseDisplayContext(tenantId),
    ]);
    return {
      success: true,
      data: toConfirmedExpenseRow(
        expenseSnap.data() as Expense,
        context.categories,
        context.registration,
      ),
    };
  } catch (error) {
    return accountingFailure(error, "Failed to confirm expense");
  }
}

export async function getConfirmedExpenses(
  tenantId: string,
  idToken: string,
): Promise<ActionResult<ConfirmedExpenseRow[]>> {
  try {
    await assertExpenseTenantAccess(tenantId, idToken);
    const refs = tenantExpenseCollectionRefs(tenantId);
    const [snapshot, context] = await Promise.all([
      refs.expenses.orderBy("date", "desc").get(),
      loadExpenseDisplayContext(tenantId),
    ]);

    return {
      success: true,
      data: snapshot.docs.map((doc) =>
        toConfirmedExpenseRow(
          { ...doc.data(), id: doc.id },
          context.categories,
          context.registration,
        ),
      ),
    };
  } catch (error) {
    return accountingFailure(error, "Failed to load confirmed expenses");
  }
}

export async function updateConfirmedExpense(
  tenantId: string,
  idToken: string,
  input: UpdateExpenseInput,
): Promise<ActionResult<ConfirmedExpenseRow>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    validateAccountingInput(input);
    const confirmedExpenseDoc = expenseRef(tenantId, input.expenseId);
    const categoryDoc = expenseCategoryRef(tenantId, input.categoryId);
    const settingsDoc = adminDb.doc(`tenants/${tenantId}/settings/business`);

    await adminDb.runTransaction(async (transaction) => {
      const [expenseSnap, categorySnap, settingsSnap] = await Promise.all([
        transaction.get(confirmedExpenseDoc),
        transaction.get(categoryDoc),
        transaction.get(settingsDoc),
      ]);
      if (!expenseSnap.exists) {
        throw new ExpenseAccountingError("Confirmed expense not found");
      }

      const expense = expenseSnap.data() as Expense;
      if (
        !categorySnap.exists ||
        (categorySnap.get("active") !== true &&
          input.categoryId !== expense.categoryId)
      ) {
        throw new ExpenseAccountingError("Select an active expense category");
      }

      const settings = settingsSnap.data() as TenantSettings | undefined;
      const calculation = calculateExpenseAmounts({
        amountMinor: expense.amountMinor,
        businessUsePercent: input.businessUsePercent,
        expenseDate: expense.date,
        gstTreatment: input.gstTreatment,
        taxInvoiceStatus: input.taxInvoiceStatus,
        gstRegistration: settings?.tax?.gstRegistration,
      });
      const now = FieldValue.serverTimestamp();
      transaction.update(
        confirmedExpenseDoc,
        omitUndefined({
          businessUsePercent: input.businessUsePercent,
          claimableAmountMinor: calculation.claimableAmountMinor,
          categoryId: input.categoryId,
          gstTreatment: normalizeGstTreatment(input.gstTreatment),
          gstIncludedAmountMinor: calculation.gstIncludedAmountMinor,
          gstAmountMinor: calculation.gstAmountMinor,
          gstCreditStatus: calculation.gstCreditStatus,
          gstRegistrationStatusAtCalculation:
            calculation.gstRegistrationStatusAtCalculation,
          gstRegistrationEffectiveFromAtCalculation:
            calculation.gstRegistrationEffectiveFromAtCalculation,
          gstRegistrationEffectiveToAtCalculation:
            calculation.gstRegistrationEffectiveToAtCalculation,
          gstRegistrationReviewRequired: false,
          calculationVersion: calculation.calculationVersion,
          taxInvoiceStatus: input.taxInvoiceStatus,
          isSubscription: input.isSubscription,
          isRecurring: input.isRecurring,
          notes: normalizeNotes(input.notes),
          reviewStatus: calculation.reviewRequired
            ? "needs_review"
            : "reviewed",
          reviewedAt: now,
          reviewedBy: access.userId,
          updatedAt: now,
          updatedBy: access.userId,
        }),
      );
    });

    const [expenseSnap, context] = await Promise.all([
      confirmedExpenseDoc.get(),
      loadExpenseDisplayContext(tenantId),
    ]);
    return {
      success: true,
      data: toConfirmedExpenseRow(
        expenseSnap.data() as Expense,
        context.categories,
        context.registration,
      ),
    };
  } catch (error) {
    return accountingFailure(error, "Failed to update expense");
  }
}

async function ensureDefaultExpenseCategories(
  tenantId: string,
  userId: string,
): Promise<void> {
  const refs = tenantExpenseCollectionRefs(tenantId);
  const existing = await refs.categories.limit(1).get();
  if (!existing.empty) {
    return;
  }

  const now = FieldValue.serverTimestamp();
  const batch = adminDb.batch();
  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    batch.set(refs.categories.doc(category.id), {
      ...category,
      tenantId,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    } satisfies WithFieldValue<ExpenseCategory>);
  }
  await batch.commit();
}

async function getCategoryRows(tenantId: string): Promise<ExpenseCategoryRow[]> {
  const snapshot = await tenantExpenseCollectionRefs(tenantId)
    .categories.orderBy("sortOrder", "asc")
    .get();
  return snapshot.docs.map((doc) =>
    toCategoryRow({ ...doc.data(), id: doc.id }),
  );
}

async function getMerchantRuleRows(
  tenantId: string,
): Promise<ExpenseMerchantRule[]> {
  const snapshot = await tenantExpenseCollectionRefs(tenantId)
    .merchantRules.orderBy("normalizedMerchantKey", "asc")
    .get();
  return snapshot.docs.map(
    (doc) =>
      ({
        ...doc.data(),
        id: doc.id,
      }) as ExpenseMerchantRule,
  );
}

async function getBusinessSettings(
  tenantId: string,
): Promise<TenantSettings | undefined> {
  const snapshot = await adminDb
    .doc(`tenants/${tenantId}/settings/business`)
    .get();
  return snapshot.data() as TenantSettings | undefined;
}

async function loadExpenseDisplayContext(tenantId: string) {
  const [categories, settings] = await Promise.all([
    getCategoryRows(tenantId),
    getBusinessSettings(tenantId),
  ]);
  return {
    categories,
    registration: normalizeGstRegistration(settings?.tax?.gstRegistration),
  };
}

function toCategoryRow(category: ExpenseCategory): ExpenseCategoryRow {
  return {
    id: category.id,
    name: category.name,
    code: category.code,
    active: category.active,
    sortOrder: category.sortOrder,
  };
}

function toMerchantRuleRow(
  rule: ExpenseMerchantRule,
  categories: ExpenseCategoryRow[],
): MerchantRuleRow {
  return {
    id: rule.id,
    name: rule.name,
    normalizedMerchantKey: rule.normalizedMerchantKey,
    categoryId: rule.categoryId,
    categoryName:
      categories.find((category) => category.id === rule.categoryId)?.name ||
      "Uncategorised",
    gstTreatment: rule.gstTreatment
      ? normalizeGstTreatment(rule.gstTreatment)
      : undefined,
    businessUsePercent: rule.businessUsePercent,
    isSubscription: rule.isSubscription,
    isRecurring: rule.isRecurring,
    confidence: rule.confidence,
    active: rule.active,
    createdFromExpenseId: rule.createdFromExpenseId,
    updatedAt: serializeTimestamp(rule.updatedAt),
  };
}

function toConfirmedExpenseRow(
  expense: Expense,
  categories: ExpenseCategoryRow[],
  registration: GstRegistrationSettings,
): ConfirmedExpenseRow {
  const categoryId = expense.categoryId || "";
  const category =
    categories.find((candidate) => candidate.id === categoryId)?.name ||
    "Uncategorised";
  const snapshotMatches =
    expense.gstRegistrationStatusAtCalculation !== undefined &&
    expenseRegistrationSnapshotMatches(expense, registration);

  return {
    id: expense.id,
    candidateId: expense.candidateId,
    importBatchId: expense.importBatchId,
    sourceAccountKey: expense.sourceAccountKey,
    date: expense.date,
    merchantName: expense.merchantName,
    rawDescription: expense.rawDescription,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    businessUsePercent: expense.businessUsePercent,
    claimableAmountMinor: expense.claimableAmountMinor,
    categoryId,
    categoryName: category,
    gstTreatment: normalizeGstTreatment(expense.gstTreatment),
    gstIncludedAmountMinor: expense.gstIncludedAmountMinor ?? 0,
    gstAmountMinor: expense.gstAmountMinor ?? 0,
    gstCreditStatus: expense.gstCreditStatus ?? "review_required",
    gstRegistrationReviewRequired:
      expense.gstRegistrationReviewRequired === true || !snapshotMatches,
    taxInvoiceStatus: expense.taxInvoiceStatus,
    receiptFileId: expense.receiptFileId,
    isSubscription: expense.isSubscription,
    isRecurring: expense.isRecurring,
    notes: expense.notes,
    merchantRuleId: expense.merchantRuleId,
    reviewStatus: expense.reviewStatus,
    createdAt: serializeTimestamp(expense.createdAt),
    updatedAt: serializeTimestamp(expense.updatedAt),
  };
}

function validateAccountingInput(
  input: ConfirmExpenseInput | UpdateExpenseInput,
): void {
  if (
    !Number.isInteger(input.businessUsePercent) ||
    input.businessUsePercent < 1 ||
    input.businessUsePercent > 100
  ) {
    throw new ExpenseAccountingError(
      "Business-use percentage must be an integer from 1 to 100",
    );
  }
  if (!input.categoryId || input.categoryId.includes("/")) {
    throw new ExpenseAccountingError("Select an expense category");
  }
  if (
    ![
      "taxable_purchase",
      "gst_claimable",
      "no_gst",
      "gst_free",
      "input_taxed",
      "private_or_non_claimable",
      "review_required",
    ].includes(input.gstTreatment)
  ) {
    throw new ExpenseAccountingError("Select a valid GST treatment");
  }
  if (
    !["not_required", "missing", "attached", "review_required"].includes(
      input.taxInvoiceStatus,
    )
  ) {
    throw new ExpenseAccountingError("Select a valid evidence status");
  }
  normalizeNotes(input.notes);
}

function normalizeCategoryName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 80) {
    throw new ExpenseAccountingError(
      "Category name must be between 1 and 80 characters",
    );
  }
  return normalized;
}

function normalizeNotes(value: string | undefined): string | undefined {
  const normalized = value?.trim() || undefined;
  if (normalized && normalized.length > 1_000) {
    throw new ExpenseAccountingError("Notes cannot exceed 1000 characters");
  }
  return normalized;
}

function normalizeGstTreatment(
  value: ExpenseGstTreatment,
): ExpenseGstTreatment {
  return value === "gst_claimable" ? "taxable_purchase" : value;
}

function serializeTimestamp(
  value: FirestoreTimestampLike | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if ("toDate" in value) {
    return value.toDate().toISOString();
  }
  return new Date(
    value.seconds * 1000 + value.nanoseconds / 1_000_000,
  ).toISOString();
}

function omitUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}

function accountingFailure<T>(
  error: unknown,
  fallback: string,
): ActionResult<T> {
  console.error(fallback, error);
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}
