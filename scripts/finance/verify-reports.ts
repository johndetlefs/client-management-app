import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { seedSynthetic, assertSyntheticEnvironment, SYNTHETIC_OWNER } from "./seed-synthetic";
import { commitNativeImport, loadFinance, recordReceipt, reviewMovement } from "../../src/lib/finance/firestore";
import { exportFinancialReport, loadFinancialReport, prepareMovementExpense } from "../../src/lib/finance/report-firestore";
import { confirmExpenseCandidate, getExpenseAccountingContext, updateConfirmedExpense } from "../../src/app/workspace/expenses/accounting-actions";
import { financialYear } from "../../src/lib/finance/period";
import { adminDb } from "../../src/lib/firebase-admin";

async function login(email: string) { const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: SYNTHETIC_OWNER.password, returnSecureToken: true }) }); const data = await response.json(); if (!data.idToken) throw new Error("Synthetic login failed"); return data.idToken as string; }

async function main() {
  assertSyntheticEnvironment(); const tenant = `report-proof-${Date.now()}`; await seedSynthetic(tenant, false);
  const [owner, staff, outsider] = await Promise.all([login(SYNTHETIC_OWNER.email), login("finance-staff@example.test"), login("finance-outsider@example.test")]);
  const period = financialYear(2026, "2026-10-22");
  await commitNativeImport(tenant, owner, { accountId: "bank", label: "Synthetic report bank", type: "bank", completeDays: true, mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit" }, csvText: "Date,Description,Debit,Credit\n01/07/2026,Grouped remittance,,1200.00\n02/07/2026,Software,10.01,\n02/07/2026,Software,10.01,\n03/07/2026,Supplier refund,,2.00\n04/07/2026,Equipment,100.00," });
  let data = await loadFinance(tenant, owner); const deposit = data.movements.find((m) => m.description === "Grouped remittance")!, purchases = data.movements.filter((m) => m.description === "Software"), equipment = data.movements.find((m) => m.description === "Equipment")!, refund = data.movements.find((m) => m.description === "Supplier refund")!;
  await recordReceipt(tenant, owner, { id: "received", date: deposit.date, accountId: deposit.accountId, movementId: deposit.id, amountMinor: deposit.amountMinor, evidence: "Synthetic bank remittance", allocations: [{ invoiceId: "invoice-june", amountMinor: 100000 }, { invoiceId: "invoice-part", amountMinor: 20000 }] });
  const context = await getExpenseAccountingContext(tenant, owner); assert.equal(context.success, true);
  await adminDb.doc(`tenants/${tenant}/settings/business`).set({ tax: { taxType: "GST", defaultRate: 0.1, gstRegistration: { status: "not_registered" } } });
  for (const [index, purchase] of purchases.entries()) {
    await reviewMovement(tenant, owner, purchase.id, 0, { kind: "expense", category: "Software", businessUseBps: index === 0 ? 7500 : 10000, taxTreatment: "operating", evidence: "Synthetic owner-confirmed work use", receiptEvidence: "missing" });
    const candidateId = await prepareMovementExpense(tenant, owner, purchase.id); assert.equal(await prepareMovementExpense(tenant, owner, purchase.id), candidateId);
    const input = { candidateId, businessUsePercent: index === 0 ? 75 : 100, categoryId: "software-online-services", gstTreatment: "taxable_purchase" as const, taxInvoiceStatus: "missing" as const, isSubscription: true, isRecurring: true, notes: "Synthetic existing expense confirmation" };
    assert.equal((await confirmExpenseCandidate(tenant, staff, input)).success, false);
    const result = await confirmExpenseCandidate(tenant, owner, input); assert.equal(result.success, true, result.success ? undefined : result.error);
    assert.equal((await confirmExpenseCandidate(tenant, owner, input)).success, false);
  }
  await reviewMovement(tenant, owner, refund.id, 0, { kind: "supplier_refund", category: "Software", businessUseBps: 10000, refundOf: purchases[0].id, evidence: "Synthetic linked original refund" });
  await reviewMovement(tenant, owner, equipment.id, 0, { kind: "expense", category: "Equipment", businessUseBps: 7500, taxTreatment: "asset_review", evidence: "Synthetic capital equipment, allowance unresolved" });
  data = await loadFinance(tenant, owner); assert.equal(data.movements.filter((m) => m.expenseId).length, 2);
  const report = await loadFinancialReport(tenant, owner, period); assert.equal(report.costs.length, 4); assert.equal(report.totals.receivedMinor, 120000); assert.equal(report.totals.operatingMinor, 1602); assert.equal(report.totals.capitalMinor, 7500); assert.equal(report.totals.workCostMinor, 9102); assert.equal(report.totals.indicativeProfitMinor, 118398); assert.equal(report.totals.gstCreditMinor, 0);
  const prior = await loadFinancialReport(tenant, owner, financialYear(2025)); assert.equal(prior.totals.receivedMinor, 0);
  await assert.rejects(() => loadFinancialReport(tenant, staff, period), /owner/); await assert.rejects(() => loadFinancialReport(tenant, outsider, period), /denied|access/i); await assert.rejects(() => exportFinancialReport(tenant, staff, period, "csv", report.sourceIdentity), /owner/);
  const csv = await exportFinancialReport(tenant, owner, period, "csv", report.sourceIdentity), xlsx = await exportFinancialReport(tenant, owner, period, "xlsx", report.sourceIdentity); assert.equal(csv.snapshotId, xlsx.snapshotId); assert.ok(Buffer.from(csv.base64, "base64").toString().includes('"operatingMinor","1602"'));
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(xlsx.base64, "base64") as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const summary = new Map<string, unknown>(); workbook.getWorksheet("Summary cents")!.eachRow((row, n) => { if (n > 1) summary.set(String(row.getCell(1).value), row.getCell(2).value); }); assert.equal(summary.get("receivedMinor"), 120000); assert.equal(summary.get("operatingMinor"), 1602); assert.equal(summary.get("capitalMinor"), 7500);
  const snapshots = await adminDb.collection(`tenants/${tenant}/financialReportSnapshots`).get(); assert.equal(snapshots.size, 1); assert.deepEqual(snapshots.docs[0].data().report, report);
  const changed = await updateConfirmedExpense(tenant, owner, { expenseId: data.movements.find((m) => m.id === purchases[0].id)!.expenseId!, businessUsePercent: 100, categoryId: "software-online-services", gstTreatment: "taxable_purchase", taxInvoiceStatus: "missing", isSubscription: true, isRecurring: true }); assert.equal(changed.success, true);
  await assert.rejects(() => exportFinancialReport(tenant, owner, period, "csv", report.sourceIdentity), /Source records changed/);
  assert.deepEqual((await snapshots.docs[0].ref.get()).data()!.report, report);
  await commitNativeImport(tenant, owner, { accountId: "bank", label: "Synthetic report bank", type: "bank", completeDays: true, mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit" }, csvText: "Date,Description,Debit,Credit\n06/07/2026,Split refund original,103.00,\n07/07/2026,Split refund one,,33.33\n01/08/2026,Split refund two,,33.33\n01/09/2026,Split refund three,,36.34" });
  data = await loadFinance(tenant, owner); const splitOriginal = data.movements.find((m) => m.description === "Split refund original")!, splitRefunds = data.movements.filter((m) => m.description.startsWith("Split refund ") && m.amountMinor > 0);
  await reviewMovement(tenant, owner, splitOriginal.id, 0, { kind: "expense", category: "Equipment", businessUseBps: 5000, taxTreatment: "asset_review", allowanceMinor: 1000, evidence: "Synthetic evidenced allowance for split-refund regression" });
  const splitCandidate = await prepareMovementExpense(tenant, owner, splitOriginal.id);
  assert.equal((await confirmExpenseCandidate(tenant, owner, { candidateId: splitCandidate, businessUsePercent: 50, categoryId: "equipment-assets", gstTreatment: "taxable_purchase", taxInvoiceStatus: "missing", isSubscription: false, isRecurring: false })).success, true);
  for (const refund of splitRefunds) await reviewMovement(tenant, owner, refund.id, 0, { kind: "supplier_refund", category: "Equipment", businessUseBps: 10000, refundOf: splitOriginal.id, evidence: "Synthetic full refund in three postings" });
  const refunded = await loadFinancialReport(tenant, owner, period), relevant = refunded.costs.filter((c) => c.movementId === splitOriginal.id || splitRefunds.some((m) => m.id === c.movementId));
  assert.equal(relevant.length, 4); for (const field of ["grossMinor", "workMinor", "privateMinor", "gstCreditMinor", "capitalMinor", "allowanceMinor"] as const) assert.equal(relevant.reduce((sum, c) => sum + c[field], 0), 0, `split export ${field}`);
  const refundedExport = await exportFinancialReport(tenant, owner, period, "xlsx", refunded.sourceIdentity); const refundedBook = new ExcelJS.Workbook(); await refundedBook.xlsx.load(Buffer.from(refundedExport.base64, "base64") as unknown as Parameters<typeof refundedBook.xlsx.load>[0]);
  const splitRows: number[][] = []; refundedBook.getWorksheet("Expense bridge")!.eachRow((row, n) => { if (n > 1 && (String(row.getCell(13).value) === splitOriginal.id || splitRefunds.some((m) => m.id === String(row.getCell(13).value)))) splitRows.push([5, 6, 7, 8, 10, 11].map((column) => Number(row.getCell(column).value))); });
  assert.equal(splitRows.length, 4); for (let column = 0; column < 6; column++) assert.equal(splitRows.reduce((sum, row) => sum + row[column], 0), 0);
  const mappingSource = { accountId: "bank", label: "Synthetic report bank", type: "bank" as const, completeDays: true, mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit", balance: "Balance" }, csvText: "Date,Description,Debit,Credit,Balance\n12/07/2026,Mapping transition,1.00,,99.00" };
  await commitNativeImport(tenant, owner, mappingSource);
  await commitNativeImport(tenant, owner, { ...mappingSource, mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit" }, csvText: "Date,Description,Debit,Credit\n12/07/2026,Mapping transition,1.00," });
  assert.equal((await loadFinance(tenant, owner)).accounts.find((a) => a.id === "bank")!.mapping.balance, undefined);
  await commitNativeImport(tenant, owner, mappingSource);
  assert.equal((await loadFinance(tenant, owner)).accounts.find((a) => a.id === "bank")!.mapping.balance, "Balance");
  await commitNativeImport(tenant, owner, { ...mappingSource, mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit" }, csvText: "Date,Description,Debit,Credit\n12/07/2026,Mapping transition,1.00," });
  assert.equal((await loadFinance(tenant, owner)).accounts.find((a) => a.id === "bank")!.mapping.balance, undefined);
  const direct = await fetch(`http://127.0.0.1:8080/v1/projects/demo-cma-finance/databases/(default)/documents/tenants/${tenant}/financialReportSnapshots`, { headers: { Authorization: `Bearer ${staff}` } }); assert.equal(direct.status, 403);
  console.log(JSON.stringify({ result: "pass", environment: "demo-emulator-only", checks: ["existing-expense-confirmation-link", "deterministic-candidate-and-duplicate-denial", "optional-mapping-removal-and-idempotent-source-restoration", "staff-native-confirm-denial", "native-confirmed-dedupe", "refund-original-use", "split-full-refund-source-report-workbook-zero-cents", "asset-allowance-unknown", "exact-screen-model-csv-workbook-snapshot-ties", "cross-FY-receipt-date", "owner-staff-tenant-denial", "immutable-versioned-export", "stale-displayed-source-export-denial", "direct-staff-snapshot-denial"], liveReads: 0, liveWrites: 0 }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
