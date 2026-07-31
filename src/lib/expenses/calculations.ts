import type {
  ExpenseGstCreditStatus,
  ExpenseGstTreatment,
  ExpenseTaxInvoiceStatus,
} from "../../types/expense";
import type { GstRegistrationSettings } from "../../types/tenant";

export const EXPENSE_CALCULATION_VERSION = "expense-calculation-v1";
export const GST_TAX_INVOICE_THRESHOLD_MINOR = 8_250;

export interface ExpenseCalculationInput {
  amountMinor: number;
  businessUsePercent: number;
  expenseDate: string;
  gstTreatment: ExpenseGstTreatment;
  taxInvoiceStatus: ExpenseTaxInvoiceStatus;
  gstRegistration?: GstRegistrationSettings;
}

export interface ExpenseCalculationResult {
  claimableAmountMinor: number;
  gstIncludedAmountMinor: number;
  gstAmountMinor: number;
  gstCreditStatus: ExpenseGstCreditStatus;
  reviewRequired: boolean;
  calculationVersion: string;
  gstRegistrationStatusAtCalculation:
    | "unknown"
    | "not_registered"
    | "registered";
  gstRegistrationEffectiveFromAtCalculation?: string;
  gstRegistrationEffectiveToAtCalculation?: string;
}

export function calculateExpenseAmounts(
  input: ExpenseCalculationInput,
): ExpenseCalculationResult {
  assertPositiveMinorUnits(input.amountMinor);
  assertBusinessUsePercent(input.businessUsePercent);
  assertIsoDate("expenseDate", input.expenseDate);

  const registration = normalizeGstRegistration(input.gstRegistration);
  const claimableAmountMinor = roundHalfUp(
    input.amountMinor * input.businessUsePercent,
    100,
  );
  const taxablePurchase = isTaxablePurchase(input.gstTreatment);
  const gstIncludedAmountMinor = taxablePurchase
    ? roundHalfUp(input.amountMinor * input.businessUsePercent, 1_100)
    : 0;
  const gstCreditStatus = resolveGstCreditStatus({
    ...input,
    gstRegistration: registration,
    taxablePurchase,
  });
  const gstAmountMinor =
    gstCreditStatus === "claimable" ? gstIncludedAmountMinor : 0;

  return {
    claimableAmountMinor,
    gstIncludedAmountMinor,
    gstAmountMinor,
    gstCreditStatus,
    reviewRequired:
      gstCreditStatus === "review_required" ||
      gstCreditStatus === "evidence_missing",
    calculationVersion: EXPENSE_CALCULATION_VERSION,
    gstRegistrationStatusAtCalculation: registration.status,
    gstRegistrationEffectiveFromAtCalculation: registration.effectiveFrom,
    gstRegistrationEffectiveToAtCalculation: registration.effectiveTo,
  };
}

export function normalizeGstRegistration(
  registration: GstRegistrationSettings | undefined,
): GstRegistrationSettings {
  if (!registration) {
    return { status: "unknown" };
  }

  if (
    registration.status !== "unknown" &&
    registration.status !== "not_registered" &&
    registration.status !== "registered"
  ) {
    throw new Error("Unsupported GST registration status");
  }

  const effectiveFrom = normalizeOptionalIsoDate(
    "GST registration effective-from date",
    registration.effectiveFrom,
  );
  const effectiveTo = normalizeOptionalIsoDate(
    "GST registration effective-to date",
    registration.effectiveTo,
  );

  if (registration.status === "registered" && !effectiveFrom) {
    throw new Error("Registered businesses require a GST effective-from date");
  }
  if (
    effectiveFrom &&
    effectiveTo &&
    effectiveTo.localeCompare(effectiveFrom) < 0
  ) {
    throw new Error("GST effective-to date cannot precede effective-from date");
  }

  return {
    status: registration.status,
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(effectiveTo ? { effectiveTo } : {}),
  };
}

export function isDateWithinGstRegistration(
  date: string,
  registration: GstRegistrationSettings | undefined,
): boolean {
  assertIsoDate("date", date);
  const normalized = normalizeGstRegistration(registration);
  if (normalized.status !== "registered" || !normalized.effectiveFrom) {
    return false;
  }

  return (
    date.localeCompare(normalized.effectiveFrom) >= 0 &&
    (!normalized.effectiveTo ||
      date.localeCompare(normalized.effectiveTo) <= 0)
  );
}

export function expenseRegistrationSnapshotMatches(
  expense: {
    gstRegistrationStatusAtCalculation:
      | "unknown"
      | "not_registered"
      | "registered";
    gstRegistrationEffectiveFromAtCalculation?: string;
    gstRegistrationEffectiveToAtCalculation?: string;
  },
  registration: GstRegistrationSettings | undefined,
): boolean {
  const normalized = normalizeGstRegistration(registration);
  return (
    expense.gstRegistrationStatusAtCalculation === normalized.status &&
    (expense.gstRegistrationEffectiveFromAtCalculation || undefined) ===
      normalized.effectiveFrom &&
    (expense.gstRegistrationEffectiveToAtCalculation || undefined) ===
      normalized.effectiveTo
  );
}

function resolveGstCreditStatus(
  input: ExpenseCalculationInput & {
    gstRegistration: GstRegistrationSettings;
    taxablePurchase: boolean;
  },
): ExpenseGstCreditStatus {
  if (input.gstTreatment === "review_required") {
    return "review_required";
  }
  if (!input.taxablePurchase) {
    return "not_claimable";
  }
  if (input.gstRegistration.status === "unknown") {
    return "review_required";
  }
  if (input.gstRegistration.status === "not_registered") {
    return "not_registered";
  }
  if (
    !isDateWithinGstRegistration(
      input.expenseDate,
      input.gstRegistration,
    )
  ) {
    return "outside_registration_period";
  }
  if (
    input.taxInvoiceStatus === "missing" ||
    input.taxInvoiceStatus === "review_required" ||
    (input.amountMinor > GST_TAX_INVOICE_THRESHOLD_MINOR &&
      input.taxInvoiceStatus !== "attached")
  ) {
    return "evidence_missing";
  }

  return "claimable";
}

function isTaxablePurchase(treatment: ExpenseGstTreatment): boolean {
  return treatment === "taxable_purchase" || treatment === "gst_claimable";
}

function roundHalfUp(numerator: number, denominator: number): number {
  if (
    !Number.isSafeInteger(numerator) ||
    numerator < 0 ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0
  ) {
    throw new Error("Currency calculation exceeded safe integer bounds");
  }

  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return quotient + (remainder * 2 >= denominator ? 1 : 0);
}

function assertPositiveMinorUnits(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Expense amount must be a positive safe integer");
  }
}

function assertBusinessUsePercent(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("Business-use percentage must be an integer from 1 to 100");
  }
}

function normalizeOptionalIsoDate(
  name: string,
  value: string | undefined,
): string | undefined {
  const normalized = value?.trim() || undefined;
  if (normalized) {
    assertIsoDate(name, normalized);
  }
  return normalized;
}

function assertIsoDate(name: string, value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} is not a valid calendar date`);
  }
}
