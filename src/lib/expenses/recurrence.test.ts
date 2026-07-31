import assert from "node:assert/strict";
import test from "node:test";

import type { ExpenseRecurrenceOccurrence } from "./recurrence";
import {
  EXPENSE_RECURRENCE_VERSION,
  detectExpenseRecurrencePattern,
} from "./recurrence";
import { resolveExpenseSuggestion } from "./suggestions";

function occurrence(
  postedDate: string,
  amountMinor = 2_000,
  overrides: Partial<ExpenseRecurrenceOccurrence> = {},
): ExpenseRecurrenceOccurrence {
  return {
    postedDate,
    amountMinor,
    normalizedMerchantName: "EXAMPLE SOFTWARE",
    currency: "AUD",
    ...overrides,
  };
}

function detect(occurrences: ExpenseRecurrenceOccurrence[]) {
  return detectExpenseRecurrencePattern({
    normalizedMerchantName: "EXAMPLE SOFTWARE",
    currency: "AUD",
    occurrences,
  });
}

test("detects stable month-end transactions as subscription-like", () => {
  const pattern = detect([
    occurrence("2026-01-31", 2_000),
    occurrence("2026-02-28", 2_025),
    occurrence("2026-03-31", 1_975),
  ]);

  assert.deepEqual(pattern, {
    algorithmVersion: EXPENSE_RECURRENCE_VERSION,
    cadence: "monthly",
    occurrenceCount: 3,
    firstDate: "2026-01-31",
    lastDate: "2026-03-31",
    minIntervalDays: 28,
    maxIntervalDays: 31,
    medianAmountMinor: 2_000,
    amountRangeMinor: 50,
    amountStable: true,
    isSubscriptionLike: true,
    confidence: 0.82,
  });
});

test("detects weekly recurrence without inferring subscription", () => {
  const pattern = detect([
    occurrence("2026-06-01"),
    occurrence("2026-06-08"),
    occurrence("2026-06-15"),
    occurrence("2026-06-22"),
  ]);

  assert.equal(pattern?.cadence, "weekly");
  assert.equal(pattern?.occurrenceCount, 4);
  assert.equal(pattern?.isSubscriptionLike, false);
  assert.equal(pattern?.confidence, 0.9);
});

test("collapses same-day duplicates and requires three distinct dates", () => {
  assert.equal(
    detect([
      occurrence("2026-06-01"),
      occurrence("2026-06-01"),
      occurrence("2026-07-01"),
    ]),
    undefined,
  );
});

test("keeps unstable monthly amounts recurring but not subscription-like", () => {
  const pattern = detect([
    occurrence("2026-01-01", 1_000),
    occurrence("2026-02-01", 3_000),
    occurrence("2026-03-01", 1_500),
  ]);

  assert.equal(pattern?.cadence, "monthly");
  assert.equal(pattern?.amountStable, false);
  assert.equal(pattern?.isSubscriptionLike, false);
});

test("rejects irregular, cross-currency, malformed, and out-of-window evidence", () => {
  assert.equal(
    detect([
      occurrence("2026-01-01"),
      occurrence("2026-01-20"),
      occurrence("2026-03-01"),
    ]),
    undefined,
  );
  assert.equal(
    detect([
      occurrence("2026-01-01"),
      occurrence("2026-02-01", 2_000, { currency: "USD" }),
      occurrence("not-a-date"),
      occurrence("2026-03-01"),
    ]),
    undefined,
  );
  assert.equal(
    detect([
      occurrence("2023-01-01"),
      occurrence("2025-01-01"),
      occurrence("2026-01-01"),
    ]),
    undefined,
  );
});

test("preserves explicit merchant-rule flags and records pattern conflicts", () => {
  const pattern = detect([
    occurrence("2026-01-01"),
    occurrence("2026-02-01"),
    occurrence("2026-03-01"),
  ]);
  assert.ok(pattern);

  const resolved = resolveExpenseSuggestion(
    {
      source: "user_rule",
      confidence: 1,
      merchantRuleId: "merchant-rule",
      isRecurring: false,
      isSubscription: false,
    },
    pattern,
  );

  assert.equal(resolved.suggestion?.source, "user_rule");
  assert.equal(resolved.suggestion?.isRecurring, false);
  assert.equal(resolved.suggestion?.isSubscription, false);
  assert.equal(resolved.recurrencePattern?.conflictsWithMerchantRule, true);
});

test("creates editable pattern defaults when no merchant rule exists", () => {
  const pattern = detect([
    occurrence("2026-01-01"),
    occurrence("2026-02-01"),
    occurrence("2026-03-01"),
  ]);
  const resolved = resolveExpenseSuggestion(undefined, pattern);

  assert.equal(resolved.suggestion?.source, "recurring_pattern");
  assert.equal(resolved.suggestion?.isRecurring, true);
  assert.equal(resolved.suggestion?.isSubscription, true);
  assert.equal(resolved.recurrencePattern?.cadence, "monthly");
});
