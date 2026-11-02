import assert from "node:assert/strict";
import test from "node:test";
import { buildFinancialReport, reportCsv, type ReportInput, type ReportExpense } from "./report";
import { financialYear, monthPeriod, periodBounds, sydneyDate } from "./period";
import { invoiceGstRate, assertInvoiceGstSupported } from "./gst";
import { receiptGstAllocations } from "./receipt-gst";
import { cashBasFromReport } from "./bas-cash";
import type { FinancialInvoice, Movement, Receipt } from "./types";

function movement(id: string, amountMinor: number, kind: Movement["kind"], fields: Partial<Movement> = {}): Movement { return { id, accountId: "bank", date: "2026-07-15", amountMinor, currency: "AUD", description: id, fingerprint: id, occurrence: 0, sourceRow: 1, sourceHash: "synthetic", kind, revision: 0, ...fields }; }
const invoice: FinancialInvoice = { id: "june", number: "INV-JUNE", issueDate: "2026-06-30", totalMinor: 220000, taxMinor: 0, amountPaidMinor: 120000, balanceDueMinor: 100000, ledgerPaidMinor: 120000, legacyUndatedMinor: 0, status: "partially_paid" };
const receipt: Receipt = { id: "july", date: "2026-07-01", accountId: "bank", amountMinor: 120000, evidence: "Synthetic remittance", source: "statement", movementId: "deposit", allocations: [{ invoiceId: "june", amountMinor: 120000 }], createdAt: "2026-07-02", createdBy: "fixture" };
const expense: ReportExpense = { id: "software-expense", financeMovementId: "software", date: "2026-07-15", merchantName: "Synthetic software", amountMinor: 11000, businessUsePercent: 75, categoryId: "software", gstTreatment: "taxable_purchase", taxInvoiceStatus: "attached", receiptFileId: "receipt-file", reviewStatus: "reviewed", gstRegistrationStatusAtCalculation: "not_registered" };
function fixture(): ReportInput { return { period: financialYear(2026, "2026-10-22"), accounts: [{ id: "bank", label: "Synthetic bank", type: "bank", currency: "AUD", mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit" } }], imports: [{ id: "source", accountId: "bank", sourceHash: "synthetic", mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit" }, start: "2026-07-01", end: "2026-10-22", rowCount: 7, debitMinor: 0, creditMinor: 0, sourceRows: [], completeDays: true, control: { state: "balanced", openingMinor: 0, closingMinor: 0, movementMinor: 0, varianceMinor: 0, balanceBreaks: 0, note: "synthetic controls" }, createdAt: "fixture", createdBy: "fixture" }], incompleteImports: 0, receipts: [receipt], invoices: [invoice], expenses: [expense], categoryNames: { software: "Software" }, registration: { status: "not_registered" }, gstEvidence: { currentStatusEvidence: "Synthetic status", obligationStatus: "unresolved" }, movements: [movement("deposit", 120000, "business_receipt", { date: receipt.date, receiptId: receipt.id }), movement("software", -11000, "expense", { businessUseBps: 7500, expenseId: expense.id, evidence: "Synthetic work use" }), movement("refund", 2200, "supplier_refund", { refundOf: "software", businessUseBps: 10000, evidence: "Synthetic supplier refund" }), movement("asset", -55000, "expense", { businessUseBps: 7500, taxTreatment: "asset_review", category: "Equipment", evidence: "Synthetic WiFi equipment; allowance unconfirmed" }), movement("salary", 50000, "salary"), movement("transfer-a", -10000, "transfer"), movement("transfer-b", 10000, "transfer", { accountId: "card" })] }; }

test("Sydney financial years and 23/25-hour DST days use civil midnight", () => {
  assert.equal(sydneyDate(new Date("2026-06-30T14:00:00Z")), "2026-07-01");
  assert.deepEqual(periodBounds(financialYear(2025)), { start: new Date("2025-06-30T14:00:00Z"), endExclusive: new Date("2026-06-30T14:00:00Z") });
  const spring = periodBounds({ start: "2026-10-04", end: "2026-10-04", label: "DST start" }); assert.equal((+spring.endExclusive - +spring.start) / 3600000, 23);
  const autumn = periodBounds({ start: "2026-04-05", end: "2026-04-05", label: "DST end" }); assert.equal((+autumn.endExclusive - +autumn.start) / 3600000, 25);
  assert.equal(monthPeriod("2028-02").end, "2028-02-29"); assert.throws(() => monthPeriod("2026-13"));
});
test("cash income uses receipt date and excludes prior-year issue dates and forecasts", () => {
  const data = fixture(), current = buildFinancialReport(data); assert.equal(current.totals.receivedMinor, 120000); assert.equal(current.totals.datedLedgerRemainingMinor, 100000);
  const prior = buildFinancialReport({ ...data, period: financialYear(2025) }); assert.equal(prior.totals.receivedMinor, 0); assert.equal(prior.totals.datedLedgerRemainingMinor, 220000); assert.equal(prior.invoices[0].currentBalanceMinor, 100000);
});
test("confirmed native expense is counted once; refund uses original work use; capital is not an operating deduction", () => {
  const report = buildFinancialReport(fixture()); assert.equal(report.costs.length, 3); assert.equal(report.totals.grossCostMinor, 63800); assert.equal(report.totals.workCostMinor, 47850); assert.equal(report.totals.privateCostMinor, 15950); assert.equal(report.totals.operatingMinor, 6600); assert.equal(report.totals.capitalMinor, 41250); assert.equal(report.totals.allowanceMinor, 0); assert.equal(report.totals.indicativeProfitMinor, 113400); assert.equal(report.totals.cashSurplusMinor, 72150); assert.equal(report.exclusions.find((e) => e.kind === "salary")!.netMinor, 50000); assert.equal(report.exclusions.find((e) => e.kind === "transfer")!.netMinor, 0);
  assert.ok(report.exceptions.some((e) => e.includes("Capital allowance is unresolved")));
});
test("GST registration is recomputed; unsupported attached status without file gives no credit", () => {
  const data = fixture(); data.registration = { status: "registered", effectiveFrom: "2026-07-01" }; data.expenses[0] = { ...expense, gstRegistrationStatusAtCalculation: "registered", gstRegistrationEffectiveFromAtCalculation: "2026-07-01" };
  const report = buildFinancialReport(data); assert.equal(report.totals.gstCreditMinor, 600); assert.equal(report.totals.operatingMinor, 6000);
  data.expenses[0] = { ...data.expenses[0], receiptFileId: undefined }; const missing = buildFinancialReport(data); assert.equal(missing.totals.gstCreditMinor, 0); assert.ok(missing.exceptions.some((e) => e.includes("GST credit")));
});
test("unlinked or excessive refunds are exceptions rather than invented deductions", () => {
  const data = fixture(); data.movements.find((m) => m.id === "refund")!.amountMinor = 11001; const report = buildFinancialReport(data); assert.equal(report.totals.operatingMinor, 8250); assert.ok(report.exceptions.some((e) => e.includes("refund amount is unsupported")));
});
test("legacy flags, reversed receipts and gaps remain visible", () => {
  const data = fixture(); data.invoices[0] = { ...invoice, legacyUndatedMinor: 1000 }; data.receipts[0] = { ...receipt, reversedBy: "correction" }; data.imports[0].completeDays = false;
  const report = buildFinancialReport(data); assert.equal(report.totals.receivedMinor, 0); assert.equal(report.totals.undatedPaidMinor, 1000); assert.equal(report.coverage[0].throughPeriod, false); assert.equal(report.status, "qualified");
});
test("CSV shares exact totals and neutralizes formula-like evidence", () => {
  const data = fixture(); data.receipts[0] = { ...receipt, evidence: "=HYPERLINK(\"x\")" }; const report = buildFinancialReport(data), csv = reportCsv(report);
  assert.ok(csv.includes('"receivedMinor","120000"')); assert.ok(csv.includes('"operatingMinor","6600"')); assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('"refund:refund"'));
});
test("GST default cannot create GST without effective-dated registration", () => {
  const tax = { taxType: "GST" as const, defaultRate: 0.1 };
  assert.equal(invoiceGstRate({ tax }, "2026-10-22"), 0);
  assert.equal(invoiceGstRate({ tax: { ...tax, gstRegistration: { status: "not_registered" } } }, "2026-10-22"), 0);
  const settings = { tax: { ...tax, gstRegistration: { status: "registered" as const, effectiveFrom: "2026-10-23" } } };
  assert.equal(invoiceGstRate(settings, "2026-10-22"), 0); assert.equal(invoiceGstRate(settings, "2026-10-23"), 0.1);
  assert.throws(() => assertInvoiceGstSupported(100, settings, "2026-10-22")); assert.doesNotThrow(() => assertInvoiceGstSupported(0, undefined, "2026-10-22"));
});
test("split receipts round cumulatively to invoice GST with no lost or duplicated cents", () => {
  const inv = { ...invoice, totalMinor: 11, taxMinor: 1 }; const receipts = [0, 1, 2].map((n) => ({ ...receipt, id: `receipt-${n}`, amountMinor: n === 2 ? 5 : 3, allocations: [{ invoiceId: inv.id, amountMinor: n === 2 ? 5 : 3 }] }));
  assert.deepEqual([...receiptGstAllocations(receipts, [inv]).values()], [0, 1, 0]);
});
test("cash BAS uses allocated dated receipts, fails closed on coverage or obligation unknowns", () => {
  const data = fixture(); data.movements = []; data.expenses = []; data.invoices = [{ ...invoice, totalMinor: 220000, taxMinor: 20000 }]; data.registration = { status: "registered", effectiveFrom: "2026-01-01" }; data.gstEvidence = { currentStatusEvidence: "Synthetic", obligationStatus: "reviewed", obligationEvidence: "Synthetic accountant confirmation" }; data.period = { start: "2026-07-01", end: "2026-09-30", label: "Synthetic quarter" };
  const report = buildFinancialReport(data), settings = { accountingBasis: "cash" as const, cadence: "quarterly" as const, reportingMethod: "simpler_bas" as const }; const bas = cashBasFromReport(report, settings);
  assert.equal(bas.status, "ready"); assert.equal(bas.g1TotalSalesMinor, 120000); assert.equal(bas.oneAGstOnSalesMinor, 10909); assert.equal(bas.netGstMinor, 10909); assert.equal(report.totals.indicativeProfitMinor, 109091);
  report.coverage[0].throughPeriod = false; assert.equal(cashBasFromReport(report, settings).netGstMinor, null);
  report.coverage[0].throughPeriod = true; report.gst.evidence.obligationStatus = "unresolved"; assert.equal(cashBasFromReport(report, settings).oneAGstOnSalesMinor, null);
});

test("split full refunds cancel work GST and capital allowance exactly across reporting periods", () => {
  for (const treatment of ["operating", "asset_review"] as const) {
    const data = fixture(); data.receipts = []; data.invoices = []; data.registration = { status: "registered", effectiveFrom: "2026-07-01" };
    data.expenses = [{ ...expense, id: "purchase", financeMovementId: "original", amountMinor: 10300, businessUsePercent: 50, date: "2026-07-01", gstRegistrationStatusAtCalculation: "registered", gstRegistrationEffectiveFromAtCalculation: "2026-07-01" }];
    data.movements = [movement("original", -10300, "expense", { expenseId: "purchase", date: "2026-07-01", businessUseBps: 5000, taxTreatment: treatment, ...(treatment === "asset_review" ? { allowanceMinor: 1000 } : {}), evidence: "Synthetic original work/GST and allowance evidence" }), ...[3333, 3333, 3634].map((n, i) => movement(`refund-${i}`, n, "supplier_refund", { date: ["2026-07-02", "2026-08-01", "2026-09-01"][i], refundOf: "original", evidence: "Synthetic full refund split across months" }))];
    const full = buildFinancialReport(data); for (const key of ["grossCostMinor", "workCostMinor", "privateCostMinor", "gstCreditMinor", "operatingMinor", "capitalMinor", "allowanceMinor", "indicativeProfitMinor"] as const) assert.equal(full.totals[key], 0, `${treatment}:${key}`);
    const months = ["2026-07", "2026-08", "2026-09"].map((month) => buildFinancialReport({ ...data, period: monthPeriod(month) }));
    for (const key of ["grossCostMinor", "workCostMinor", "privateCostMinor", "gstCreditMinor", "operatingMinor", "capitalMinor", "allowanceMinor"] as const) assert.equal(months.reduce((sum, r) => sum + r.totals[key], 0), 0, `monthly ${treatment}:${key}`);
    assert.equal(months[0].totals.workCostMinor, 3483); assert.equal(months[1].totals.workCostMinor, -1666); assert.equal(months[2].totals.workCostMinor, -1817);
    assert.equal(months[1].totals.gstCreditMinor, -152);
    if (treatment === "asset_review") { assert.equal(months[0].totals.allowanceMinor, 676); assert.equal(months[1].totals.allowanceMinor, -323); assert.equal(months[2].totals.allowanceMinor, -353); }
  }
});

test("cash BAS requires status and obligation evidence and rejects unsupported refund/source gaps", () => {
  const data = fixture(); data.movements = []; data.expenses = []; data.invoices = [{ ...invoice, taxMinor: 20000 }]; data.registration = { status: "registered", effectiveFrom: "2026-01-01" }; data.gstEvidence = { currentStatusEvidence: "Synthetic status proof", obligationStatus: "reviewed", obligationEvidence: "Synthetic obligation assessment" }; data.period = { start: "2026-07-01", end: "2026-09-30", label: "Quarter" };
  const settings = { accountingBasis: "cash" as const, cadence: "quarterly" as const, reportingMethod: "simpler_bas" as const };
  assert.equal(cashBasFromReport(buildFinancialReport(data), settings).status, "ready");
  for (const evidence of [{ obligationStatus: "reviewed" as const }, { ...data.gstEvidence, currentStatusEvidence: " " }, { ...data.gstEvidence, obligationEvidence: " " }]) {
    const bas = cashBasFromReport(buildFinancialReport({ ...data, gstEvidence: evidence }), settings); assert.equal(bas.status, "needs_review"); assert.equal(bas.g1TotalSalesMinor, null); assert.equal(bas.oneAGstOnSalesMinor, null); assert.equal(bas.oneBGstOnPurchasesMinor, null); assert.equal(bas.netGstMinor, null); assert.ok(bas.reviewReasons.some((r) => /evidence/.test(r)));
  }
  data.movements.push(movement("unsupported-refund", 100, "supplier_refund", { refundOf: "missing" }));
  const unsupported = cashBasFromReport(buildFinancialReport(data), settings); assert.equal(unsupported.status, "needs_review"); assert.equal(unsupported.netGstMinor, null); assert.ok(unsupported.reviewReasons.some((r) => r.includes("Refund unsupported-refund")));
  data.movements = []; data.incompleteImports = 1; const incomplete = cashBasFromReport(buildFinancialReport(data), settings); assert.equal(incomplete.netGstMinor, null); assert.ok(incomplete.reviewReasons.some((r) => r.includes("incomplete imports")));
});

test("evidenced business refund without an identified original adjusts work cash but leaves GST unresolved", () => {
  const data = fixture(); data.expenses = []; data.movements = [movement("reviewed-refund", 103, "supplier_refund", { category: "Software", businessUseBps: 7500, taxTreatment: "operating", evidence: "Synthetic owner-reviewed business subscription refund; original not uniquely established", reviewedBy: "owner", reviewedAt: "2026-10-22" })];
  const report = buildFinancialReport(data); assert.equal(report.totals.grossCostMinor, -103); assert.equal(report.totals.workCostMinor, -77); assert.equal(report.totals.privateCostMinor, -26); assert.equal(report.totals.operatingMinor, -77); assert.equal(report.totals.gstCreditMinor, 0); assert.ok(report.materialSourceExceptions.some((e) => e.includes("original purchase")));
  const unreviewed = buildFinancialReport({ ...data, movements: [{ ...data.movements[0], reviewedBy: undefined }] }); assert.equal(unreviewed.totals.workCostMinor, 0);
});


test("foreign invoice values never enter AUD invoice balance totals", () => {
 const data=fixture();data.invoices.push({...invoice,id:"nzd",number:"NZD-1",currency:"NZD",amountPaidMinor:0,totalMinor:999999,balanceDueMinor:999999,ledgerPaidMinor:0});
 const report=buildFinancialReport(data);assert.equal(report.invoices.length,1);assert.equal(report.totals.datedLedgerRemainingMinor,100000);assert.ok(report.exceptions.some(e=>e.includes("non-AUD invoice(s) excluded")));assert.ok(!reportCsv(report).includes('NZD-1'));
});
