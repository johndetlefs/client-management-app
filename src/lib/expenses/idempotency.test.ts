import assert from "node:assert/strict";
import test from "node:test";

import type { ParsedExpenseCsvRow } from "./csv";
import { resolveExpenseImportIdempotency } from "./idempotency";

test("a minimized candidate with occurrence index zero remains an exact duplicate", async () => {
  const row: ParsedExpenseCsvRow = {
    rowNumber: 2,
    postedDate: "2026-07-29",
    rawDescription: "Synthetic hosting",
    normalizedMerchantName: "Synthetic Hosting",
    amountMinor: 2500,
    currency: "AUD",
    direction: "debit",
    transactionFingerprint: "fingerprint-zero",
    occurrenceIndex: 0,
  };
  const existingDoc = {
    id: "candidate-zero",
    data: () => ({
      id: "candidate-zero",
      postedDate: row.postedDate,
      amountMinor: row.amountMinor,
      direction: row.direction,
      transactionFingerprint: row.transactionFingerprint,
      occurrenceIndex: 0,
      reviewStatus: "personal",
      retentionStatus: "minimized",
    }),
  };
  const emptyCollection = {
    where: () => ({ get: async () => ({ docs: [] }) }),
  };
  const candidateCollection = {
    where: (field: string) => ({
      get: async () => ({
        docs:
          field === "transactionFingerprint" || field === "postedDate"
            ? [existingDoc]
            : [],
      }),
    }),
  };

  const result = await resolveExpenseImportIdempotency({
    refs: {
      candidates: candidateCollection,
      expenses: emptyCollection,
    } as never,
    rows: [row],
  });

  assert.equal(result.candidateDecisions.length, 0);
  assert.deepEqual(result.skippedDuplicates, [
    {
      rowNumber: 2,
      transactionFingerprint: "fingerprint-zero",
      occurrenceIndex: 0,
      existingCandidateId: "candidate-zero",
      existingExpenseId: undefined,
    },
  ]);
});
