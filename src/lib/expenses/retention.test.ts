import assert from "node:assert/strict";
import test from "node:test";

import {
  createPersonalDetailRetentionDate,
  EXPENSE_CANDIDATE_SENSITIVE_FIELDS,
  shouldMinimizeExpenseCandidate,
} from "./retention";

test("sets the personal detail deadline exactly 90 days after review", () => {
  const reviewedAt = new Date("2026-07-29T01:02:03.000Z");
  assert.equal(
    createPersonalDetailRetentionDate(reviewedAt).toISOString(),
    "2026-10-27T01:02:03.000Z",
  );
});

test("minimizes only due active Personal or Ignore candidates", () => {
  const due = new Date("2026-07-01T00:00:00.000Z");
  const now = new Date("2026-07-29T00:00:00.000Z");

  assert.equal(
    shouldMinimizeExpenseCandidate({
      reviewStatus: "personal",
      retentionStatus: "active",
      retentionExpiresAt: due,
    }, now),
    true,
  );
  assert.equal(
    shouldMinimizeExpenseCandidate({
      reviewStatus: "ignored",
      retentionStatus: "active",
      retentionExpiresAt: due,
    }, now),
    true,
  );
  assert.equal(
    shouldMinimizeExpenseCandidate({
      reviewStatus: "business",
      retentionStatus: "active",
      retentionExpiresAt: due,
    }, now),
    false,
  );
  assert.equal(
    shouldMinimizeExpenseCandidate({
      reviewStatus: "personal",
      retentionStatus: "minimized",
      retentionExpiresAt: due,
    }, now),
    false,
  );
});

test("sensitive-field list excludes exact and possible dedupe fields", () => {
  const fields = new Set<string>(EXPENSE_CANDIDATE_SENSITIVE_FIELDS);
  for (const preserved of [
    "transactionFingerprint",
    "occurrenceIndex",
    "sourceAccountKey",
    "postedDate",
    "direction",
    "amountMinor",
    "reviewStatus",
  ]) {
    assert.equal(fields.has(preserved), false, preserved);
  }
});
