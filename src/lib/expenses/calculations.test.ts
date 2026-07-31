import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateExpenseAmounts,
  expenseRegistrationSnapshotMatches,
  normalizeGstRegistration,
} from "./calculations";

const REGISTERED = {
  status: "registered" as const,
  effectiveFrom: "2026-07-01",
};

test("non-registered businesses retain potential GST but claim zero", () => {
  const result = calculateExpenseAmounts({
    amountMinor: 10_000,
    businessUsePercent: 100,
    expenseDate: "2026-07-15",
    gstTreatment: "taxable_purchase",
    taxInvoiceStatus: "attached",
    gstRegistration: { status: "not_registered" },
  });

  assert.equal(result.claimableAmountMinor, 10_000);
  assert.equal(result.gstIncludedAmountMinor, 909);
  assert.equal(result.gstAmountMinor, 0);
  assert.equal(result.gstCreditStatus, "not_registered");
  assert.equal(result.reviewRequired, false);
});

test("registered in-period purchases calculate claimable GST", () => {
  const result = calculateExpenseAmounts({
    amountMinor: 10_000,
    businessUsePercent: 100,
    expenseDate: "2026-07-15",
    gstTreatment: "taxable_purchase",
    taxInvoiceStatus: "attached",
    gstRegistration: REGISTERED,
  });

  assert.equal(result.gstIncludedAmountMinor, 909);
  assert.equal(result.gstAmountMinor, 909);
  assert.equal(result.gstCreditStatus, "claimable");
});

test("mixed-use calculation applies business percentage using integer rounding", () => {
  const result = calculateExpenseAmounts({
    amountMinor: 44_000,
    businessUsePercent: 80,
    expenseDate: "2026-07-15",
    gstTreatment: "taxable_purchase",
    taxInvoiceStatus: "attached",
    gstRegistration: REGISTERED,
  });

  assert.equal(result.claimableAmountMinor, 35_200);
  assert.equal(result.gstIncludedAmountMinor, 3_200);
  assert.equal(result.gstAmountMinor, 3_200);
});

test("an expense before registration keeps potential GST but no credit", () => {
  const result = calculateExpenseAmounts({
    amountMinor: 10_000,
    businessUsePercent: 100,
    expenseDate: "2026-06-30",
    gstTreatment: "taxable_purchase",
    taxInvoiceStatus: "attached",
    gstRegistration: REGISTERED,
  });

  assert.equal(result.gstIncludedAmountMinor, 909);
  assert.equal(result.gstAmountMinor, 0);
  assert.equal(result.gstCreditStatus, "outside_registration_period");
});

test("missing evidence blocks credits over the tax-invoice threshold", () => {
  const result = calculateExpenseAmounts({
    amountMinor: 8_251,
    businessUsePercent: 100,
    expenseDate: "2026-07-15",
    gstTreatment: "taxable_purchase",
    taxInvoiceStatus: "not_required",
    gstRegistration: REGISTERED,
  });

  assert.equal(result.gstIncludedAmountMinor, 750);
  assert.equal(result.gstAmountMinor, 0);
  assert.equal(result.gstCreditStatus, "evidence_missing");
  assert.equal(result.reviewRequired, true);
});

test("evidence-not-required is accepted at the threshold", () => {
  const result = calculateExpenseAmounts({
    amountMinor: 8_250,
    businessUsePercent: 100,
    expenseDate: "2026-07-15",
    gstTreatment: "taxable_purchase",
    taxInvoiceStatus: "not_required",
    gstRegistration: REGISTERED,
  });

  assert.equal(result.gstIncludedAmountMinor, 750);
  assert.equal(result.gstAmountMinor, 750);
  assert.equal(result.gstCreditStatus, "claimable");
});

test("non-taxable treatments never calculate GST", () => {
  const result = calculateExpenseAmounts({
    amountMinor: 12_345,
    businessUsePercent: 75,
    expenseDate: "2026-07-15",
    gstTreatment: "no_gst",
    taxInvoiceStatus: "attached",
    gstRegistration: REGISTERED,
  });

  assert.equal(result.claimableAmountMinor, 9_259);
  assert.equal(result.gstIncludedAmountMinor, 0);
  assert.equal(result.gstAmountMinor, 0);
  assert.equal(result.gstCreditStatus, "not_claimable");
});

test("registration snapshots expose later effective-date changes", () => {
  const snapshot = {
    gstRegistrationStatusAtCalculation: "registered" as const,
    gstRegistrationEffectiveFromAtCalculation: "2026-07-01",
  };

  assert.equal(
    expenseRegistrationSnapshotMatches(snapshot, REGISTERED),
    true,
  );
  assert.equal(
    expenseRegistrationSnapshotMatches(snapshot, {
      status: "registered",
      effectiveFrom: "2026-08-01",
    }),
    false,
  );
});

test("registered status requires a valid effective date range", () => {
  assert.throws(
    () => normalizeGstRegistration({ status: "registered" }),
    /effective-from/,
  );
  assert.throws(
    () =>
      normalizeGstRegistration({
        status: "registered",
        effectiveFrom: "2026-07-10",
        effectiveTo: "2026-07-01",
      }),
    /cannot precede/,
  );
});

test("invalid money and business-use values fail closed", () => {
  assert.throws(
    () =>
      calculateExpenseAmounts({
        amountMinor: 0,
        businessUsePercent: 100,
        expenseDate: "2026-07-15",
        gstTreatment: "taxable_purchase",
        taxInvoiceStatus: "attached",
        gstRegistration: REGISTERED,
      }),
    /positive safe integer/,
  );
  assert.throws(
    () =>
      calculateExpenseAmounts({
        amountMinor: 1_000,
        businessUsePercent: 0,
        expenseDate: "2026-07-15",
        gstTreatment: "taxable_purchase",
        taxInvoiceStatus: "attached",
        gstRegistration: REGISTERED,
      }),
    /integer from 1 to 100/,
  );
});
