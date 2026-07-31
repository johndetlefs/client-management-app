import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import {
  buildAccountantWorkbook,
  calculateExportTotals,
  type AccountantExportInput,
} from "./accountant-export";

const INPUT: AccountantExportInput = {
  periodStartDate: "2026-05-01",
  periodEndDate: "2026-05-31",
  generatedAt: "2026-06-01T00:00:00.000Z",
  expenses: [
    {
      id: "expense-b",
      date: "2026-05-20",
      merchantName: "Mixed Merchant",
      categoryName: "Software and subscriptions",
      amountMinor: 11000,
      currency: "AUD",
      businessUsePercent: 50,
      claimableAmountMinor: 5500,
      privateAmountMinor: 5500,
      gstTreatment: "taxable_purchase",
      gstIncludedAmountMinor: 500,
      gstAmountMinor: 0,
      gstCreditStatus: "not_registered",
      gstRegistrationReviewRequired: false,
      taxInvoiceStatus: "attached",
      isSubscription: true,
      isRecurring: true,
      importBatchId: "batch-2",
      sourceFileId: "file-2",
      sourceAccountKey: "personal-card",
      transactionFingerprint: "fingerprint-b",
      occurrenceIndex: 0,
    },
    {
      id: "expense-a",
      date: "2026-05-02",
      merchantName: "Review Merchant",
      categoryName: "Accountant review",
      amountMinor: 12345,
      currency: "AUD",
      businessUsePercent: 100,
      claimableAmountMinor: 12345,
      privateAmountMinor: 0,
      gstTreatment: "review_required",
      gstIncludedAmountMinor: 0,
      gstAmountMinor: 0,
      gstCreditStatus: "review_required",
      gstRegistrationReviewRequired: true,
      taxInvoiceStatus: "missing",
      isSubscription: false,
      isRecurring: false,
      importBatchId: "batch-1",
      sourceFileId: "file-1",
      sourceAccountKey: "personal-card",
      transactionFingerprint: "fingerprint-a",
      occurrenceIndex: 1,
    },
  ],
  income: [
    {
      id: "invoice-b",
      issueDate: "2026-05-25",
      invoiceNumber: "INV-002",
      clientName: "Paid Client",
      status: "paid",
      subtotalMinor: 20000,
      gstMinor: 2000,
      totalMinor: 22000,
      amountPaidMinor: 22000,
      balanceDueMinor: 0,
      currency: "AUD",
    },
    {
      id: "invoice-a",
      issueDate: "2026-05-10",
      invoiceNumber: "INV-001",
      clientName: "Open Client",
      status: "sent",
      subtotalMinor: 10000,
      gstMinor: 1000,
      totalMinor: 11000,
      amountPaidMinor: 0,
      balanceDueMinor: 11000,
      currency: "AUD",
    },
  ],
  importSources: [
    {
      id: "batch-2",
      sourceFormat: "csv",
      sourceAccountKey: "personal-card",
      sourceAccountLabel: "Personal card",
      statementStartDate: "2026-05-01",
      statementEndDate: "2026-05-31",
      status: "ready_for_review",
      totalRows: 2,
      parsedRows: 2,
      candidateRows: 2,
      duplicateRows: 0,
      failedRows: 0,
      sourceFileId: "file-2",
    },
    {
      id: "batch-1",
      sourceFormat: "csv",
      sourceAccountKey: "personal-card",
      sourceAccountLabel: "Personal card",
      statementStartDate: "2026-04-01",
      statementEndDate: "2026-04-30",
      status: "reviewed",
      totalRows: 10,
      parsedRows: 10,
      candidateRows: 8,
      duplicateRows: 2,
      failedRows: 0,
      sourceFileId: "file-1",
    },
  ],
};

test("accountant workbook has stable sheets, ordering, and reconciled totals", async () => {
  const result = await buildAccountantWorkbook(INPUT);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    result.bytes as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    [
      "Overview",
      "Expenses",
      "Income",
      "Review Needed",
      "Import Sources",
    ],
  );
  assert.deepEqual(result.totals, {
    expenseCount: 2,
    grossExpensesMinor: 23345,
    claimableExpensesMinor: 17845,
    privateAdjustmentMinor: 5500,
    potentialGstMinor: 500,
    claimableGstMinor: 0,
    incomeInvoiceCount: 2,
    invoicedIncomeMinor: 33000,
    invoicedGstMinor: 3000,
    cumulativePaidMinor: 22000,
    outstandingIncomeMinor: 11000,
    reviewNeededCount: 2,
  });

  const expenses = workbook.getWorksheet("Expenses");
  assert.ok(expenses);
  assert.equal(expenses.getCell("A2").value, "2026-05-02");
  assert.equal(expenses.getCell("B2").value, "Review Merchant");
  assert.equal(expenses.getCell("E2").value, 123.45);
  assert.equal(expenses.getCell("A3").value, "2026-05-20");
  assert.equal(expenses.getCell("H3").value, 55);
  assert.equal(expenses.getCell("D4").value, "TOTAL");
  assert.equal(expenses.getCell("E4").value, 233.45);

  const income = workbook.getWorksheet("Income");
  assert.ok(income);
  assert.equal(income.getCell("B2").value, "INV-001");
  assert.equal(income.getCell("B3").value, "INV-002");
  assert.match(String(income.getCell("J3").value), /no dated payment event/i);

  const review = workbook.getWorksheet("Review Needed");
  assert.ok(review);
  assert.equal(review.rowCount, 3);
  assert.equal(review.getCell("A2").value, "Expense");
  assert.equal(review.getCell("A3").value, "Income");

  const sources = workbook.getWorksheet("Import Sources");
  assert.ok(sources);
  assert.equal(sources.getCell("A2").value, "batch-1");
  assert.equal(sources.getCell("A3").value, "batch-2");
});

test("export totals reject non-safe minor-unit values", () => {
  assert.throws(
    () =>
      calculateExportTotals(
        [
          {
            ...INPUT.expenses[0],
            amountMinor: Number.MAX_SAFE_INTEGER + 1,
          },
        ],
        [],
        0,
      ),
    /non-safe minor-unit value/,
  );
});
