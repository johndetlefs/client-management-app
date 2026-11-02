import {
  expenseRegistrationSnapshotMatches,
  isDateWithinGstRegistration,
  normalizeGstRegistration,
} from "./calculations";
import type {
  ExpenseGstCreditStatus,
  ExpenseTaxInvoiceStatus,
} from "@/types/expense";
import type {
  BasPreparationSettings,
  BasReportingCadence,
  GstRegistrationSettings,
} from "@/types/tenant";

export const BAS_PREPARATION_VERSION = "bas-preparation-v1";

export interface BasPeriod {
  startDate: string;
  endDate: string;
  label: string;
}

export interface BasExpenseSource {
  id: string;
  date: string;
  merchantName: string;
  claimableAmountMinor: number;
  gstIncludedAmountMinor: number;
  gstAmountMinor: number;
  gstCreditStatus: ExpenseGstCreditStatus;
  taxInvoiceStatus: ExpenseTaxInvoiceStatus;
  gstRegistrationStatusAtCalculation:
    | "unknown"
    | "not_registered"
    | "registered";
  gstRegistrationEffectiveFromAtCalculation?: string;
  gstRegistrationEffectiveToAtCalculation?: string;
  gstRegistrationReviewRequired?: boolean;
}

export interface BasInvoiceSource {
  id: string;
  issueDate: string;
  status: string;
  totalMinor: number;
  taxMinor: number;
  amountPaidMinor: number;
}

export type BasPreparationStatus =
  | "ready"
  | "needs_review"
  | "not_registered"
  | "registration_unknown";

export interface BasPreparationSummary {
  version: string;
  period: BasPeriod;
  settings: BasPreparationSettings;
  registration: GstRegistrationSettings;
  status: BasPreparationStatus;
  preparationOnly: true;
  operationalIncomeMinor: number;
  operationalPurchasesMinor: number;
  g1TotalSalesMinor: number | null;
  oneAGstOnSalesMinor: number | null;
  oneBGstOnPurchasesMinor: number | null;
  netGstMinor: number | null;
  potentialGstOnPurchasesMinor: number;
  nonClaimableGstMinor: number;
  reviewNeededGstMinor: number;
  reviewNeededCount: number;
  includedExpenseCount: number;
  includedInvoiceCount: number;
  reviewReasons: string[];
}

export function normalizeBasPreparationSettings(
  settings: BasPreparationSettings | undefined,
): BasPreparationSettings | undefined {
  if (!settings) return undefined;
  if (
    settings.accountingBasis !== "cash" &&
    settings.accountingBasis !== "non_cash"
  ) {
    throw new Error("GST accounting basis must be cash or non-cash");
  }
  if (settings.cadence !== "monthly" && settings.cadence !== "quarterly") {
    throw new Error("BAS cadence must be monthly or quarterly");
  }
  if (settings.reportingMethod !== "simpler_bas") {
    throw new Error("Only Simpler BAS preparation is supported");
  }
  return {
    accountingBasis: settings.accountingBasis,
    cadence: settings.cadence,
    reportingMethod: "simpler_bas",
  };
}

export function getBasPeriodContaining(
  date: string,
  cadence: BasReportingCadence,
): BasPeriod {
  const parsed = parseIsoDate(date);
  const year = parsed.getUTCFullYear();
  const monthIndex = parsed.getUTCMonth();
  const startMonth =
    cadence === "monthly" ? monthIndex : Math.floor(monthIndex / 3) * 3;
  const months = cadence === "monthly" ? 1 : 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + months, 0));
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    label:
      cadence === "monthly"
        ? new Intl.DateTimeFormat("en-AU", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(start)
        : `${formatShortMonth(start)}-${formatShortMonth(end)} ${end.getUTCFullYear()}`,
  };
}

export function listBasPeriods(
  cadence: BasReportingCadence,
  anchorDate: string,
  count = 12,
): BasPeriod[] {
  if (!Number.isInteger(count) || count < 1 || count > 60) {
    throw new Error("BAS period count must be from 1 to 60");
  }
  const current = getBasPeriodContaining(anchorDate, cadence);
  const currentStart = parseIsoDate(current.startDate);
  const stepMonths = cadence === "monthly" ? 1 : 3;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(
        currentStart.getUTCFullYear(),
        currentStart.getUTCMonth() - index * stepMonths,
        1,
      ),
    );
    return getBasPeriodContaining(toIsoDate(date), cadence);
  });
}

export function buildBasPreparationSummary(input: {
  correctionReviewRequired?: boolean;
  settings: BasPreparationSettings;
  registration: GstRegistrationSettings | undefined;
  period: BasPeriod;
  expenses: BasExpenseSource[];
  invoices: BasInvoiceSource[];
}): BasPreparationSummary {
  const settings = normalizeBasPreparationSettings(input.settings);
  if (!settings) {
    throw new Error("BAS settings must be configured explicitly");
  }
  const registration = normalizeGstRegistration(input.registration);
  validatePeriod(input.period, settings.cadence);

  const expenses = input.expenses.filter((expense) =>
    withinPeriod(expense.date, input.period),
  );
  const invoices = input.invoices.filter(
    (invoice) =>
      invoice.status !== "draft" &&
      invoice.status !== "void" &&
      withinPeriod(invoice.issueDate, input.period),
  );
  assertSourceMoney(expenses, invoices);

  const operationalIncomeMinor = sumSafe(invoices, (row) => row.totalMinor);
  const operationalPurchasesMinor = sumSafe(
    expenses,
    (row) => row.claimableAmountMinor,
  );
  const registrationOverlapsPeriod = registrationOverlaps(
    registration,
    input.period,
  );

  if (registration.status === "unknown") {
    return baseSummary({
      settings,
      registration,
      period: input.period,
      status: "registration_unknown",
      operationalIncomeMinor,
      operationalPurchasesMinor,
      expenses,
      invoices,
      reviewReasons: ["GST registration status is not confirmed."],
    });
  }

  if (!registrationOverlapsPeriod) {
    return baseSummary({
      settings,
      registration,
      period: input.period,
      status: "not_registered",
      operationalIncomeMinor,
      operationalPurchasesMinor,
      expenses,
      invoices,
      reviewReasons: [
        "The tenant is not GST registered during the selected period; BAS labels are not calculated.",
      ],
    });
  }

  let oneBGstOnPurchasesMinor = 0;
  let nonClaimableGstMinor = 0;
  let reviewNeededGstMinor = 0;
  let reviewNeededCount = 0;
  for (const expense of expenses) {
    const snapshotMatches =
      expenseRegistrationSnapshotMatches(expense, registration);
    const registrationReview =
      expense.gstRegistrationReviewRequired === true || !snapshotMatches;
    const unresolved =
      registrationReview ||
      expense.gstCreditStatus === "review_required" ||
      expense.gstCreditStatus === "evidence_missing" ||
      expense.taxInvoiceStatus === "missing" ||
      expense.taxInvoiceStatus === "review_required";
    if (unresolved) {
      reviewNeededCount += 1;
      reviewNeededGstMinor = addSafe(
        reviewNeededGstMinor,
        expense.gstIncludedAmountMinor,
      );
    } else if (expense.gstCreditStatus === "claimable") {
      oneBGstOnPurchasesMinor = addSafe(
        oneBGstOnPurchasesMinor,
        expense.gstAmountMinor,
      );
    } else {
      nonClaimableGstMinor = addSafe(
        nonClaimableGstMinor,
        expense.gstIncludedAmountMinor,
      );
    }
  }

  const potentialGstOnPurchasesMinor = sumSafe(
    expenses,
    (row) => row.gstIncludedAmountMinor,
  );
  const reviewReasons: string[] = [];
  if (input.correctionReviewRequired) reviewReasons.push("Credit note adjustments need a GST reporting period.");
  if (reviewNeededCount > 0) {
    reviewReasons.push(
      `${reviewNeededCount} expense${reviewNeededCount === 1 ? "" : "s"} require GST or evidence review.`,
    );
  }
  if (
    registration.effectiveFrom &&
    registration.effectiveFrom > input.period.startDate
  ) {
    reviewReasons.push("GST registration begins during the selected period.");
  }
  if (
    registration.effectiveTo &&
    registration.effectiveTo < input.period.endDate
  ) {
    reviewReasons.push("GST registration ends during the selected period.");
  }

  if (settings.accountingBasis === "cash" || input.correctionReviewRequired) {
    reviewReasons.push(
      "Cash-basis sales and GST on sales are unavailable because invoices store cumulative payments without dated payment events.",
    );
    return {
      version: BAS_PREPARATION_VERSION,
      period: input.period,
      settings,
      registration,
      status: "needs_review",
      preparationOnly: true,
      operationalIncomeMinor,
      operationalPurchasesMinor,
      g1TotalSalesMinor: null,
      oneAGstOnSalesMinor: null,
      oneBGstOnPurchasesMinor,
      netGstMinor: null,
      potentialGstOnPurchasesMinor,
      nonClaimableGstMinor,
      reviewNeededGstMinor,
      reviewNeededCount,
      includedExpenseCount: expenses.length,
      includedInvoiceCount: invoices.length,
      reviewReasons,
    };
  }

  const registeredInvoices = invoices.filter((invoice) =>
    isDateWithinGstRegistration(invoice.issueDate, registration),
  );
  const g1TotalSalesMinor = sumSafe(
    registeredInvoices,
    (row) => row.totalMinor,
  );
  const oneAGstOnSalesMinor = sumSafe(
    registeredInvoices,
    (row) => row.taxMinor,
  );
  const netGstMinor = subtractSafe(
    oneAGstOnSalesMinor,
    oneBGstOnPurchasesMinor,
  );

  return {
    version: BAS_PREPARATION_VERSION,
    period: input.period,
    settings,
    registration,
    status: reviewReasons.length > 0 ? "needs_review" : "ready",
    preparationOnly: true,
    operationalIncomeMinor,
    operationalPurchasesMinor,
    g1TotalSalesMinor,
    oneAGstOnSalesMinor,
    oneBGstOnPurchasesMinor,
    netGstMinor,
    potentialGstOnPurchasesMinor,
    nonClaimableGstMinor,
    reviewNeededGstMinor,
    reviewNeededCount,
    includedExpenseCount: expenses.length,
    includedInvoiceCount: registeredInvoices.length,
    reviewReasons,
  };
}

function baseSummary(input: {
  settings: BasPreparationSettings;
  registration: GstRegistrationSettings;
  period: BasPeriod;
  status: "not_registered" | "registration_unknown";
  operationalIncomeMinor: number;
  operationalPurchasesMinor: number;
  expenses: BasExpenseSource[];
  invoices: BasInvoiceSource[];
  reviewReasons: string[];
}): BasPreparationSummary {
  return {
    version: BAS_PREPARATION_VERSION,
    period: input.period,
    settings: input.settings,
    registration: input.registration,
    status: input.status,
    preparationOnly: true,
    operationalIncomeMinor: input.operationalIncomeMinor,
    operationalPurchasesMinor: input.operationalPurchasesMinor,
    g1TotalSalesMinor: null,
    oneAGstOnSalesMinor: null,
    oneBGstOnPurchasesMinor: null,
    netGstMinor: null,
    potentialGstOnPurchasesMinor: sumSafe(
      input.expenses,
      (row) => row.gstIncludedAmountMinor,
    ),
    nonClaimableGstMinor: sumSafe(
      input.expenses,
      (row) => row.gstIncludedAmountMinor,
    ),
    reviewNeededGstMinor: 0,
    reviewNeededCount: 0,
    includedExpenseCount: input.expenses.length,
    includedInvoiceCount: input.invoices.length,
    reviewReasons: input.reviewReasons,
  };
}

function registrationOverlaps(
  registration: GstRegistrationSettings,
  period: BasPeriod,
): boolean {
  if (registration.status !== "registered" || !registration.effectiveFrom) {
    return false;
  }
  return (
    registration.effectiveFrom <= period.endDate &&
    (!registration.effectiveTo ||
      registration.effectiveTo >= period.startDate)
  );
}

function validatePeriod(
  period: BasPeriod,
  cadence: BasReportingCadence,
): void {
  const expected = getBasPeriodContaining(period.startDate, cadence);
  if (
    expected.startDate !== period.startDate ||
    expected.endDate !== period.endDate
  ) {
    throw new Error("Selected BAS period does not match the configured cadence");
  }
}

function withinPeriod(date: string, period: BasPeriod): boolean {
  parseIsoDate(date);
  return date >= period.startDate && date <= period.endDate;
}

function assertSourceMoney(
  expenses: BasExpenseSource[],
  invoices: BasInvoiceSource[],
): void {
  const values = [
    ...expenses.flatMap((row) => [
      row.claimableAmountMinor,
      row.gstIncludedAmountMinor,
      row.gstAmountMinor,
    ]),
    ...invoices.flatMap((row) => [
      row.totalMinor,
      row.taxMinor,
      row.amountPaidMinor,
    ]),
  ];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("BAS source contains invalid minor-unit values");
  }
}

function sumSafe<T>(rows: T[], select: (row: T) => number): number {
  return rows.reduce((total, row) => addSafe(total, select(row)), 0);
}

function addSafe(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error("BAS total exceeds safe integer range");
  }
  return result;
}

function subtractSafe(left: number, right: number): number {
  const result = left - right;
  if (!Number.isSafeInteger(result)) {
    throw new Error("BAS total exceeds safe integer range");
  }
  return result;
}

function parseIsoDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("BAS dates must use YYYY-MM-DD");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("BAS date is invalid");
  }
  return parsed;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatShortMonth(value: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    timeZone: "UTC",
  }).format(value);
}
