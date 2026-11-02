import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { financeRefs, requireFinanceOwner, serializeFinancialDate } from "@/lib/finance/firestore";
import { resourceId } from "@/lib/finance/native-csv";
import { sydneyDate, sydneyMidnight } from "@/lib/finance/period";
import type { Receipt } from "@/lib/finance/types";
import type { TenantSettings } from "@/types/tenant";
import { previewCorrection } from "./domain";
import type { CorrectionInput, InvoiceCorrection, OriginalInvoice } from "./types";

function serialise(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if ("toDate" in value && typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k,v]) => [k, serialise(v)]));
}
const json = <T>(value: T): T => serialise(value) as T;
const version = (doc: FirebaseFirestore.DocumentSnapshot) => doc.updateTime ? `${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}` : "missing";
function original(doc: FirebaseFirestore.DocumentSnapshot): OriginalInvoice {
  if (!doc.exists) throw new Error("Original invoice not found");
  const d = doc.data()!;
  return { id: doc.id, version: version(doc), clientId: d.clientId, clientName: d.clientName, number: d.invoiceDisplayNumber || d.invoiceNumber || doc.id, issueDate: serializeFinancialDate(d.issueDate), currency: d.currency || "AUD", status: d.status, lines: json(d.lines), subtotalMinor: d.subtotalMinor, taxMinor: d.taxMinor, totalMinor: d.totalMinor, amountPaidMinor: d.amountPaidMinor || 0, ledgerPaidMinor: d.ledgerPaidMinor || 0, legacyUndatedMinor: d.legacyUndatedMinor ?? d.amountPaidMinor ?? 0, lockedJobItemIds: d.lockedJobItemIds || [], snapshot: json(d) };
}
function validateInput(input: CorrectionInput) {
  resourceId(input.id); if (input.id.length > 80) throw new Error("Correction ID too long");
  if (!Array.isArray(input.originalIds) || !input.originalIds.length || input.originalIds.length > 10) throw new Error("Select one to ten originals");
  input.originalIds.forEach(id => resourceId(id));
  if (!Array.isArray(input.attachments) || input.attachments.length > 2) throw new Error("At most two original PDF attachments are supported");
  for (const file of input.attachments) {
    if (typeof file.base64 !== "string" || file.base64.length > 340000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64) || !file.name?.toLowerCase().endsWith(".pdf") || file.name.length > 150) throw new Error("Attach a PDF no larger than 250 KB");
    const bytes = Buffer.from(file.base64, "base64");
    if (bytes.toString("base64") !== file.base64 || bytes.subarray(0, 4).toString() !== "%PDF" || bytes.length > 250000 || createHash("sha256").update(bytes).digest("hex") !== file.sha256) throw new Error("Original PDF hash/content mismatch");
  }
}
export async function loadCorrectionWorkspace(tenantId: string, idToken: string) {
  await requireFinanceOwner(tenantId, idToken); const refs = financeRefs(tenantId);
  const [invoices, receipts, corrections] = await Promise.all([refs.invoices.limit(201).get(), refs.receipts.limit(201).get(), refs.tenant.collection("invoiceCorrections").limit(101).get()]);
  if (invoices.size > 200 || receipts.size > 200 || corrections.size > 100) throw new Error("Correction workspace limit exceeded; no partial inventory returned");
  return { invoices: invoices.docs.filter(d => !["draft", "void"].includes(d.get("status")) && !d.get("creditedBy") && !d.get("correctionId") && !d.get("creditNoteIssuedMinor") && !d.get("creditAppliedMinor")).map(original), receipts: json(receipts.docs.map(d => ({ ...d.data(), id: d.id }))) as Receipt[], corrections: json(corrections.docs.map(d => d.data())) as InvoiceCorrection[] };
}
export async function prepareCorrection(tenantId: string, idToken: string, input: CorrectionInput, expectedRevision = 0) {
  const access = await requireFinanceOwner(tenantId, idToken); validateInput(input);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("Invalid expected correction revision");
  const refs = financeRefs(tenantId), ref = refs.tenant.collection("invoiceCorrections").doc(input.id);
  return adminDb.runTransaction(async tx => {
    const prior = await tx.get(ref); const old = prior.data() as InvoiceCorrection | undefined;
    if (old?.status === "posted") throw new Error("Posted correction is immutable");
    if ((old?.revision || 0) !== expectedRevision) {
      if (old && JSON.stringify(old.input) === JSON.stringify(input)) return old;
      throw new Error("Correction changed; reload before saving");
    }
    const invoiceDocs = await tx.getAll(...input.originalIds.map(id => refs.invoices.doc(id)));
    const receiptDocs = await tx.get(refs.receipts.limit(201));
    if (receiptDocs.size > 200) throw new Error("Receipt scope exceeds atomic correction limit");
    const [settingsDoc, gstDoc] = await Promise.all([tx.get(refs.tenant.collection("settings").doc("business")), tx.get(refs.workpapers.doc("gst-evidence"))]);
    const settings = settingsDoc.data() as TenantSettings | undefined;
    const originals = invoiceDocs.map(original), allReceipts = json(receiptDocs.docs.map(d => ({ ...d.data(), id: d.id }))) as Receipt[];
    const preview = previewCorrection(input, { originals, receipts: allReceipts, registration: settings?.tax?.gstRegistration, registrationEvidence: String(gstDoc.get("currentStatusEvidence") || ""), today: sydneyDate() });
    const ids = new Set([...preview.receiptChanges.map(c => c.id), ...input.receiptMatches.map(m => m.receiptId)]);
    const now = new Date().toISOString();
    const correction: InvoiceCorrection = { id: input.id, revision: (old?.revision || 0) + 1, status: "prepared", input, originals, receipts: allReceipts.filter(r => ids.has(r.id)), receiptVersions: Object.fromEntries(receiptDocs.docs.filter(d => ids.has(d.id)).map(d => [d.id, version(d)])), preview, createdAt: old?.createdAt || now, updatedAt: now, createdBy: old?.createdBy || access.userId, settingsSnapshot: { businessName: settings?.businessName || "", abn: settings?.abn || "", address: settings?.address || "", email: settings?.email || "", bankAccount: (settings?.bankAccount || {}) as Record<string, unknown>, phone: settings?.phone || "", invoiceTerms: settings?.invoiceTerms || "", invoiceFooter: settings?.invoiceFooter || "" } };
    if (Buffer.byteLength(JSON.stringify(correction)) > 850000) throw new Error("Correction exceeds safe document size; reduce attachment/detail scope");
    tx.set(ref, correction);
    tx.create(refs.audit.doc(), { action: "invoice-correction-prepare", recordId: input.id, actor: access.userId, at: now, before: old ? { revision: old.revision } : null, after: { revision: correction.revision, originalIds: input.originalIds }, reason: input.reason });
    return correction;
  });
}
export async function postCorrection(tenantId: string, idToken: string, id: string, expectedRevision: number) {
  const access = await requireFinanceOwner(tenantId, idToken); resourceId(id);
  const refs = financeRefs(tenantId), ref = refs.tenant.collection("invoiceCorrections").doc(id);
  const publicToken = randomBytes(32).toString("hex"), replacementPublicToken = randomBytes(32).toString("hex");
  return adminDb.runTransaction(async tx => {
    const doc = await tx.get(ref); if (!doc.exists) throw new Error("Correction not found");
    const correction = doc.data() as InvoiceCorrection;
    if (correction.status === "posted") return correction;
    if (correction.revision !== expectedRevision) throw new Error("Correction changed; reload before posting");
    const invoices = await tx.getAll(...correction.input.originalIds.map(id => refs.invoices.doc(id)));
    if (invoices.some(d => version(d) !== correction.originals.find(o => o.id === d.id)?.version)) throw new Error("Original invoice changed; prepare again from current records");
    const receiptDocs = await tx.get(refs.receipts.limit(201)); if (receiptDocs.size > 200) throw new Error("Receipt scope too large");
    for (const [id, v] of Object.entries(correction.receiptVersions)) if (version(receiptDocs.docs.find(d => d.id === id) || { updateTime: undefined } as FirebaseFirestore.DocumentSnapshot) !== v) throw new Error("Receipt changed; prepare again from current records");
    const [settingsDoc, gstDoc] = await Promise.all([tx.get(refs.tenant.collection("settings").doc("business")), tx.get(refs.workpapers.doc("gst-evidence"))]);
    const settings = settingsDoc.data() as TenantSettings | undefined;
    if (!settings?.businessName?.trim() || !settings.abn?.trim()) throw new Error("Supplier identity and ABN are required before issuing correction documents");
    const supplier = { businessName: settings.businessName || "", abn: settings.abn || "", address: settings.address || "", email: settings.email || "", bankAccount: settings.bankAccount || {}, phone: settings.phone || "", invoiceTerms: settings.invoiceTerms || "", invoiceFooter: settings.invoiceFooter || "" };
    if (JSON.stringify(supplier) !== JSON.stringify(correction.settingsSnapshot)) throw new Error("Supplier details changed; prepare again before issuing");
    const today = sydneyDate(), originals = invoices.map(original);
    const preview = previewCorrection(correction.input, { originals, receipts: json(receiptDocs.docs.map(d => ({ ...d.data(), id: d.id }))) as Receipt[], registration: settings.tax?.gstRegistration, registrationEvidence: String(gstDoc.get("currentStatusEvidence") || ""), today });
    if (preview.blockers.length) throw new Error(`Cannot create these documents: ${preview.blockers.join(" ")}`);
    const jobIds = [...new Set(originals.flatMap(o => o.lockedJobItemIds))];
    if (jobIds.length > 100) throw new Error("Too many locks for one correction");
    const locks = jobIds.length ? await tx.getAll(...jobIds.map(id => refs.tenant.collection("jobItems").doc(id))) : [];
    if (locks.some(d => !d.exists || !correction.input.originalIds.includes(d.get("lock.invoiceId")))) throw new Error("Job-item lock changed; reconcile source before posting");
    const year = today.slice(0, 4), counterRef = refs.tenant.collection("counters").doc(`invoices-${year}`), creditCounterRef = refs.tenant.collection("counters").doc(`credits-${year}`);
    const replacementId = `replacement-${id}`, replacementRef = refs.invoices.doc(replacementId);
    const [counter, creditCounter, replacement] = await tx.getAll(counterRef, creditCounterRef, replacementRef);
    if (replacement.exists) throw new Error("Replacement identity already exists outside this correction");
    const next = (counter.get("lastNumber") || 0) + 1, nextCredit = (creditCounter.get("lastNumber") || 0) + 1;
    if (!Number.isSafeInteger(next) || !Number.isSafeInteger(nextCredit) || next < 1 || nextCredit < 1) throw new Error("Numbering counter is invalid");
    const replacementNumber = `${year}-${String(next).padStart(3,"0")}`, creditNumber = `CN-${year}-${String(nextCredit).padStart(3,"0")}`;
    const now = new Date(), first = originals[0].snapshot;
    const sourceKeys = ["clientName", "clientEmail", "clientAbn", "clientAddress", "paymentInstructions"];
    const clientSnapshot = Object.fromEntries(sourceKeys.filter(k => first[k] !== undefined).map(k => [k, first[k]]));
    const taxRate = correction.input.taxRateBps / 10000; // Rate metadata; money was calculated with integer basis points.
    tx.set(counterRef, { year: Number(year), lastNumber: next, updatedAt: Timestamp.fromDate(now) }, { merge: true });
    tx.set(creditCounterRef, { year: Number(year), lastNumber: nextCredit, updatedAt: Timestamp.fromDate(now) }, { merge: true });
    tx.create(replacementRef, { publicToken: replacementPublicToken, tenantId, clientId: originals[0].clientId, ...clientSnapshot, invoiceNumber: replacementNumber, invoiceDisplayNumber: replacementNumber, currency: "AUD", status: preview.balanceMinor === 0 ? "paid" : preview.carriedMinor ? "partially_paid" : "sent", issueDate: Timestamp.fromDate(now), dueDate: Timestamp.fromDate(sydneyMidnight(correction.input.dueDate)), lines: preview.lines, lockedJobItemIds: jobIds, subtotalMinor: preview.subtotalMinor, taxMinor: preview.taxMinor, totalMinor: preview.totalMinor, amountPaidMinor: preview.carriedMinor, ledgerPaidMinor: preview.carriedMinor, legacyUndatedMinor: 0, balanceDueMinor: preview.balanceMinor, taxBreakdown: preview.taxMinor ? [{ rate: taxRate, taxableAmountMinor: preview.subtotalMinor, taxMinor: preview.taxMinor }] : [], correctionId: id, originalInvoiceIds: correction.input.originalIds, createdAt: Timestamp.fromDate(now), updatedAt: Timestamp.fromDate(now), createdBy: access.userId, issuedBy: access.userId, notes: `Replaces ${originals.map(o => o.number).join(", ")}. Credit note ${creditNumber}.${correction.input.evidence ? ` ${correction.input.evidence}` : ""}` });
    for (const source of originals) tx.update(refs.invoices.doc(source.id), { creditedBy: id, creditedAt: today, creditedTotalMinor: source.totalMinor, balanceDueMinor: 0, replacementId, updatedAt: Timestamp.fromDate(now) });
    for (const change of preview.receiptChanges) tx.update(refs.receipts.doc(change.id), { allocations: change.after });
    for (const lock of locks) tx.update(lock.ref, { correctionId: id, "lock.invoiceId": replacementId, updatedAt: Timestamp.fromDate(now) });
    const posted: InvoiceCorrection = { ...correction, publicToken, replacementPublicToken, preview, status: "posted", postedAt: now.toISOString(), postingDate: today, creditNumber, replacementNumber, replacementId, revision: correction.revision + 1, updatedAt: now.toISOString() };
    tx.update(ref, posted as unknown as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
    tx.create(refs.audit.doc(`correction-${id}`), { action: "invoice-correction-post", actor: access.userId, at: now.toISOString(), recordId: id, before: { originalIds: correction.input.originalIds, receiptAllocations: preview.receiptChanges.map(c => ({ id: c.id, allocations: c.before })) }, after: { replacementId, creditNumber, receiptAllocations: preview.receiptChanges.map(c => ({ id: c.id, allocations: c.after })), cashCreatedMinor: 0 }, reason: correction.input.reason });
    return posted;
  });
}
export async function loadCorrection(tenantId: string, idToken: string, id: string) {
  await requireFinanceOwner(tenantId, idToken); resourceId(id);
  const doc = await adminDb.doc(`tenants/${tenantId}/invoiceCorrections/${id}`).get();
  if (!doc.exists) throw new Error("Correction not found");
  const correction = doc.data() as InvoiceCorrection;
  if (correction.status === "posted" && correction.replacementId) {
    const invoice = await adminDb.doc(`tenants/${tenantId}/invoices/${correction.replacementId}`).get();
    if (!invoice.exists) throw new Error("Replacement invoice missing; reconcile before relying on settlement");
    correction.settlement = { amountPaidMinor: invoice.get("amountPaidMinor"), balanceDueMinor: invoice.get("balanceDueMinor"), status: invoice.get("status") };
  }
  return correction;
}
