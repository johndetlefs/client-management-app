import assert from "node:assert/strict";
import test from "node:test";

import {
  ExpenseCsvParseError,
  parseExpenseBankCsv,
} from "./csv";

const HEADER = "Date,Description,Debit,Credit,Category,SubCategory";

test("accepts bank cents-only debit and credit amounts", () => {
  const result = parseExpenseBankCsv(
    [
      HEADER,
      "29/07/2026,Cents debit,.54,,Business,Software",
      "28/07/2026,Single decimal debit,.3,,Business,Software",
      "27/07/2026,Explicit zero debit,0.01,,Business,Software",
      "26/07/2026,Cents credit,,$.99,Refund,Software",
    ].join("\r\n"),
    { sourceAccountKey: "synthetic-account" },
  );

  assert.deepEqual(
    result.rows.map((row) => ({
      amountMinor: row.amountMinor,
      direction: row.direction,
    })),
    [
      { amountMinor: 54, direction: "debit" },
      { amountMinor: 30, direction: "debit" },
      { amountMinor: 1, direction: "debit" },
      { amountMinor: 99, direction: "credit" },
    ],
  );
  assert.equal(result.counts.parsedRows, 4);
});

test("keeps malformed and non-positive cents-only amounts invalid", () => {
  const invalidAmounts = [".", ".000", "-.54", ".00"];

  for (const amount of invalidAmounts) {
    assert.throws(
      () =>
        parseExpenseBankCsv(
          [HEADER, `29/07/2026,Invalid amount,${amount},,Business,Software`].join(
            "\n",
          ),
        ),
      (error: unknown) =>
        error instanceof ExpenseCsvParseError &&
        error.issues.some((issue) => issue.message === "Invalid Debit amount"),
      amount,
    );
  }
});
