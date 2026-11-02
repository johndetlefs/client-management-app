import assert from "node:assert/strict";
import { seedSynthetic, assertSyntheticEnvironment, SYNTHETIC_OWNER } from "./seed-synthetic";
import { commitNativeImport, loadFinance, matchManualReceipt, pairTransfer, recordReceipt, reverseReceipt, reviewMovement, saveStatementControl, unpairTransfer } from "../../src/lib/finance/firestore";
import { adminDb } from "../../src/lib/firebase-admin";

async function login(email: string) {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: SYNTHETIC_OWNER.password, returnSecureToken: true }) });
  const data = await response.json();
  if (!response.ok || !data.idToken) throw new Error("Synthetic login failed");
  return data.idToken as string;
}

async function main() {
  assertSyntheticEnvironment();
  const tenant = `finance-proof-${Date.now()}`;
  await seedSynthetic(tenant, false);
  const [owner, staff, outsider] = await Promise.all([login(SYNTHETIC_OWNER.email), login("finance-staff@example.test"), login("finance-outsider@example.test")]);
  const mapping = { date: "Date", description: "Description", debit: "Debit", credit: "Credit", balance: "Balance" };
  const input = { accountId: "bank", label: "Synthetic bank", type: "bank" as const, completeDays: true, mapping, csvText: "Date,Description,Debit,Credit,Balance\n01/07/2026,Grouped receipt,,1200.00,2200.00,\n02/07/2026,Software,10.01,,2189.99,\n02/07/2026,Software,10.01,,2179.98,\n03/07/2026,Card repayment,100.00,,2079.98,\n04/07/2026,Manual source,,100.00,2179.98,\n05/07/2026,Concurrent source,,300.00,2479.98,\n06/07/2026,Concurrent source,,300.00,2779.98," };
  const first = await commitNativeImport(tenant, owner, input);
  assert.equal(first.newCount, 7);
  const repeat = await commitNativeImport(tenant, owner, input);
  assert.equal(repeat.newCount, 0); assert.equal(repeat.duplicateCount, 7);
  await assert.rejects(() => commitNativeImport(tenant, owner, { ...input, mapping: { ...mapping, debit: "Credit", credit: "Debit" } }), /different mapping/);
  const exactUndeclaredRepeat = await commitNativeImport(tenant, owner, { ...input, completeDays: false });
  assert.equal(exactUndeclaredRepeat.newCount, 0);
  await assert.rejects(() => commitNativeImport(tenant, staff, input), /owner|permission/);
  await assert.rejects(() => loadFinance(tenant, outsider), /denied|access/i);
  await assert.rejects(() => loadFinance(tenant, "invalid"), /Authentication/);
  const card = await commitNativeImport(tenant, owner, { accountId: "card", label: "Synthetic card", type: "card", completeDays: true, mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit" }, csvText: "Date,Description,Debit,Credit\n03/07/2026,Repayment,,100.00,\n04/07/2026,Hosting,.25,," });
  assert.equal(card.control.state, "missing_balances");
  let data = await loadFinance(tenant, owner);
  assert.equal(data.movements.find((m) => m.description === "Hosting")!.amountMinor, -25);
  const deposit = data.movements.find((m) => m.description === "Grouped receipt")!;
  const receipt = { id: "grouped-receipt", accountId: "bank", date: deposit.date, amountMinor: deposit.amountMinor, movementId: deposit.id, evidence: "Synthetic grouped remittance", allocations: [{ invoiceId: "invoice-june", amountMinor: 100000 }, { invoiceId: "invoice-part", amountMinor: 20000 }] };
  await recordReceipt(tenant, owner, receipt); await recordReceipt(tenant, owner, receipt);
  data = await loadFinance(tenant, owner);
  assert.equal(data.receipts.length, 1); assert.equal(data.invoices.find((i) => i.id === "invoice-june")!.balanceDueMinor, 0); assert.equal(data.invoices.find((i) => i.id === "invoice-part")!.balanceDueMinor, 80000);
  assert.equal(data.invoices.find((i) => i.id === "invoice-part")!.status, "partially_paid");
  assert.equal(data.receipts[0].date, "2026-07-01"); // Prior June invoice appears in received July, never issue-date cash.
  await recordReceipt(tenant, owner, { id: "manual", date: "2026-07-04", accountId: "bank", amountMinor: 10000, evidence: "Synthetic manual receipt", allocations: [] });
  const manualMovement = data.movements.find((m) => m.description === "Manual source")!;
  await matchManualReceipt(tenant, owner, "manual", manualMovement.id);
  data = await loadFinance(tenant, owner); assert.equal(data.receipts.length, 2); assert.equal(data.movements.find((m) => m.id === manualMovement.id)!.receiptId, "manual");
  const transferA = data.movements.find((m) => m.description === "Card repayment")!, transferB = data.movements.find((m) => m.description === "Repayment")!;
  const pairId = await pairTransfer(tenant, owner, transferA.id, transferB.id, "Synthetic equal account repayment");
  assert.equal(await pairTransfer(tenant, owner, transferB.id, transferA.id, "Retry remains idempotent"), pairId);
  await unpairTransfer(tenant, owner, transferA.id, "Synthetic correction cycle");
  assert.equal(await pairTransfer(tenant, owner, transferA.id, transferB.id, "Synthetic corrected pair"), pairId);
  assert.equal(await pairTransfer(tenant, owner, transferA.id, transferB.id, "Retry corrected pair"), pairId);
  const pairAudit = await adminDb.collection(`tenants/${tenant}/financialAudit`).where("recordId", "==", pairId).get();
  assert.equal(pairAudit.docs.filter((d) => d.data().action === "transfer-pair").length, 2);
  assert.equal(pairAudit.docs.filter((d) => d.data().action === "transfer-unpair").length, 1);
  await saveStatementControl(tenant, owner, first.id, 100000, 277998, "Synthetic independent statement opening/closing");
  data = await loadFinance(tenant, owner); assert.equal(data.imports.find((i) => i.id === first.id)!.control.state, "balanced"); assert.equal(data.movements.filter((m) => m.kind === "transfer").length, 2);
  const expense = data.movements.find((m) => m.description === "Software")!;
  const review = { kind: "expense" as const, category: "Software", businessUseBps: 7500, evidence: "Synthetic owner-confirmed mixed use", receiptEvidence: "missing" as const, taxTreatment: "operating" as const };
  const expenseRef = adminDb.doc(`tenants/${tenant}/financialMovements/${expense.id}`);
  const immutableBefore = (await expenseRef.get()).data();
  const importBefore = (await adminDb.doc(`tenants/${tenant}/financialImports/${first.id}`).get()).data();
  for (const extra of [{ amountMinor: -1 }, { date: "2000-01-01" }, { accountId: "other" }, { sourceHash: "changed" }, { fingerprint: "changed" }, { importIds: [] }, { receiptId: "forged" }, { transferId: "forged" }, { revision: 900 }]) {
    await assert.rejects(() => reviewMovement(tenant, owner, expense.id, 0, { ...review, ...extra }), /Unsupported movement review field/);
    assert.deepEqual((await expenseRef.get()).data(), immutableBefore);
  }
  assert.deepEqual((await adminDb.doc(`tenants/${tenant}/financialImports/${first.id}`).get()).data(), importBefore);
  await reviewMovement(tenant, owner, expense.id, 0, review);
  await assert.rejects(() => reviewMovement(tenant, owner, expense.id, 0, review), /changed/);
  await assert.rejects(() => reviewMovement(tenant, staff, expense.id, 1, review), /owner/);
  const concurrent = data.movements.filter((m) => m.description === "Concurrent source");
  const results = await Promise.allSettled(concurrent.map((m, i) => recordReceipt(tenant, owner, { id: `concurrent-${i}`, date: m.date, accountId: "bank", amountMinor: m.amountMinor, movementId: m.id, evidence: "Synthetic concurrent allocation", allocations: [{ invoiceId: "invoice-part", amountMinor: 30000 }] })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2); // 20k plus 60k remains below 100k.
  const overpay = await Promise.allSettled([0, 1].map((i) => recordReceipt(tenant, owner, { id: `competing-final-${i}`, date: "2026-07-08", accountId: "bank", amountMinor: 20000, evidence: "Synthetic competing final payment", allocations: [{ invoiceId: "invoice-part", amountMinor: 20000 }] })));
  assert.equal(overpay.filter((r) => r.status === "fulfilled").length, 1);
  await reverseReceipt(tenant, owner, "grouped-receipt", "Synthetic correction proof");
  await reverseReceipt(tenant, owner, "grouped-receipt", "Repeat correction remains idempotent");
  data = await loadFinance(tenant, owner); assert.equal(data.invoices.find((i) => i.id === "invoice-june")!.amountPaidMinor, 0); assert.equal(data.invoices.find((i) => i.id === "invoice-part")!.amountPaidMinor, 80000);
  assert.equal(data.invoices.find((i) => i.id === "invoice-june")!.status, "overdue");
  assert.equal(data.invoices.find((i) => i.id === "invoice-part")!.status, "partially_paid");
  // Direct client rules must not expose personal financial state, even to staff.
  const denied = await fetch(`http://127.0.0.1:8080/v1/projects/demo-cma-finance/databases/(default)/documents/tenants/${tenant}/financialMovements`, { headers: { Authorization: `Bearer ${staff}` } });
  assert.equal(denied.status, 403);
  const audit = await adminDb.collection(`tenants/${tenant}/financialAudit`).get(); assert.ok(audit.size >= 9);
  console.log(JSON.stringify({ result: "pass", environment: "demo-emulator-only", checks: ["native-import-repeat", "role-tenant-denial", "grouped-partial-cross-year", "manual-match-no-duplicate", "transfer-exclusion", "transfer-retry-undo-repair-audit", "immutable-source-review-rejection", "cent-exact-controls", "stale-review-denial", "concurrent-invoice-allocation", "idempotent-reversal", "staff-direct-read-denial", "audit-retention"], liveReads: 0, liveWrites: 0 }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
