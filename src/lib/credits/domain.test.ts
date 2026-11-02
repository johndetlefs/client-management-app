import assert from "node:assert/strict";
import test from "node:test";
import { creditAmounts, creditEntry, creditState, assertInvoiceCreditTimeline } from "./domain";
import { publicStandaloneCredit, creditCsv } from "./documents";
import { buildFinancialReport, reportCsv } from "@/lib/finance/report";
import { validateAllocations } from "@/lib/finance/ledger";
import type { CreditInput, CreditSource, CreditNote, CreditInvoice, CreditRequest } from "./types";
const today = "2026-10-27";
const input = (fields: Partial<CreditInput> = {}): CreditInput => ({ id: "credit", clientId: "client", currency: "AUD", reason: "Agreed reduction", reference: "Sale", saleDate: "2026-09-01", lines: [{ description: "Service reduction", netMinor: 20000, taxMinor: 0 }], ...fields });
const note = (fields: Partial<CreditNote> = {}): CreditNote => ({ id: "credit", revision: 2, status: "issued", input: input(), client: { name: "Client", email: "client@example.test", abn: "", address: [] }, supplier: { businessName: "Studio", email: "studio@example.test", abn: "12345678901", address: "Test", phone: "", invoiceFooter: "Thank you" }, netMinor: 20000, taxMinor: 0, totalMinor: 20000, issuedAmountMinor: 20000, availableMinor: 20000, appliedMinor: 0, refundedMinor: 0, entries: [], createdAt: today, updatedAt: today, createdBy: "owner", issueDate: "2026-10-01", number: "CN-1", ...fields });
const inv = (fields: Partial<CreditInvoice> = {}): CreditInvoice => ({ id: "invoice", number: "INV-1", clientId: "client", currency: "AUD", issueDate: "2026-09-01", status: "sent", totalMinor: 100000, amountPaidMinor: 0, creditAppliedMinor: 0, balanceDueMinor: 100000, ...fields });
const request = (fields: Partial<CreditRequest> = {}): CreditRequest => ({ id: "apply", kind: "allocation", amountMinor: 20000, invoiceId: "invoice", date: today, reference: "Agreement", reason: "Apply client credit", ...fields });
const apply = (n: CreditNote, r: CreditRequest, i?: CreditInvoice) => { const result = creditEntry(n, r, i, today, "owner"); return { ...n, ...result.state, entries: result.reused ? n.entries : [...n.entries, result.entry] }; };
test("standalone credit has no replacement, receipt or default GST requirement", () => { const a = creditAmounts(input(), undefined, [], today); assert.equal(a.totalMinor, 20000); assert.equal(a.taxMinor, 0); assert.equal(creditState(note()).availableMinor, 20000); assert.throws(() => creditAmounts(input({ lines: [{ description: "Tax adjustment", netMinor: 20000, taxMinor: 1300 }], reference: "", saleDate: "" }), undefined, [], today), /reference/); assert.equal(creditAmounts(input({ lines: [{ description: "Actual tax", netMinor: 20000, taxMinor: 1300 }] }), undefined, [], today).taxMinor, 1300); });
test("source credits use original supply tax, respect cumulative line/gross caps and split rounding", () => {
    const source: CreditSource = { id: "original", version: "v1", clientId: "client", currency: "AUD", number: "INV-0", issueDate: "2026-01-01", totalMinor: 11, lines: [{ description: "Tiny supply", netMinor: 10, taxMinor: 1 }] };
    const issued: CreditNote[] = [];
    for (const netMinor of [3, 3, 4]) {
        const v = input({ originalInvoiceId: source.id, lines: [{ description: "Tiny reduction", netMinor, taxMinor: 999, originalLineIndex: 0 }] });
        const a = creditAmounts(v, source, issued, today);
        issued.push(note({ id: `n${netMinor}-${issued.length}`, input: { ...v, lines: a.lines }, original: source, issuedAmountMinor: a.totalMinor, ...a }));
    }
    assert.deepEqual(issued.map(c => c.taxMinor), [0, 1, 0]);
    assert.equal(issued.reduce((s, c) => s + c.totalMinor, 0), 11);
    assert.throws(() => creditAmounts(input({ originalInvoiceId: source.id, lines: [{ description: "Too much", netMinor: 1, taxMinor: 0, originalLineIndex: 0 }] }), source, issued, today), /exceeds/);
    assert.throws(() => creditAmounts(input({ clientId: "other" }), source, [], today), /client/);
});
test("unpaid 1000 less 200 applied becomes 800 due; paid 1000 leaves 200 available", () => { const n = note(); const result = creditEntry(n, request(), inv(), today, "owner"); assert.equal(inv().balanceDueMinor - result.invoiceDeltaMinor, 80000); assert.equal(result.state.availableMinor, 0); assert.equal(result.state.appliedMinor, 20000); assert.equal(n.entries.length, 0); assert.throws(() => creditEntry(n, request(), inv({ status: "paid", amountPaidMinor: 100000, balanceDueMinor: 0 }), today, "owner"), /amount due/); assert.equal(creditState(n).availableMinor, 20000); });
test("partial and full allocations, recorded refunds and reversals conserve credit", () => { let n = apply(note(), request({ amountMinor: 5000 }), inv()); n = apply(n, request({ id: "refund", kind: "refund", invoiceId: undefined, amountMinor: 15000 })); assert.deepEqual(creditState(n), { appliedMinor: 5000, refundedMinor: 15000, availableMinor: 0 }); n = apply(n, request({ id: "undo-refund", kind: "reversal", entryId: "refund", amountMinor: 0, invoiceId: undefined })); assert.equal(n.availableMinor, 15000); n = apply(n, request({ id: "rest", amountMinor: 15000 }), inv({ creditAppliedMinor: 5000, balanceDueMinor: 95000 })); assert.equal(n.appliedMinor, 20000); const undo = creditEntry(n, request({ id: "undo-apply", kind: "reversal", entryId: "apply", amountMinor: 0 }), inv({ creditAppliedMinor: 20000, balanceDueMinor: 80000 }), today, "owner"); assert.equal(undo.invoiceDeltaMinor, -5000); assert.equal(undo.state.availableMinor, 5000); assert.throws(() => creditEntry(n, request({ id: "again", kind: "reversal", entryId: "refund", amountMinor: 0 }), undefined, today, "owner"), /again/); });
test("identical request replay is reused, changed data cannot reuse identity", () => { const r = request(), n = apply(note(), r, inv()); assert.equal(creditEntry(n, r, inv({ creditAppliedMinor: 20000, balanceDueMinor: 80000 }), today, "owner").reused, true); assert.throws(() => creditEntry(n, { ...r, amountMinor: 1 }, inv(), today, "owner"), /different data/); });
test("reject cross-client/currency, draft, overavailable, oversettlement, future and fractional actions", () => {
    for (const i of [inv({ clientId: "other" }), inv({ currency: "NZD" }), inv({ status: "draft" }), inv({ balanceDueMinor: 19999 })])
        assert.throws(() => creditEntry(note(), request(), i, today, "owner"));
    for (const r of [request({ amountMinor: 20001 }), request({ amountMinor: 0 }), request({ amountMinor: 1.2 }), request({ date: "2026-11-01" }), request({ date: "2026-09-30" }), request({ reason: "" })])
        assert.throws(() => creditEntry(note(), r, inv(), today, "owner"));
});
test("dated availability cannot be overdrawn by a backdated disposition", () => { let n = apply(note(), request({ kind: "refund", invoiceId: undefined, date: "2026-10-10" })); n = apply(n, request({ id: "undo", kind: "reversal", entryId: "apply", date: "2026-10-20", amountMinor: 0 })); assert.throws(() => creditEntry(n, request({ id: "backdated", date: "2026-10-15" }), inv(), today, "owner"), /exceed/); assert.equal(creditState(n, "2026-10-15").availableMinor, 0); assert.equal(creditState(n, "2026-10-21").availableMinor, 20000); });
test("receipts cannot consume credit settlement and preserve cash separation", () => { const f = { ...inv({ creditAppliedMinor: 20000, balanceDueMinor: 80000 }), taxMinor: 0, ledgerPaidMinor: 0, legacyUndatedMinor: 0 }; const update = validateAllocations(80000, [{ invoiceId: "invoice", amountMinor: 80000 }], [f])[0]; assert.equal(update.amountPaidMinor, 80000); assert.equal(update.balanceDueMinor, 0); assert.equal(update.status, "paid"); assert.throws(() => validateAllocations(80001, [{ invoiceId: "invoice", amountMinor: 80001 }], [f]), /overpay/); });
test("historical report credits lower receivable, never create cash, retain refunds and reversal data", () => { let n = apply(note(), request({ date: "2026-10-10" }), inv()); n = apply(n, request({ id: "undo", kind: "reversal", entryId: "apply", amountMinor: 0, date: "2026-10-20" }), inv({ creditAppliedMinor: 20000, balanceDueMinor: 80000 })); const data = { creditNotes: [n], invoices: [{ ...inv(), taxMinor: 0, ledgerPaidMinor: 0, legacyUndatedMinor: 0 }], movements: [], receipts: [], accounts: [], imports: [], expenses: [], categoryNames: {}, incompleteImports: 0 }; const before = buildFinancialReport({ ...data, period: { start: "2026-10-01", end: "2026-10-15", label: "Before reversal" } }); assert.equal(before.totals.receivedMinor, 0); assert.equal(before.invoices[0].creditsAppliedThroughEndMinor, 20000); assert.equal(before.invoices[0].datedLedgerRemainingMinor, 80000); assert.equal(before.creditRegister?.[0].availableMinor, 0); const after = buildFinancialReport({ ...data, period: { start: "2026-10-01", end: today, label: "After" } }); assert.equal(after.invoices[0].datedLedgerRemainingMinor, 100000); assert.equal(after.creditRegister?.[0].availableMinor, 20000); assert.ok(reportCsv(after).includes('"credits_applied_through_end_minor"')); assert.ok(after.materialSourceExceptions.some(x => x.includes("GST adjustment periods"))); });
test("public note projection omits audit identities, private availability and replacement links; export formula-safe", () => {
    const n = note({ input: input({ reason: "=external" }) });
    const d = publicStandaloneCredit(n);
    const out = JSON.stringify(d);
    for (const key of ["createdBy", "actor", "entries", "availableMinor", "replacement", "publicToken"])
        assert.ok(!out.includes(key));
    assert.equal(d.document.totalMinor, 20000);
    assert.ok(creditCsv(n).includes("'=external"));
    assert.throws(() => publicStandaloneCredit({ ...n, status: "draft" }), /not found/);
});
test("invoice-wide timeline rejects cross-note backdated overlap and later cash in the overlap, permits restored capacity", () => {
    const thousand = note({ issuedAmountMinor: 100000, totalMinor: 100000 });
    let a = apply(thousand, request({ amountMinor: 100000, date: "2026-10-10" }), inv());
    a = apply(a, request({ id: "undo", kind: "reversal", entryId: "apply", amountMinor: 0, date: "2026-10-20" }), inv({ creditAppliedMinor: 100000, balanceDueMinor: 0 }));
    const b = apply({ ...thousand, id: "credit-b" }, request({ id: "b", amountMinor: 100000, date: "2026-10-15" }), inv());
    assert.throws(() => assertInvoiceCreditTimeline(inv(), [a, b], []), /overpaid on 2026-10-15/);
    const later = { ...b, entries: b.entries.map(e => ({ ...e, date: "2026-10-20" })) };
    assert.doesNotThrow(() => assertInvoiceCreditTimeline(inv(), [a, later], []));
    const cash = { id: "cash", date: "2026-10-15", accountId: "bank", amountMinor: 100000, evidence: "Actual receipt", source: "manual" as const, allocations: [{ invoiceId: "invoice", amountMinor: 100000 }], createdAt: today, createdBy: "owner" };
    assert.throws(() => assertInvoiceCreditTimeline(inv(), [a], [cash]), /overpaid on 2026-10-15/);
    assert.doesNotThrow(() => assertInvoiceCreditTimeline(inv(), [a], [{ ...cash, date: "2026-10-21" }]));
    assert.doesNotThrow(() => assertInvoiceCreditTimeline(inv(), [a], [{ ...cash, reversedBy: "correction" }]));
});
