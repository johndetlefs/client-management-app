import assert from "node:assert/strict";
import test from "node:test";
import { add, parseSignedMoney, portion } from "./money";
import { financialDate, parseNativeStatement, reconcileStatement, resolveMovementImport } from "./native-csv";
import { receiptInvoiceStatus, receiptRequestSignature, validateAllocations, validateReceipt, validateTransfer } from "./ledger";
import type { FinancialInvoice } from "./types";

const bank = "Date,Description,Debit,Credit,Balance\n01/07/2026,Opening receipt,,1200.00,2200.00,\n02/07/2026,Software,10.01,,2189.99,\n02/07/2026,Software,10.01,,2179.98,\n03/07/2026,Card repayment,100.00,,2079.98,\n";
const map = { date: "Date", description: "Description", debit: "Debit", credit: "Credit", balance: "Balance" };
function invoice(id: string, values: Partial<FinancialInvoice> = {}): FinancialInvoice { return { id, number: id, issueDate: "2026-06-30", totalMinor: 100000, amountPaidMinor: 0, balanceDueMinor: 100000, ledgerPaidMinor: 0, legacyUndatedMinor: 0, status: "sent", taxMinor: 0, ...values }; }

test("CRLF and LF retain one canonical source and movement identity with distinct exact file hashes", () => {
  const lf = parseNativeStatement(bank, "bank", map), crlf = parseNativeStatement(bank.replaceAll("\n", "\r\n"), "bank", map);
  assert.equal(lf.sourceHash, crlf.sourceHash); assert.notEqual(lf.rawSourceHash, crlf.rawSourceHash); assert.deepEqual(lf.rows, crlf.rows);
  assert.equal(resolveMovementImport(crlf.rows, lf.rows, false).newRows.length, 0);
});

test("native bank headers, trailing blank fields, exact cents and source rows", () => {
  const parsed = parseNativeStatement(bank, "bank", map);
  assert.equal(parsed.rows.length, 4); assert.equal(parsed.rows[0].sourceRow, 2);
  assert.equal(parsed.debitMinor, 12002); assert.equal(parsed.creditMinor, 120000);
  assert.equal(parsed.rows[1].amountMinor, -1001);
  assert.notEqual(parsed.rows[1].id, parsed.rows[2].id);
  assert.equal(parsed.rows[2].occurrence, 2);
});

test("remembered arbitrary mappings support cards without balance controls", () => {
  const parsed = parseNativeStatement("Posted,Memo,Out,In\n21/10/2026,Hosting,5.25,,\n", "card", { date: "Posted", description: "Memo", debit: "Out", credit: "In" });
  assert.equal(parsed.rows[0].amountMinor, -525);
  assert.equal(reconcileStatement(parsed.rows).state, "missing_balances");
  assert.equal(reconcileStatement(parsed.rows, -1000, -1525).state, "balanced");
});

test("repeat and full-day overlap preserve reviewed rows and equal genuine purchases", () => {
  const parsed = parseNativeStatement(bank, "bank", map);
  assert.equal(resolveMovementImport(parsed.rows, parsed.rows, true).newRows.length, 0);
  const overlap = parseNativeStatement("Date,Description,Debit,Credit,Balance\n02/07/2026,Software,10.01,,2189.99\n02/07/2026,Software,10.01,,2179.98\n04/07/2026,New expense,3.20,,2076.78", "bank", map);
  const result = resolveMovementImport(overlap.rows, parsed.rows, true);
  assert.equal(result.duplicates, 2); assert.equal(result.newRows.length, 1);
  assert.equal(parsed.rows[1].kind, "unreviewed");
});

test("partial-day identical overlaps stop explicitly rather than silently dropping rows", () => {
  const parsed = parseNativeStatement(bank, "bank", map);
  const partial = parseNativeStatement("Date,Description,Debit,Credit,Balance\n02/07/2026,Software,10.01,,2179.98", "bank", map);
  assert.throws(() => resolveMovementImport(partial.rows, parsed.rows, true), /Ambiguous/);
  assert.equal(resolveMovementImport(parsed.rows, parsed.rows, false).newRows.length, 0); // Exact known file identity is safe even before a complete-day declaration.
  assert.throws(() => resolveMovementImport(partial.rows, parsed.rows, false), /Ambiguous/);
});

test("running balances verify both statement orders and distinguish inferred opening", () => {
  const { rows } = parseNativeStatement(bank, "bank", map);
  assert.equal(reconcileStatement(rows).state, "opening_unverified");
  assert.equal(reconcileStatement(rows, 100000, 207998).state, "balanced");
  assert.equal(reconcileStatement([...rows].reverse(), 100000, 207998).state, "balanced");
  assert.equal(reconcileStatement(rows, 100001, 207998).state, "variance");
  const broken = rows.map((r, i) => i === 1 ? { ...r, balanceMinor: r.balanceMinor! + 1 } : r);
  assert.ok(reconcileStatement(broken, 100000, 207998).balanceBreaks > 0);
});

test("invalid mappings, dates, amounts, account paths and additional populated cells fail", () => {
  assert.throws(() => parseNativeStatement(bank, "other/tenant", map), /Invalid account/);
  assert.throws(() => parseNativeStatement(bank.replace("01/07/2026", "31/02/2026"), "bank", map), /invalid date/);
  assert.throws(() => parseNativeStatement(bank.replace("1200.00", "1200.001"), "bank", map), /currency amount/);
  assert.throws(() => parseNativeStatement(bank.replace("2200.00,", "2200.00,unexpected"), "bank", map), /unexpected columns/);
  assert.throws(() => parseNativeStatement(bank, "bank", { ...map, credit: "Debit" }), /different column/);
  assert.throws(() => financialDate("2026-2-01"), /YYYY/);
});

test("minor-unit arithmetic rejects overflow and rounds signed work portions symmetrically", () => {
  assert.equal(parseSignedMoney("-$1,002.01"), -100201);
  assert.equal(parseSignedMoney(".25"), 25); assert.equal(parseSignedMoney("-.01"), -1);
  assert.equal(portion(1001, 7500), 751); assert.equal(portion(-1001, 7500), -751);
  assert.throws(() => parseSignedMoney("90071992547410.00"), /integer cents/);
  assert.throws(() => add(Number.MAX_SAFE_INTEGER, 1), /integer cents/);
  assert.throws(() => portion(100, 10001), /Work use/);
});

test("native fractional debit fields without a leading zero preserve exact cents", () => {
  const parsed = parseNativeStatement("Date,Description,Debit,Credit\n21/10/2026,Linked foreign fee,.25,,\n", "card");
  assert.equal(parsed.rows[0].amountMinor, -25); assert.equal(parsed.debitMinor, 25);
});

test("one deposit can partially settle several invoices without inflating income", () => {
  const updates = validateAllocations(120000, [{ invoiceId: "a", amountMinor: 100000 }, { invoiceId: "b", amountMinor: 20000 }], [invoice("a"), invoice("b")]);
  assert.equal(updates[0].status, "paid"); assert.equal(updates[1].balanceDueMinor, 80000);
  assert.equal(updates[1].status, "partially_paid");
  assert.equal(add(...updates.map((u) => u.amountPaidMinor)), 120000);
  assert.deepEqual(validateAllocations(120000, [], []), []);
});

test("receipt and reversal status preserve partial and overdue invoice policy", () => {
  const overdue = invoice("late", { dueDate: "2020-06-30T00:00:00Z", status: "paid" });
  assert.equal(receiptInvoiceStatus(overdue, 50000), "partially_paid");
  assert.equal(receiptInvoiceStatus(overdue, 0), "overdue");
  assert.equal(receiptInvoiceStatus(overdue, 100000), "paid");
  assert.equal(receiptInvoiceStatus(invoice("future", { dueDate: "2099-06-30T00:00:00Z" }), 0), "sent");
  assert.equal(receiptInvoiceStatus(invoice("void", { status: "void" }), 0), "void");
});

test("receipt retry identity normalises optional legacy amounts and invoice order", () => {
  const request = { date: "2026-07-01", accountId: "bank", amountMinor: 120000, evidence: "Synthetic remittance", allocations: [{ invoiceId: "a", amountMinor: 100000 }, { invoiceId: "b", amountMinor: 20000 }] };
  const stored = { ...request, allocations: [...request.allocations].reverse().map((a) => ({ ...a, replacesLegacyMinor: 0 })) };
  assert.equal(receiptRequestSignature(request), receiptRequestSignature(stored));
  assert.notEqual(receiptRequestSignature(request), receiptRequestSignature({ ...request, amountMinor: 120001 }));
});

test("source-backed legacy replacement never invents received dates or duplicates paid money", () => {
  const legacy = invoice("a", { amountPaidMinor: 100000, balanceDueMinor: 0, legacyUndatedMinor: 100000, status: "paid" });
  assert.throws(() => validateAllocations(100000, [{ invoiceId: "a", amountMinor: 100000 }], [legacy]), /overpay/);
  const [update] = validateAllocations(100000, [{ invoiceId: "a", amountMinor: 100000, replacesLegacyMinor: 100000 }], [legacy]);
  assert.equal(update.amountPaidMinor, 100000); assert.equal(update.legacyUndatedMinor, 0); assert.equal(update.ledgerPaidMinor, 100000);
});

test("allocation totals, duplicate invoices, draft/void and overpayment fail", () => {
  assert.throws(() => validateAllocations(10000, [{ invoiceId: "a", amountMinor: 10001 }], [invoice("a")]), /exceed/);
  assert.throws(() => validateAllocations(10000, [{ invoiceId: "a", amountMinor: 2000 }, { invoiceId: "a", amountMinor: 2000 }], [invoice("a")]), /once/);
  assert.throws(() => validateAllocations(100000, [{ invoiceId: "a", amountMinor: 100000 }], [invoice("a", { status: "void" })]), /unavailable/);
  assert.throws(() => validateAllocations(100000, [{ invoiceId: "a", amountMinor: -1 }], [invoice("a")]), /Invalid allocation/);
});

test("receipt and later manual matching require exact date, account, amount and unused source", () => {
  const movement = parseNativeStatement(bank, "bank", map).rows[0];
  const input = { date: movement.date, amountMinor: movement.amountMinor, accountId: "bank", movementId: movement.id, evidence: "Synthetic remittance" };
  assert.doesNotThrow(() => validateReceipt(input, movement));
  assert.throws(() => validateReceipt({ ...input, date: "2026-07-02" }, movement), /differs/);
  assert.throws(() => validateReceipt(input, { ...movement, receiptId: "already" }), /unavailable/);
});

test("transfers need opposite equal amounts in different accounts with no prior business link", () => {
  const debit = parseNativeStatement(bank, "bank", map).rows[3];
  const credit = { ...debit, id: "card-credit", accountId: "card", amountMinor: -debit.amountMinor };
  assert.doesNotThrow(() => validateTransfer(debit, credit));
  assert.throws(() => validateTransfer(debit, { ...credit, amountMinor: credit.amountMinor - 1 }), /opposite/);
  assert.throws(() => validateTransfer(debit, { ...credit, receiptId: "receipt" }), /linked/);
});
