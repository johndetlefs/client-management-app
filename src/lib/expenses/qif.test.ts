import assert from "node:assert/strict";
import test from "node:test";

import { parseExpenseBankCsv } from "./csv";
import { ExpenseQifParseError, parseExpenseBankQif } from "./qif";

test("parses Australian bank QIF into shared deterministic rows", () => {
  const result = parseExpenseBankQif(
    [
      "!Type:Bank",
      "D5/6/2026",
      "T-1,234.56",
      "PSynthetic Hosting",
      "LBusiness",
      "LSoftware",
      "^",
      "D06/06/2026",
      "T+25.4",
      "MRefund from Synthetic Hosting",
      "LRefund",
      "^",
    ].join("\r\n"),
    { sourceAccountKey: "personal-visa" },
  );

  assert.deepEqual(
    result.rows.map((row) => ({
      postedDate: row.postedDate,
      amountMinor: row.amountMinor,
      direction: row.direction,
      description: row.rawDescription,
      category: row.bankCategory,
      subCategory: row.bankSubCategory,
    })),
    [
      {
        postedDate: "2026-06-05",
        amountMinor: 123456,
        direction: "debit",
        description: "Synthetic Hosting",
        category: "Business",
        subCategory: "Software",
      },
      {
        postedDate: "2026-06-06",
        amountMinor: 2540,
        direction: "credit",
        description: "Refund from Synthetic Hosting",
        category: "Refund",
        subCategory: undefined,
      },
    ],
  );
  assert.equal(result.counts.totalRows, 2);
  assert.match(result.importFingerprint, /^[a-f0-9]{64}$/);
});

test("assigns occurrence indexes and fingerprints consistently with CSV", () => {
  const qif = parseExpenseBankQif(
    [
      "!Type:Bank",
      "D29/07/2026",
      "T-25.00",
      "PSynthetic Hosting",
      "^",
      "D29/07/2026",
      "T-25.00",
      "PSynthetic Hosting",
      "^",
    ].join("\n"),
    { sourceAccountKey: "personal-visa" },
  );
  const csv = parseExpenseBankCsv(
    [
      "Date,Description,Debit,Credit,Category,SubCategory",
      "29/07/2026,Synthetic Hosting,25.00,,,",
    ].join("\n"),
    { sourceAccountKey: "personal-visa" },
  );

  assert.deepEqual(
    qif.rows.map((row) => row.occurrenceIndex),
    [1, 2],
  );
  assert.equal(
    qif.rows[0].transactionFingerprint,
    csv.rows[0].transactionFingerprint,
  );
});

test("fails closed on unsupported or malformed QIF records", () => {
  const invalidInputs = [
    ["!Type:Cash", "D29/07/2026", "T-1.00", "PBad header", "^"],
    ["!Type:Bank", "D29/07/2026", "T0.00", "PZero", "^"],
    ["!Type:Bank", "D31/02/2026", "T-1.00", "PBad date", "^"],
    ["!Type:Bank", "D29/07/2026", "T-1.00", "SCategory", "^"],
    ["!Type:Bank", "D29/07/2026", "T-1.00", "PNo terminator"],
    ["!Type:Bank", "D29/07/2026", "T-1.00", "^"],
  ];

  for (const lines of invalidInputs) {
    assert.throws(
      () => parseExpenseBankQif(lines.join("\n")),
      ExpenseQifParseError,
      lines.join("|"),
    );
  }
});
