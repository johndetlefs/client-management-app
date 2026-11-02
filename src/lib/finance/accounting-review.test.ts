import assert from "node:assert/strict";
import test from "node:test";
import { exclusiveTaxMinor } from "./money";
import { assertDraftTaxCurrent, refreshDraftTaxLines } from "./gst";
import { nonCashAttributionReasons } from "./bas-non-cash";
import { validateReceipt } from "./ledger";
import { calculateExpenseAmounts } from "@/lib/expenses/calculations";
import { buildBasPreparationSummary } from "@/lib/expenses/bas";
import type { FinancialInvoice, Receipt } from "./types";
const date = "2026-11-02";
const settings = { tax: { taxType: "GST" as const, defaultRate: 0.1, gstRegistration: { status: "registered" as const, effectiveFrom: "2026-01-01" } } };
const lines = [{ gstApplicable: true, subtotalMinor: 100000, taxMinor: 0, totalMinor: 100000 }, { gstApplicable: false, subtotalMinor: 10000, taxMinor: 0, totalMinor: 10000 }];
const inv: FinancialInvoice = { id: "invoice", number: "SYN", clientId: "client", currency: "AUD", issueDate: "2026-10-06", totalMinor: 110000, taxMinor: 10000, amountPaidMinor: 55000, ledgerPaidMinor: 55000, legacyUndatedMinor: 0, balanceDueMinor: 55000, status: "partially_paid" };
const receipt: Receipt = { id: "receipt", date: "2026-09-15", amountMinor: 55000, accountId: "bank", source: "manual", evidence: "Synthetic advance", allocations: [{ invoiceId: inv.id, amountMinor: 55000 }], createdAt: date, createdBy: "owner" };
const sept = { startDate: "2026-07-01", endDate: "2026-09-30", label: "September quarter" }, oct = { startDate: "2026-10-01", endDate: "2026-12-31", label: "December quarter" };
test("tax is integer-cent half-up for GST-exclusive lines including large supported amounts", () => {
  for (const [net, expected] of [[1,0],[4,0],[5,1],[15,2],[333,33],[100000,10000],[9007199254740000,900719925474000]]) assert.equal(exclusiveTaxMinor(net,0.1),expected);
  assert.throws(() => exclusiveTaxMinor(1.5,0.1)); assert.throws(() => exclusiveTaxMinor(-1,0.1));
});
test("GST-inclusive costs separate GST instead of adding another ten percent", () => {
  const amount = calculateExpenseAmounts({ amountMinor: 110000, businessUsePercent: 100, expenseDate: date, gstTreatment: "taxable_purchase", taxInvoiceStatus: "attached", gstRegistration: settings.tax.gstRegistration });
  assert.equal(amount.gstIncludedAmountMinor,10000); assert.equal(amount.gstAmountMinor,10000); assert.equal(110000-amount.gstAmountMinor,100000);
});
test("stale zero-GST invoice/quote totals cannot issue after registration, and GST-free lines stay zero", () => {
  const old = { lines, subtotalMinor: 110000, taxMinor: 0, totalMinor: 110000 };
  assert.throws(() => assertDraftTaxCurrent(old,settings,date),/Refresh totals/);
  const refreshed = refreshDraftTaxLines(lines,settings,date);
  assert.deepEqual(refreshed.map(l=>l.taxMinor),[10000,0]);
  assert.doesNotThrow(() => assertDraftTaxCurrent({lines:refreshed,subtotalMinor:110000,taxMinor:10000,totalMinor:120000},settings,date));
  assert.equal(lines[0].taxMinor,0);
  assert.throws(() => assertDraftTaxCurrent({lines:refreshed,subtotalMinor:110000,taxMinor:10000,totalMinor:120000},{tax:{...settings.tax,gstRegistration:{status:"not_registered"}}},date),/Refresh totals/);
});
test("actual receipts reject future dates rather than settling invoices ahead of cash", () => {
  assert.throws(()=>validateReceipt({...receipt,date:"9999-12-31"}),/future date/);
  assert.doesNotThrow(()=>validateReceipt(receipt));
});
test("earlier consideration qualifies both the payment and invoice noncash BAS periods", () => {
  for (const period of [sept,oct]) assert.ok(nonCashAttributionReasons([inv],[receipt],period).some(s=>s.includes("predates")));
  assert.deepEqual(nonCashAttributionReasons([inv],[{...receipt,date:"2026-10-07"}],oct),[]);
  assert.deepEqual(nonCashAttributionReasons([inv],[{...receipt,reversedBy:"correction"}],sept),[]);
});
test("unallocated and undated payments cannot silently disappear from noncash attribution", () => {
  assert.ok(nonCashAttributionReasons([], [{...receipt,allocations:[]}],sept).some(s=>s.includes("Unallocated")));
  assert.ok(nonCashAttributionReasons([{...inv,legacyUndatedMinor:1000}],[],sept).some(s=>s.includes("Undated")));
});
test("qualified noncash attribution withholds G1 1A and net rather than assigning today's period", () => {
 const result=buildBasPreparationSummary({settings:{accountingBasis:"non_cash",cadence:"quarterly",reportingMethod:"simpler_bas"},registration:settings.tax.gstRegistration,period:sept,expenses:[],invoices:[],attributionReviewReasons:nonCashAttributionReasons([inv],[receipt],sept)});
 assert.equal(result.status,"needs_review");assert.equal(result.g1TotalSalesMinor,null);assert.equal(result.oneAGstOnSalesMinor,null);assert.equal(result.netGstMinor,null);
});
