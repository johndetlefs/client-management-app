import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { financeRefs, requireFinanceOwner, financialInvoice, serializeFinancialDate } from "@/lib/finance/firestore";
import { receiptInvoiceStatus } from "@/lib/finance/ledger";
import { resourceId } from "@/lib/finance/native-csv";
import { sydneyDate } from "@/lib/finance/period";
import { add } from "@/lib/finance/money";
import { creditAmounts, creditEntry, creditState, assertInvoiceCreditTimeline } from "./domain";
import type { CreditInput, CreditNote, CreditRequest, CreditInvoice, CreditSource } from "./types";
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const notes = (tenantId: string) => financeRefs(tenantId).tenant.collection("creditNotes");
function source(doc: FirebaseFirestore.DocumentSnapshot): CreditSource {
    if (!doc.exists || ["draft", "void"].includes(doc.get("status")) || doc.get("creditedBy"))
        throw Error("Choose an issued original invoice");
    const d = doc.data()!, value = { id: doc.id, clientId: String(d.clientId), currency: String(d.currency || "AUD"), number: String(d.invoiceDisplayNumber || d.invoiceNumber || doc.id), issueDate: serializeFinancialDate(d.issueDate), totalMinor: d.totalMinor, lines: (d.lines || []).map((l: Record<string, unknown>) => ({ description: [l.title, l.description, l.jobTitle].filter(Boolean).join(" — "), netMinor: l.subtotalMinor as number, taxMinor: l.taxMinor as number })) };
    return { ...value, version: hash(value) };
}
function invoice(doc: FirebaseFirestore.DocumentSnapshot): CreditInvoice {
    if (!doc.exists)
        throw Error("Invoice not found");
    const d = doc.data()!, f = financialInvoice(doc.id, d);
    return { ...f, clientId: String(d.clientId), currency: String(d.currency || "AUD"), creditAppliedMinor: d.creditAppliedMinor || 0, balanceDueMinor: add(f.totalMinor, -f.amountPaidMinor, -(f.creditAppliedMinor || 0)) };
}
const supplier = (d: FirebaseFirestore.DocumentData | undefined) => ({ businessName: String(d?.businessName || ""), abn: String(d?.abn || ""), address: String(d?.address || ""), email: String(d?.email || ""), phone: String(d?.phone || ""), invoiceFooter: String(d?.invoiceFooter || "") });
const customer = (d: FirebaseFirestore.DocumentData) => ({ name: String(d.name || ""), email: String(d.email || ""), abn: String(d.abn || ""), address: d.address ? [d.address.street, [d.address.city, d.address.state, d.address.postcode].filter(Boolean).join(" "), d.address.country].filter(Boolean) : [] });
function cleanInput(input: CreditInput): CreditInput { return { id: input.id, clientId: input.clientId, currency: input.currency, reason: input.reason, reference: input.reference, saleDate: input.saleDate, ...(input.originalInvoiceId ? { originalInvoiceId: input.originalInvoiceId } : {}), lines: input.lines.map(l => ({ ...(l.id ? { id: l.id } : {}), description: l.description, netMinor: l.netMinor, taxMinor: l.taxMinor, ...(l.originalLineIndex !== undefined ? { originalLineIndex: l.originalLineIndex } : {}) })) }; }
function validateIds(input: CreditInput) {
    resourceId(input.id);
    resourceId(input.clientId);
    if (input.originalInvoiceId)
        resourceId(input.originalInvoiceId);
}
export async function loadCreditWorkspace(tenantId: string, idToken: string) {
    await requireFinanceOwner(tenantId, idToken);
    const refs = financeRefs(tenantId);
    const [clients, invoices, credits] = await Promise.all([refs.tenant.collection("clients").limit(201).get(), refs.invoices.limit(201).get(), notes(tenantId).limit(201).get()]);
    if ([clients, invoices, credits].some(s => s.size > 200))
        throw Error("Credit workspace limit exceeded; no partial results returned");
    return { clients: clients.docs.map(d => ({ id: d.id, name: String(d.get("name")) })), invoices: invoices.docs.filter(d => !["draft", "void"].includes(d.get("status")) && !d.get("creditedBy")).map(d => ({ source: source(d), invoice: invoice(d) })), credits: credits.docs.map(d => d.data() as CreditNote) };
}
export async function loadCredit(tenantId: string, idToken: string, id: string) {
    await requireFinanceOwner(tenantId, idToken);
    resourceId(id);
    const doc = await notes(tenantId).doc(id).get();
    if (!doc.exists)
        throw Error("Credit note not found");
    return doc.data() as CreditNote;
}
export async function saveCredit(tenantId: string, idToken: string, input: CreditInput, expectedRevision: number) {
    const access = await requireFinanceOwner(tenantId, idToken);
    validateIds(input);
    input = cleanInput(input);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
        throw Error("Invalid revision");
    const refs = financeRefs(tenantId), ref = notes(tenantId).doc(input.id);
    return adminDb.runTransaction(async (tx) => {
        const [oldDoc, clientDoc, settingsDoc] = await tx.getAll(ref, refs.tenant.collection("clients").doc(input.clientId), refs.tenant.collection("settings").doc("business"));
        const old = oldDoc.data() as CreditNote | undefined;
        if (old?.status === "issued")
            throw Error("Issued credit economics are immutable");
        if ((old?.revision || 0) !== expectedRevision) {
            if (old && JSON.stringify(old.input) === JSON.stringify(input))
                return old;
            throw Error("Credit note changed; reload before saving");
        }
        if (!clientDoc.exists)
            throw Error("Client not found");
        const original = input.originalInvoiceId ? source(await tx.get(refs.invoices.doc(input.originalInvoiceId))) : undefined;
        const related = original ? await tx.get(notes(tenantId).where("input.originalInvoiceId", "==", original.id).limit(201)) : undefined;
        if (related && related.size > 200)
            throw Error("Original credit history limit exceeded");
        const amounts = creditAmounts(input, original, related?.docs.map(d => d.data() as CreditNote) || [], sydneyDate());
        const now = new Date().toISOString();
        const note: CreditNote = { id: input.id, revision: (old?.revision || 0) + 1, status: "draft", input: { ...input, lines: amounts.lines }, ...(original ? { original } : {}), client: customer(clientDoc.data()!), supplier: supplier(settingsDoc.data()), netMinor: amounts.netMinor, taxMinor: amounts.taxMinor, totalMinor: amounts.totalMinor, issuedAmountMinor: 0, appliedMinor: 0, refundedMinor: 0, availableMinor: 0, entries: [], createdAt: old?.createdAt || now, updatedAt: now, createdBy: old?.createdBy || access.userId };
        tx.set(ref, note);
        tx.create(refs.audit.doc(), { action: "credit-draft-save", recordId: note.id, actor: access.userId, at: now, before: old ? { revision: old.revision } : null, after: { revision: note.revision, totalMinor: note.totalMinor }, reason: input.reason });
        return note;
    });
}
export async function issueCredit(tenantId: string, idToken: string, id: string, revision: number) {
    const access = await requireFinanceOwner(tenantId, idToken);
    resourceId(id);
    const refs = financeRefs(tenantId), ref = notes(tenantId).doc(id), token = randomBytes(32).toString("hex");
    return adminDb.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists)
            throw Error("Credit note not found");
        const note = doc.data() as CreditNote;
        if (note.status === "issued")
            return note;
        if (note.revision !== revision)
            throw Error("Credit note changed; reload before issuing");
        const [clientDoc, settingsDoc] = await tx.getAll(refs.tenant.collection("clients").doc(note.input.clientId), refs.tenant.collection("settings").doc("business"));
        if (!clientDoc.exists || JSON.stringify(customer(clientDoc.data()!)) !== JSON.stringify(note.client) || JSON.stringify(supplier(settingsDoc.data())) !== JSON.stringify(note.supplier))
            throw Error("Client or business details changed; save the credit again");
        if (!note.supplier.businessName || (note.taxMinor && !note.supplier.abn))
            throw Error("Enter your business name and ABN for taxable credit notes");
        const original = note.original ? source(await tx.get(refs.invoices.doc(note.original.id))) : undefined;
        if (original?.version !== note.original?.version)
            throw Error("Original invoice changed; save the credit again");
        const related = original ? await tx.get(notes(tenantId).where("input.originalInvoiceId", "==", original.id).limit(201)) : undefined;
        if (related && related.size > 200)
            throw Error("Original credit history limit exceeded");
        const amounts = creditAmounts(note.input, original, related?.docs.map(d => d.data() as CreditNote) || [], sydneyDate());
        if (amounts.taxMinor !== note.taxMinor || amounts.totalMinor !== note.totalMinor)
            throw Error("Remaining source tax changed; save the credit again");
        const today = sydneyDate(), year = today.slice(0, 4), counter = refs.tenant.collection("counters").doc(`credits-${year}`), count = await tx.get(counter), next = (count.get("lastNumber") || 0) + 1;
        if (!Number.isSafeInteger(next) || next < 1)
            throw Error("Credit counter is invalid");
        const now = new Date().toISOString(), posted: CreditNote = { ...note, status: "issued", issuedAmountMinor: note.totalMinor, availableMinor: note.totalMinor, issueDate: today, number: `CN-${year}-${String(next).padStart(3, "0")}`, publicToken: token, revision: note.revision + 1, updatedAt: now };
        tx.update(ref, posted as unknown as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
        tx.set(counter, { year: Number(year), lastNumber: next, updatedAt: Timestamp.now() }, { merge: true });
        if (original)
            tx.update(refs.invoices.doc(original.id), { creditNoteIssuedMinor: add(related?.docs.filter(d => d.get("status") === "issued").reduce((n, d) => add(n, d.get("issuedAmountMinor")), 0) || 0, note.totalMinor) });
        tx.create(refs.audit.doc(`credit-issue-${id}`), { action: "credit-note-issue", recordId: id, actor: access.userId, at: now, before: { status: "draft" }, after: { number: posted.number, issuedAmountMinor: posted.issuedAmountMinor }, reason: note.input.reason });
        return posted;
    });
}
export async function disposeCredit(tenantId: string, idToken: string, id: string, request: CreditRequest) {
    const access = await requireFinanceOwner(tenantId, idToken);
    resourceId(id);
    resourceId(request.id);
    if (request.invoiceId)
        resourceId(request.invoiceId);
    const refs = financeRefs(tenantId), ref = notes(tenantId).doc(id);
    return adminDb.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        if (!doc.exists)
            throw Error("Credit note not found");
        const note = doc.data() as CreditNote;
        const reversed = request.kind === "reversal" ? note.entries.find(e => e.id === request.entryId) : undefined;
        const target = request.kind === "allocation" ? request.invoiceId : reversed?.invoiceId;
        const invoiceDoc = target ? await tx.get(refs.invoices.doc(target)) : undefined;
        const targetInvoice = invoiceDoc ? invoice(invoiceDoc) : undefined;
        const result = creditEntry(note, request, targetInvoice, sydneyDate(), access.userId);
        if (result.reused)
            return note;
        if (targetInvoice && result.invoiceDeltaMinor) {
            const [creditDocs, receiptDocs] = await Promise.all([tx.get(notes(tenantId).limit(201)), tx.get(refs.receipts.limit(20001))]);
            if (creditDocs.size > 200 || receiptDocs.size > 20000)
                throw Error("Invoice settlement history exceeds the supported limit; no credit action saved");
            const updatedNote = { ...note, ...result.state, entries: [...note.entries, result.entry] };
            assertInvoiceCreditTimeline(targetInvoice, [...creditDocs.docs.filter(d => d.id !== note.id).map(d => d.data() as CreditNote), updatedNote], receiptDocs.docs.map(d => d.data() as import("@/lib/finance/types").Receipt));
            const creditAppliedMinor = add(targetInvoice.creditAppliedMinor, result.invoiceDeltaMinor), balanceDueMinor = add(targetInvoice.totalMinor, -targetInvoice.amountPaidMinor, -creditAppliedMinor);
            if (balanceDueMinor < 0)
                throw Error("Credit would overpay the invoice");
            const financial = financialInvoice(invoiceDoc!.id, invoiceDoc!.data()!);
            tx.update(invoiceDoc!.ref, { creditAppliedMinor, balanceDueMinor, status: receiptInvoiceStatus({ ...financial, creditAppliedMinor }, targetInvoice.amountPaidMinor), updatedAt: Timestamp.now() });
        }
        const now = new Date().toISOString(), next = { ...note, ...result.state, entries: [...note.entries, result.entry], revision: note.revision + 1, updatedAt: now };
        tx.update(ref, next as unknown as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
        tx.create(refs.audit.doc(`credit-${id}-${request.id}`), { action: `credit-${request.kind}`, recordId: id, actor: access.userId, at: now, before: creditState(note), after: { ...result.state, entry: result.entry }, reason: request.reason });
        return next;
    });
}
