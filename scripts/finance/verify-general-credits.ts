import { syntheticPassword } from "./synthetic-auth";
/** Disposable emulator proof; no live writes or customer fixture embedded in product navigation. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb, adminAuth } from "../../src/lib/firebase-admin";
import { saveCredit, issueCredit, disposeCredit, loadCreditWorkspace, loadCredit } from "../../src/lib/credits/firestore";
import { loadPublicCredit } from "../../src/lib/invoice-corrections/public-firestore";
import { loadFinancialReport, exportFinancialReport } from "../../src/lib/finance/report-firestore";
import { recordReceipt, reverseReceipt } from "../../src/lib/finance/firestore";
import { sydneyDate } from "../../src/lib/finance/period";
import type { CreditInput, CreditRequest } from "../../src/lib/credits/types";
const password = syntheticPassword(), today = sydneyDate();
const browserSeed = process.argv.includes("--browser-seed"), tenant = browserSeed ? (process.argv.find(v=>v.startsWith("--tenant="))?.slice(9)||"general-credit-review") : `general-credit-proof-${Date.now()}`;
async function login(email: string) { const r = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) }); const d = await r.json(); if (!d.idToken)
    throw Error("Synthetic login failed"); return d.idToken as string; }
const input = (id: string, fields: Partial<CreditInput> = {}): CreditInput => ({ id, clientId: "client", currency: "AUD", reason: "Agreed service reduction", reference: "Service order", saleDate: "2026-09-01", lines: [{ description: "Service reduction", netMinor: 20000, taxMinor: 0 }], ...fields });
const request = (id: string, fields: Partial<CreditRequest> = {}): CreditRequest => ({ id, kind: "allocation", amountMinor: 10000, invoiceId: "unpaid", date: today, reference: "Agreement", reason: "Use available client credit", ...fields });
async function main() {
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "demo-cma-finance" || process.env.NEXT_PUBLIC_FIREBASE_MODE !== "emulator" || process.env.FIREBASE_FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099")
        throw Error("Synthetic emulator guard");
    const base = adminDb.doc(`tenants/${tenant}`);
    if ((await base.get()).exists)
        throw Error("Synthetic tenant already exists; do not overwrite a review journey");
    const batch = adminDb.batch();
    for (const [uid, role] of [["credit-owner", "owner"], ["credit-staff", "staff"], ["credit-outsider", null]] as const) {
        const email = `${uid}@example.test`;
        try {
            await adminAuth.getUser(uid);
        }
        catch {
            await adminAuth.createUser({ uid, email, password, emailVerified: true });
        }
        if (role)
            batch.set(base.collection("users").doc(uid), { uid, email, role });
        if (browserSeed && role)
            batch.set(adminDb.doc(`users/${uid}`), { uid, email, tenantId: tenant });
    }
    batch.set(base, { name: "Synthetic Review Studio", syntheticOnly: true });
    batch.set(base.collection("clients").doc("client"), { name: "Synthetic Client", email: "client@example.test" });
    batch.set(base.collection("clients").doc("other"), { name: "Other Synthetic Client", email: "other@example.test" });
    batch.set(base.collection("settings").doc("business"), { businessName: "Synthetic Review Studio", abn: "12345678901", address: "Test address", email: "studio@example.test", invoiceFooter: "Thank you for your business.", tax: { gstRegistration: { status: "unknown" } } });
    batch.set(base.collection("financialAccounts").doc("bank"), { id: "bank", label: "Synthetic bank", type: "bank", currency: "AUD", mapping: { date: "Date", description: "Description", debit: "Debit", credit: "Credit" } });
    for (const [id, paid, tax, clientId, currency] of [["unpaid", 0, 0, "client", "AUD"], ["paid", 100000, 0, "client", "AUD"], ["taxed", 0, 10000, "client", "AUD"], ["other", 0, 0, "other", "AUD"], ["foreign", 0, 0, "client", "NZD"]] as const) {
        const total = 100000 + tax;
        batch.set(base.collection("invoices").doc(id), { tenantId: tenant, clientId, currency, clientName: clientId === "client" ? "Synthetic Client" : "Other Synthetic Client", invoiceNumber: `SYN-${id}`, status: paid ? "paid" : "sent", issueDate: Timestamp.fromDate(new Date("2026-09-01T02:00:00Z")), dueDate: Timestamp.fromDate(new Date("2026-11-30T02:00:00Z")), createdAt: Timestamp.now(), updatedAt: Timestamp.now(), createdBy: "credit-owner", publicToken: `synthetic-${tenant}-${id}`, lines: [{ jobItemId: `item-${id}`, jobId: "job", jobTitle: "Website services", title: "Development", unit: "unit", quantity: 1, unitPriceMinor: 100000, gstApplicable: !!tax, subtotalMinor: 100000, taxMinor: tax, totalMinor: total }], taxBreakdown: tax ? [{ rate: 0.1, taxableMinor: 100000, taxMinor: tax }] : [], lockedJobItemIds: [`item-${id}`], subtotalMinor: 100000, taxMinor: tax, totalMinor: total, amountPaidMinor: paid, ledgerPaidMinor: paid, legacyUndatedMinor: 0, balanceDueMinor: total - paid });
        batch.set(base.collection("jobItems").doc(`item-${id}`), { status: "invoiced", lock: { invoiceId: id } });
    }
    batch.set(base.collection("invoiceReceipts").doc("paid-receipt"), { id: "paid-receipt", date: "2026-09-15", accountId: "bank", amountMinor: 100000, evidence: "Synthetic receipt", source: "manual", allocations: [{ invoiceId: "paid", amountMinor: 100000 }], createdAt: today, createdBy: "credit-owner" });
    await batch.commit();
    if (browserSeed) {
        console.log(JSON.stringify({ syntheticOnly: true, tenant, entry: "http://127.0.0.1:3003/workspace/invoices/credits", login: "credit-owner@example.test", seeded: true }));
        return;
    }
    const [owner, staff, outsider] = await Promise.all([login("credit-owner@example.test"), login("credit-staff@example.test"), login("credit-outsider@example.test")]);
    for (const token of [staff, outsider, "forged"])
        await assert.rejects(() => saveCredit(tenant, token, input("denied"), 0));
    await assert.rejects(() => saveCredit("absent-tenant", owner, input("denied"), 0));
    await assert.rejects(() => loadCreditWorkspace(tenant, staff), /owner/);
    const protectedBefore = JSON.stringify((await base.collection("jobItems").get()).docs.map(d => d.data())), receiptsBefore = JSON.stringify((await base.collection("invoiceReceipts").get()).docs.map(d => d.data()));
    const draft = await saveCredit(tenant, owner, input("standalone"), 0);
    assert.equal(draft.status, "draft");
    assert.equal(draft.availableMinor, 0);
    await assert.rejects(() => issueCredit(tenant, staff, draft.id, draft.revision), /owner/);
    await assert.rejects(() => issueCredit(tenant, owner, draft.id, 999), /changed/);
    const [note, replay] = await Promise.all([issueCredit(tenant, owner, draft.id, draft.revision), issueCredit(tenant, owner, draft.id, draft.revision)]);
    assert.equal(note.number, replay.number);
    assert.equal(note.publicToken, replay.publicToken);
    assert.equal(note.availableMinor, 20000);
    assert.equal((await base.collection("invoices").get()).size, 5);
    assert.equal((await base.collection("invoiceReceipts").get()).size, 1);
    await assert.rejects(() => saveCredit(tenant, owner, input("standalone"), note.revision), /immutable/);
    for (const invoiceId of ["other", "foreign", "paid"])
        await assert.rejects(() => disposeCredit(tenant, owner, note.id, request(`invalid-${invoiceId}`, { invoiceId })));
    await assert.rejects(() => disposeCredit(tenant, staff, note.id, request("staff")), /owner/);
    const [applied, appliedAgain] = await Promise.all([disposeCredit(tenant, owner, note.id, request("partial")), disposeCredit(tenant, owner, note.id, request("partial"))]);
    assert.equal(applied.entries.length, 1);
    assert.equal(appliedAgain.entries.length, 1);
    let inv = (await base.collection("invoices").doc("unpaid").get()).data()!;
    assert.equal(inv.amountPaidMinor, 0);
    assert.equal(inv.creditAppliedMinor, 10000);
    assert.equal(inv.balanceDueMinor, 90000);
    await assert.rejects(() => disposeCredit(tenant, owner, note.id, request("partial", { amountMinor: 1 })), /different data/);
    let current = await disposeCredit(tenant, owner, note.id, request("refund", { kind: "refund", invoiceId: undefined, amountMinor: 5000 }));
    assert.equal(current.refundedMinor, 5000);
    current = await disposeCredit(tenant, owner, note.id, request("refund-reverse", { kind: "reversal", entryId: "refund", amountMinor: 0, invoiceId: undefined }));
    assert.equal(current.refundedMinor, 0);
    assert.equal(current.availableMinor, 10000);
    await assert.rejects(() => disposeCredit(tenant, owner, note.id, request("second-reverse", { kind: "reversal", entryId: "refund", amountMinor: 0 })), /again/);
    current = await disposeCredit(tenant, owner, note.id, request("full", { amountMinor: 10000 }));
    assert.equal(current.availableMinor, 0);
    inv = (await base.collection("invoices").doc("unpaid").get()).data()!;
    assert.equal(inv.balanceDueMinor, 80000);
    assert.equal(inv.amountPaidMinor, 0);
    assert.equal(inv.creditAppliedMinor, 20000);
    const linked = await saveCredit(tenant, owner, input("paid-credit", { originalInvoiceId: "paid", lines: [{ description: "Paid sale credit", netMinor: 20000, taxMinor: 0, originalLineIndex: 0 }] }), 0);
    const issuedPaid = await issueCredit(tenant, owner, linked.id, linked.revision);
    assert.equal(issuedPaid.availableMinor, 20000);
    const paid = (await base.collection("invoices").doc("paid").get()).data()!;
    assert.equal(paid.amountPaidMinor, 100000);
    assert.equal(paid.totalMinor, 100000);
    assert.equal(paid.balanceDueMinor, 0);
    const concurrent = await Promise.allSettled([disposeCredit(tenant, owner, issuedPaid.id, request("concurrent-a", { amountMinor: 15000 })), disposeCredit(tenant, owner, issuedPaid.id, request("concurrent-b", { amountMinor: 15000 }))]);
    assert.equal(concurrent.filter(x => x.status === "fulfilled").length, 1);
    assert.equal((await loadCredit(tenant, owner, issuedPaid.id)).availableMinor, 5000);
    const taxInput = (id: string) => input(id, { originalInvoiceId: "taxed", lines: [{ description: "Actual original-tax credit", netMinor: 60000, taxMinor: 0, originalLineIndex: 0 }] });
    const taxA = await saveCredit(tenant, owner, taxInput("tax-a"), 0), taxB = await saveCredit(tenant, owner, taxInput("tax-b"), 0);
    assert.equal(taxA.taxMinor, 6000);
    const taxRace = await Promise.allSettled([issueCredit(tenant, owner, taxA.id, taxA.revision), issueCredit(tenant, owner, taxB.id, taxB.revision)]);
    assert.equal(taxRace.filter(x => x.status === "fulfilled").length, 1);
    assert.equal((await base.collection("invoices").get()).size, 5);
    assert.equal(JSON.stringify((await base.collection("jobItems").get()).docs.map(d => d.data())), protectedBefore);
    assert.equal(JSON.stringify((await base.collection("invoiceReceipts").get()).docs.map(d => d.data())), receiptsBefore);
    const publicNote = await loadPublicCredit(note.publicToken!);
    assert.equal(publicNote.document.number, note.number);
    assert.ok(!JSON.stringify(publicNote).includes("credit-owner"));
    assert.ok(!JSON.stringify(publicNote).includes("entries"));
    assert.ok(!JSON.stringify(publicNote).includes("replacement"));
    await assert.rejects(() => loadPublicCredit("invalid"));
    await base.collection("creditNotes").doc("draft-token").set({ ...draft, id: "draft-token", publicToken: "d".repeat(64) });
    await assert.rejects(() => loadPublicCredit("d".repeat(64)), /not found/);
    const period = { start: "2026-09-01", end: today, label: "Synthetic credit proof" }, report = await loadFinancialReport(tenant, owner, period);
    assert.equal(report.totals.receivedMinor, 100000);
    assert.ok(!report.invoices.some(i=>i.id==="foreign"));
    assert.ok(report.exceptions.some(e=>e.includes("non-AUD invoice(s) excluded")));
    assert.equal(report.invoices.find(i => i.id === "unpaid")?.creditsAppliedThroughEndMinor, 35000);
    assert.equal(report.invoices.find(i => i.id === "unpaid")?.datedLedgerRemainingMinor, 65000);
    assert.ok(report.creditRegister?.length === 3);
    assert.ok(report.materialSourceExceptions.some(e => e.includes("GST adjustment periods")));
    for (const format of ["csv", "xlsx"] as const) {
        const output = await exportFinancialReport(tenant, owner, period, format, report.sourceIdentity);
        const bytes = Buffer.from(output.base64, "base64");
        assert.ok(bytes.length > 500);
        writeFileSync(`/tmp/cma-general-credit-proof.${format}`, bytes);
    }
    await recordReceipt(tenant, owner, { id: "settle", date: today, accountId: "bank", amountMinor: 65000, evidence: "Synthetic bank receipt", allocations: [{ invoiceId: "unpaid", amountMinor: 65000 }] });
    inv = (await base.collection("invoices").doc("unpaid").get()).data()!;
    assert.equal(inv.amountPaidMinor, 65000);
    assert.equal(inv.creditAppliedMinor, 35000);
    assert.equal(inv.balanceDueMinor, 0);
    assert.equal(inv.status, "paid");
    await reverseReceipt(tenant, owner, "settle", "Synthetic reversal");
    inv = (await base.collection("invoices").doc("unpaid").get()).data()!;
    assert.equal(inv.amountPaidMinor, 0);
    assert.equal(inv.creditAppliedMinor, 35000);
    assert.equal(inv.balanceDueMinor, 65000);
    const audits = await base.collection("financialAudit").where("action", "==", "credit-note-issue").get();
    assert.equal(audits.size, 3);
    console.log(JSON.stringify({ syntheticOnly: true, tenant, result: "passed", checks: ["owner/staff/outsider/forged/cross-tenant denials", "concurrent idempotent issue and allocation", "cross-client/currency/paid amount rejection", "standalone and paid-original-linked credits without replacement", "partial/full allocation and refund/reversal conservation", "original receipt/date/cash/lock preservation", "source caps and original tax concurrent issue", "public issued-only allowlist and invalid/draft token denials", "dated report and CSV/XLSX credit register", "later receipt and reversal retain credits"] }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
