import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBasPreparationSummary,
  getBasPeriodContaining,
  listBasPeriods,
  type BasExpenseSource,
  type BasInvoiceSource,
} from "./bas";

const PERIOD = getBasPeriodContaining("2026-08-15", "quarterly");
const REGISTRATION = {
  status: "registered" as const,
  effectiveFrom: "2026-07-01",
};

const EXPENSES: BasExpenseSource[] = [
  {
    id: "claimable",
    date: "2026-07-10",
    merchantName: "Claimable",
    claimableAmountMinor: 5500,
    gstIncludedAmountMinor: 500,
    gstAmountMinor: 500,
    gstCreditStatus: "claimable",
    taxInvoiceStatus: "attached",
    gstRegistrationStatusAtCalculation: "registered",
    gstRegistrationEffectiveFromAtCalculation: "2026-07-01",
  },
  {
    id: "non-claimable",
    date: "2026-08-10",
    merchantName: "Non claimable",
    claimableAmountMinor: 1000,
    gstIncludedAmountMinor: 100,
    gstAmountMinor: 0,
    gstCreditStatus: "not_claimable",
    taxInvoiceStatus: "not_required",
    gstRegistrationStatusAtCalculation: "registered",
    gstRegistrationEffectiveFromAtCalculation: "2026-07-01",
  },
  {
    id: "review",
    date: "2026-09-10",
    merchantName: "Review",
    claimableAmountMinor: 2200,
    gstIncludedAmountMinor: 200,
    gstAmountMinor: 0,
    gstCreditStatus: "evidence_missing",
    taxInvoiceStatus: "missing",
    gstRegistrationStatusAtCalculation: "registered",
    gstRegistrationEffectiveFromAtCalculation: "2026-07-01",
  },
];

const INVOICES: BasInvoiceSource[] = [
  {
    id: "invoice-1",
    issueDate: "2026-07-15",
    status: "sent",
    totalMinor: 11000,
    taxMinor: 1000,
    amountPaidMinor: 0,
  },
  {
    id: "invoice-2",
    issueDate: "2026-08-15",
    status: "paid",
    totalMinor: 22000,
    taxMinor: 2000,
    amountPaidMinor: 22000,
  },
  {
    id: "draft",
    issueDate: "2026-09-15",
    status: "draft",
    totalMinor: 99900,
    taxMinor: 9000,
    amountPaidMinor: 0,
  },
];

test("monthly and quarterly periods are deterministic and inclusive", () => {
  assert.deepEqual(getBasPeriodContaining("2026-02-17", "monthly"), {
    startDate: "2026-02-01",
    endDate: "2026-02-28",
    label: "February 2026",
  });
  assert.deepEqual(PERIOD, {
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    label: "July-Sept 2026",
  });
  assert.deepEqual(
    listBasPeriods("quarterly", "2026-08-15", 3).map((period) => [
      period.startDate,
      period.endDate,
    ]),
    [
      ["2026-07-01", "2026-09-30"],
      ["2026-04-01", "2026-06-30"],
      ["2026-01-01", "2026-03-31"],
    ],
  );
});

test("registered non-cash summary reconciles labels and GST buckets", () => {
  const summary = buildBasPreparationSummary({
    settings: {
      accountingBasis: "non_cash",
      cadence: "quarterly",
      reportingMethod: "simpler_bas",
    },
    registration: REGISTRATION,
    period: PERIOD,
    expenses: EXPENSES,
    invoices: INVOICES,
  });

  assert.equal(summary.status, "needs_review");
  assert.equal(summary.operationalPurchasesMinor, 8700);
  assert.equal(summary.operationalIncomeMinor, 33000);
  assert.equal(summary.g1TotalSalesMinor, 33000);
  assert.equal(summary.oneAGstOnSalesMinor, 3000);
  assert.equal(summary.oneBGstOnPurchasesMinor, 500);
  assert.equal(summary.netGstMinor, 2500);
  assert.equal(summary.potentialGstOnPurchasesMinor, 800);
  assert.equal(summary.nonClaimableGstMinor, 100);
  assert.equal(summary.reviewNeededGstMinor, 200);
  assert.equal(summary.reviewNeededCount, 1);
  assert.equal(summary.includedInvoiceCount, 2);
});

test("cash basis fails closed on invoice sales without dated payments", () => {
  const summary = buildBasPreparationSummary({
    settings: {
      accountingBasis: "cash",
      cadence: "quarterly",
      reportingMethod: "simpler_bas",
    },
    registration: REGISTRATION,
    period: PERIOD,
    expenses: EXPENSES,
    invoices: INVOICES,
  });

  assert.equal(summary.status, "needs_review");
  assert.equal(summary.g1TotalSalesMinor, null);
  assert.equal(summary.oneAGstOnSalesMinor, null);
  assert.equal(summary.oneBGstOnPurchasesMinor, 500);
  assert.equal(summary.netGstMinor, null);
  assert.match(summary.reviewReasons.join(" "), /dated payment events/i);
});

test("non-registered tenant receives operational totals without BAS labels", () => {
  const summary = buildBasPreparationSummary({
    settings: {
      accountingBasis: "non_cash",
      cadence: "quarterly",
      reportingMethod: "simpler_bas",
    },
    registration: { status: "not_registered" },
    period: PERIOD,
    expenses: EXPENSES,
    invoices: INVOICES,
  });

  assert.equal(summary.status, "not_registered");
  assert.equal(summary.operationalIncomeMinor, 33000);
  assert.equal(summary.operationalPurchasesMinor, 8700);
  assert.equal(summary.g1TotalSalesMinor, null);
  assert.equal(summary.oneAGstOnSalesMinor, null);
  assert.equal(summary.oneBGstOnPurchasesMinor, null);
  assert.equal(summary.netGstMinor, null);
});

test("unknown and partial registration fail closed or limit invoice inclusion", () => {
  const unknown = buildBasPreparationSummary({
    settings: {
      accountingBasis: "non_cash",
      cadence: "quarterly",
      reportingMethod: "simpler_bas",
    },
    registration: { status: "unknown" },
    period: PERIOD,
    expenses: EXPENSES,
    invoices: INVOICES,
  });
  assert.equal(unknown.status, "registration_unknown");
  assert.equal(unknown.g1TotalSalesMinor, null);

  const partial = buildBasPreparationSummary({
    settings: {
      accountingBasis: "non_cash",
      cadence: "quarterly",
      reportingMethod: "simpler_bas",
    },
    registration: {
      status: "registered",
      effectiveFrom: "2026-08-01",
    },
    period: PERIOD,
    expenses: EXPENSES,
    invoices: INVOICES,
  });
  assert.equal(partial.g1TotalSalesMinor, 22000);
  assert.equal(partial.oneAGstOnSalesMinor, 2000);
  assert.equal(partial.includedInvoiceCount, 1);
  assert.match(partial.reviewReasons.join(" "), /begins during/i);
});

test("misaligned periods and unsafe source money are rejected", () => {
  assert.throws(
    () =>
      buildBasPreparationSummary({
        settings: {
          accountingBasis: "non_cash",
          cadence: "quarterly",
          reportingMethod: "simpler_bas",
        },
        registration: REGISTRATION,
        period: {
          startDate: "2026-07-02",
          endDate: "2026-09-30",
          label: "Invalid",
        },
        expenses: [],
        invoices: [],
      }),
    /does not match/,
  );
  assert.throws(
    () =>
      buildBasPreparationSummary({
        settings: {
          accountingBasis: "non_cash",
          cadence: "quarterly",
          reportingMethod: "simpler_bas",
        },
        registration: REGISTRATION,
        period: PERIOD,
        expenses: [
          {
            ...EXPENSES[0],
            claimableAmountMinor: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
        invoices: [],
      }),
    /invalid minor-unit/,
  );
});
