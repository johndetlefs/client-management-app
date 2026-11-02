"use server";

import { FieldValue } from "firebase-admin/firestore";
import { sydneyDate } from "@/lib/finance/period";
import { loadFinancialReport } from "@/lib/finance/report-firestore";
import { financialInvoice } from "@/lib/finance/firestore";
import { nonCashAttributionReasons } from "@/lib/finance/bas-non-cash";
import type { Receipt } from "@/lib/finance/types";
import { cashBasFromReport } from "@/lib/finance/bas-cash";

import {
  buildBasPreparationSummary,
  getBasPeriodContaining,
  listBasPeriods,
  normalizeBasPreparationSettings,
  type BasExpenseSource,
  type BasInvoiceSource,
  type BasPeriod,
  type BasPreparationSummary,
} from "@/lib/expenses/bas";
import { normalizeGstRegistration } from "@/lib/expenses/calculations";
import {
  assertExpenseTenantAccess,
  tenantExpenseCollectionRefs,
} from "@/lib/expenses/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { Expense } from "@/types/expense";
import type { Invoice } from "@/types/invoice";
import type {
  BasPreparationSettings,
  GstRegistrationSettings,
  TenantSettings,
} from "@/types/tenant";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface BasPreparationContext {
  settings?: BasPreparationSettings;
  registration: GstRegistrationSettings;
  periods: BasPeriod[];
  canManageSettings: boolean;
}

export async function getBasPreparationContext(
  tenantId: string,
  idToken: string,
): Promise<ActionResult<BasPreparationContext>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    const tenantSettings = await getTenantSettings(tenantId);
    const settings = normalizeBasPreparationSettings(
      tenantSettings?.tax?.basPreparation,
    );
    return {
      success: true,
      data: {
        settings,
        registration: normalizeGstRegistration(
          tenantSettings?.tax?.gstRegistration,
        ),
        periods: settings
          ? listBasPeriods(settings.cadence, todayIsoDate(), 12)
          : [],
        canManageSettings: access.role === "owner",
      },
    };
  } catch (error) {
    return basFailure(error, "Failed to load BAS preparation settings");
  }
}

export async function saveBasPreparationSettings(
  tenantId: string,
  idToken: string,
  input: BasPreparationSettings,
): Promise<ActionResult<BasPreparationContext>> {
  try {
    const access = await assertExpenseTenantAccess(tenantId, idToken);
    if (access.role !== "owner") {
      return {
        success: false,
        error: "Only tenant owners can change BAS preparation settings",
      };
    }
    const settings = normalizeBasPreparationSettings(input);
    if (!settings) {
      throw new Error("BAS preparation settings are required");
    }
    const settingsRef = adminDb.doc(`tenants/${tenantId}/settings/business`);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(settingsRef);
      const existing = snapshot.data() as TenantSettings | undefined;
      transaction.set(
        settingsRef,
        {
          tax: {
            ...(existing?.tax || {
              taxType: "GST",
              defaultRate: 0.1,
            }),
            basPreparation: settings,
          },
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: access.userId,
        },
        { merge: true },
      );
    });
    const updated = await getTenantSettings(tenantId);
    return {
      success: true,
      data: {
        settings,
        registration: normalizeGstRegistration(
          updated?.tax?.gstRegistration,
        ),
        periods: listBasPeriods(settings.cadence, todayIsoDate(), 12),
        canManageSettings: true,
      },
    };
  } catch (error) {
    return basFailure(error, "Failed to save BAS preparation settings");
  }
}

export async function getBasPreparationSummary(
  tenantId: string,
  idToken: string,
  periodStartDate: string,
): Promise<ActionResult<BasPreparationSummary>> {
  try {
    await assertExpenseTenantAccess(tenantId, idToken);
    const tenantSettings = await getTenantSettings(tenantId);
    const settings = normalizeBasPreparationSettings(
      tenantSettings?.tax?.basPreparation,
    );
    if (!settings) {
      return {
        success: false,
        error: "Choose GST accounting basis and BAS cadence first",
      };
    }
    const registration = normalizeGstRegistration(
      tenantSettings?.tax?.gstRegistration,
    );
    const period = getBasPeriodContaining(periodStartDate, settings.cadence);
    if (period.startDate !== periodStartDate) {
      return { success: false, error: "Selected BAS period is invalid" };
    }

    if (settings.accountingBasis === "cash") {
      const report = await loadFinancialReport(tenantId, idToken, { start: period.startDate, end: period.endDate, label: period.label });
      return { success: true, data: cashBasFromReport(report, settings) };
    }

    const refs = tenantExpenseCollectionRefs(tenantId);
    const [expenseSnapshot, invoiceSnapshot, receiptSnapshot] = await Promise.all([
      refs.expenses
        .where("date", ">=", period.startDate)
        .where("date", "<=", period.endDate)
        .orderBy("date", "asc")
        .get(),
      adminDb
        .collection(`tenants/${tenantId}/invoices`)
        .limit(20001)
        .get(),
      adminDb.collection(`tenants/${tenantId}/invoiceReceipts`).limit(20001).get(),
    ]);
    if (invoiceSnapshot.size > 20000 || receiptSnapshot.size > 20000) throw new Error("BAS history limit exceeded; no partial summary produced");
    const allInvoices = invoiceSnapshot.docs.map(doc => financialInvoice(doc.id, doc.data()));
    const attributionReviewReasons = nonCashAttributionReasons(allInvoices, receiptSnapshot.docs.map(doc => doc.data() as Receipt), period);

    const expenses = expenseSnapshot.docs.map((doc) =>
      toBasExpenseSource({ ...doc.data(), id: doc.id } as Expense),
    );
    const [correctionReview, clientCreditReview] = await Promise.all([
      adminDb.collection(`tenants/${tenantId}/invoiceCorrections`).where("status", "==", "posted").limit(1).get(),
      adminDb.collection(`tenants/${tenantId}/creditNotes`).where("status", "==", "issued").limit(1).get(),
    ]);
    const periodInvoices = invoiceSnapshot.docs.filter(doc => { const date = serializeDate(doc.get("issueDate")); return date && date >= period.startDate && date <= period.endDate; });
    const foreignCurrencySales = periodInvoices.some(doc => (doc.get("currency") || "AUD") !== "AUD");
    const invoices = periodInvoices.filter(doc => !doc.get("currency") || doc.get("currency") === "AUD").map((doc) =>
      toBasInvoiceSource({ ...doc.data(), id: doc.id } as Invoice),
    );

    return {
      success: true,
      data: buildBasPreparationSummary({
        attributionReviewReasons,
        correctionReviewRequired: !correctionReview.empty || !clientCreditReview.empty,
        foreignCurrencySales,
        settings,
        registration,
        period,
        expenses,
        invoices,
      }),
    };
  } catch (error) {
    return basFailure(error, "Failed to prepare BAS summary");
  }
}

async function getTenantSettings(
  tenantId: string,
): Promise<TenantSettings | undefined> {
  const snapshot = await adminDb
    .doc(`tenants/${tenantId}/settings/business`)
    .get();
  return snapshot.data() as TenantSettings | undefined;
}

function toBasExpenseSource(expense: Expense): BasExpenseSource {
  return {
    id: expense.id,
    date: expense.date,
    merchantName: expense.merchantName,
    claimableAmountMinor: expense.claimableAmountMinor,
    gstIncludedAmountMinor: expense.gstIncludedAmountMinor ?? 0,
    gstAmountMinor: expense.gstAmountMinor ?? 0,
    gstCreditStatus: expense.gstCreditStatus ?? "review_required",
    taxInvoiceStatus: expense.taxInvoiceStatus,
    gstRegistrationStatusAtCalculation:
      expense.gstRegistrationStatusAtCalculation ?? "unknown",
    gstRegistrationEffectiveFromAtCalculation:
      expense.gstRegistrationEffectiveFromAtCalculation,
    gstRegistrationEffectiveToAtCalculation:
      expense.gstRegistrationEffectiveToAtCalculation,
    gstRegistrationReviewRequired:
      expense.gstRegistrationReviewRequired === true,
  };
}

function toBasInvoiceSource(invoice: Invoice): BasInvoiceSource {
  const issueDate = serializeDate(invoice.issueDate);
  if (!issueDate) {
    throw new Error(`Invoice ${invoice.id} has no valid issue date`);
  }
  return {
    id: invoice.id,
    issueDate,
    status: invoice.status,
    totalMinor: invoice.totalMinor,
    taxMinor: invoice.taxMinor,
    amountPaidMinor: invoice.amountPaidMinor,
  };
}

function serializeDate(value: Invoice["issueDate"]): string | undefined {
  if (!value) return undefined;
  const date =
    value instanceof Date
      ? value
      : "toDate" in value
        ? value.toDate()
        : undefined;
  return date ? sydneyDate(date) : undefined;
}

function todayIsoDate(): string {
  return sydneyDate();
}

function basFailure<T>(
  error: unknown,
  fallback: string,
): ActionResult<T> {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}
