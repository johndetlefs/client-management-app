import {assertInvoiceCreditTimeline} from "@/lib/credits/domain";
import type {CreditNote} from "@/lib/credits/types";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { firebaseDataMode } from "@/lib/firebase-environment";
import { requireBusinessAccess } from "@/lib/business/server-access";
import { add, minor, portion } from "./money";
import { financialDate, identity, parseNativeStatement, reconcileStatement, resolveMovementImport, resourceId } from "./native-csv";
import { receiptInvoiceStatus, receiptRequestSignature, validateAllocations, validateReceipt, validateTransfer } from "./ledger";
import type { CsvMapping, FinancialAccount, FinancialInvoice, Movement, MovementKind, Receipt, ReceiptAllocation, StatementImport } from "./types";

const MAX_RECORDS = 20000;
export function financeRefs(tenantId: string) {
  resourceId(tenantId, "tenant");
  const tenant = adminDb.doc(`tenants/${tenantId}`);
  return { tenant, accounts: tenant.collection("financialAccounts"), movements: tenant.collection("financialMovements"), imports: tenant.collection("financialImports"), receipts: tenant.collection("invoiceReceipts"), invoices: tenant.collection("invoices"), audit: tenant.collection("financialAudit"), workpapers: tenant.collection("ownerTaxWorkpapers"), obligations: tenant.collection("taxObligations"), payments: tenant.collection("taxPayments"), snapshots: tenant.collection("financialReportSnapshots") };
}

/** Personal bank/card source data and personal tax workpapers are owner-only. */
export async function requireFinanceOwner(tenantId: string, idToken: string) {
  const access = await requireBusinessAccess({ tenantId, idToken, capability: "business.read" });
  if (access.role !== "owner") throw new Error("Financial records require the business owner");
  return access;
}

export function serializeFinancialDate(value: unknown): string {
  const date = value instanceof Date ? value : value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate() : null;
  if (!date || !Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (kind: string) => parts.find((p) => p.type === kind)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function financialInvoice(id: string, data: Record<string, unknown>): FinancialInvoice {
  const paid = minor(data.amountPaidMinor ?? 0);
  const ledgerPaidMinor = minor(data.ledgerPaidMinor ?? 0);
  const legacyUndatedMinor = minor(data.legacyUndatedMinor ?? paid);
  const dueDate = data.dueDate instanceof Date ? data.dueDate : data.dueDate && typeof data.dueDate === "object" && "toDate" in data.dueDate ? (data.dueDate as { toDate(): Date }).toDate() : undefined;
  return { id, clientId:String(data.clientId||""),currency:String(data.currency||"AUD"),creditAppliedMinor:minor(data.creditAppliedMinor||0), number: String(data.invoiceDisplayNumber || data.invoiceNumber || id), issueDate: serializeFinancialDate(data.issueDate), totalMinor: minor(data.totalMinor), amountPaidMinor: paid, balanceDueMinor: minor(data.balanceDueMinor ?? add(minor(data.totalMinor), -paid,-minor(data.creditAppliedMinor||0))), status: String(data.status), ...(data.creditedBy ? { creditedBy: String(data.creditedBy), creditedAt: String(data.creditedAt) } : {}), ...(data.correctionId ? { correctionId: String(data.correctionId) } : {}), ledgerPaidMinor, legacyUndatedMinor, taxMinor: minor(data.taxMinor ?? 0), ...(dueDate ? { dueDate: dueDate.toISOString() } : {}) };
}

async function bounded(collection: FirebaseFirestore.CollectionReference) {
  const snapshot = await collection.limit(MAX_RECORDS + 1).get();
  if (snapshot.size > MAX_RECORDS) throw new Error("Financial history exceeds the supported report batch; no partial report was produced");
  return snapshot;
}

export async function loadFinance(tenantId: string, idToken: string) {
  await requireFinanceOwner(tenantId, idToken);
  const refs = financeRefs(tenantId);
  const [accounts, movements, imports, receipts, invoices, migrations] = await Promise.all([bounded(refs.accounts), bounded(refs.movements), bounded(refs.imports), bounded(refs.receipts), bounded(refs.invoices), bounded(refs.tenant.collection("financialMigrations"))]);
  if (migrations.docs.some((d) => d.data().status !== "committed")) throw new Error("Owner record setup is incomplete. Resume its reviewed backfill before using reports or editing imported records.");
  const importRows = imports.docs.filter((d) => d.data().status === "committed").map((d) => d.data() as StatementImport);
  const committed = new Set(importRows.map((r) => r.id));
  const movementRows = movements.docs.filter((d) => (d.data().importIds as string[] || []).some((id) => committed.has(id))).map((d) => {
    const { importIds: _imports, ...row } = d.data();
    void _imports;
    return row as Movement;
  });
  return { dataEnvironment: firebaseDataMode, accounts: accounts.docs.map((d) => d.data() as FinancialAccount), movements: movementRows, imports: importRows, incompleteImports: imports.size - importRows.length, receipts: receipts.docs.map((d) => d.data() as Receipt), invoices: invoices.docs.map((d) => financialInvoice(d.id, d.data())) };
}

export interface NativeImportInput {
  accountId: string;
  label: string;
  type: "bank" | "card";
  csvText: string;
  mapping: CsvMapping;
  completeDays: boolean;
  openingMinor?: number;
  closingMinor?: number;
}

function mappingSignature(mapping: CsvMapping) { return JSON.stringify([mapping.date, mapping.description, mapping.debit, mapping.credit, mapping.balance || ""]); }

export async function previewNativeImport(tenantId: string, idToken: string, input: NativeImportInput) {
  await requireFinanceOwner(tenantId, idToken);
  validateImportInput(input);
  const parsed = parseNativeStatement(input.csvText, input.accountId, input.mapping);
  const refs = financeRefs(tenantId);
  const [existing, source] = await Promise.all([refs.movements.where("accountId", "==", input.accountId).limit(MAX_RECORDS + 1).get(), refs.imports.doc(identity(input.accountId, parsed.sourceHash, "native-import-1")).get()]);
  if (existing.size > MAX_RECORDS) throw new Error("Account exceeds supported import comparison size");
  if (source.exists && mappingSignature(source.data()!.mapping) !== mappingSignature(input.mapping)) throw new Error("This source file already has a different mapping. Correct the original import explicitly before reinterpreting it.");
  const existingRows = existing.docs.map((d) => d.data() as Movement);
  const knownCommitted = source.data()?.status === "committed";
  if (knownCommitted && parsed.rows.some((r) => !existingRows.some((old) => old.id === r.id && old.date === r.date && old.amountMinor === r.amountMinor))) throw new Error("Committed source has missing or inconsistent movements; repair its audit trail before retrying");
  const decision = knownCommitted ? { newRows: [], duplicates: parsed.rows.length } : resolveMovementImport(parsed.rows, existingRows, input.completeDays);
  return { ...parsed, newCount: decision.newRows.length, duplicateCount: decision.duplicates, control: reconcileStatement(parsed.rows, input.openingMinor, input.closingMinor) };
}

function validateImportInput(input: NativeImportInput) {
  resourceId(input.accountId, "account");
  if (!input.label?.trim() || input.label.length > 100 || !["bank", "card"].includes(input.type) || typeof input.completeDays !== "boolean") throw new Error("Account label, type and complete-day declaration required");
  if (input.openingMinor !== undefined) minor(input.openingMinor);
  if (input.closingMinor !== undefined) minor(input.closingMinor);
  if (!input.mapping || [input.mapping.date, input.mapping.description, input.mapping.debit, input.mapping.credit].some((v) => typeof v !== "string" || !v.trim() || v.length > 100) || input.mapping.balance !== undefined && typeof input.mapping.balance !== "string") throw new Error("Invalid column mapping");
}

/** Staged row transactions become report-visible only after the import commit marker. Safe to resume. */
export async function commitNativeImport(tenantId: string, idToken: string, input: NativeImportInput) {
  const access = await requireFinanceOwner(tenantId, idToken);
  const preview = await previewNativeImport(tenantId, idToken, input);
  const refs = financeRefs(tenantId);
  const id = identity(input.accountId, preview.sourceHash, "native-import-1");
  const importRef = refs.imports.doc(id);
  const now = new Date().toISOString();
  const mapping: CsvMapping = { date: input.mapping.date, description: input.mapping.description, debit: input.mapping.debit, credit: input.mapping.credit, ...(input.mapping.balance ? { balance: input.mapping.balance } : {}) };
  const account: FinancialAccount = { id: input.accountId, label: input.label.trim(), type: input.type, currency: "AUD", mapping };
  const alreadyCommitted = await adminDb.runTransaction(async (tx) => {
    const [oldImport, oldAccount] = await Promise.all([tx.get(importRef), tx.get(refs.accounts.doc(input.accountId))]);
    if (oldAccount.exists && oldAccount.data()!.type !== input.type) throw new Error("Account identity has a different type");
    if (oldImport.exists && mappingSignature(oldImport.data()!.mapping) !== mappingSignature(mapping)) throw new Error("This source file already has a different mapping");
    if (oldImport.data()?.status === "committed" && !(oldImport.data()?.rawSourceHashes || []).includes(preview.rawSourceHash)) {
      tx.update(importRef, { rawSourceHashes: FieldValue.arrayUnion(preview.rawSourceHash), parserVersion: preview.parserVersion });
      tx.create(refs.audit.doc(), { action: "source-file-variant-observed", actor: access.userId, at: now, recordId: id, before: { rawSourceHashes: oldImport.data()?.rawSourceHashes || [] }, after: { rawSourceHash: preview.rawSourceHash }, reason: "Exact file bytes observed for the same canonical source; financial rows unchanged" });
    }
    if (oldImport.data()?.status === "committed" && oldAccount.exists && mappingSignature(oldAccount.data()!.mapping) !== mappingSignature(mapping)) {
      tx.set(refs.accounts.doc(input.accountId), account, { mergeFields: ["id", "label", "type", "currency", "mapping"] });
      tx.create(refs.audit.doc(), { action: "account-mapping-restore", actor: access.userId, at: now, recordId: input.accountId, before: { mapping: oldAccount.data()!.mapping }, after: { mapping }, reason: "Owner re-imported a committed source using its reviewed mapping; financial rows unchanged" });
    }
    if (!oldImport.exists) tx.create(importRef, { id, accountId: input.accountId, sourceHash: preview.sourceHash, mapping, status: "staging", createdAt: now, createdBy: access.userId });
    return oldImport.data()?.status === "committed";
  });
  if (alreadyCommitted) return { id, rowCount: preview.rows.length, newCount: 0, duplicateCount: preview.rows.length, control: preview.control };
  for (let start = 0; start < preview.rows.length; start += 180) {
    const rows = preview.rows.slice(start, start + 180);
    await adminDb.runTransaction(async (tx) => {
      const snapshots = await tx.getAll(...rows.map((row) => refs.movements.doc(row.id)));
      snapshots.forEach((snapshot, index) => {
        const row = rows[index];
        if (!snapshot.exists) tx.create(snapshot.ref, { ...row, importIds: [id] });
        else {
          const existing = snapshot.data() as Movement;
          if (existing.accountId !== row.accountId || existing.amountMinor !== row.amountMinor || existing.date !== row.date || existing.fingerprint !== row.fingerprint) throw new Error("Movement identity conflict");
          tx.update(snapshot.ref, { importIds: FieldValue.arrayUnion(id) });
        }
      });
    });
  }
  const metadata: StatementImport = { id, accountId: input.accountId, sourceHash: preview.sourceHash, rawSourceHashes: [preview.rawSourceHash], parserVersion: preview.parserVersion, mapping, start: preview.start, end: preview.end, rowCount: preview.rows.length, debitMinor: preview.debitMinor, creditMinor: preview.creditMinor, sourceRows: preview.rows.map((r) => ({ movementId: r.id, row: r.sourceRow, ...(r.balanceMinor === undefined ? {} : { balanceMinor: r.balanceMinor }) })), completeDays: input.completeDays, control: preview.control, createdAt: now, createdBy: access.userId };
  await adminDb.runTransaction(async (tx) => {
    const [previous, oldAccount] = await Promise.all([tx.get(importRef), tx.get(refs.accounts.doc(input.accountId))]);
    if (previous.data()?.status === "committed") return;
    tx.set(importRef, { ...metadata, status: "committed" });
    // Replace the mapping map so clearing an optional column stays cleared.
    tx.set(refs.accounts.doc(input.accountId), account, { mergeFields: ["id", "label", "type", "currency", "mapping"] });
    tx.create(refs.audit.doc(`import-${id}`), { id: `import-${id}`, action: "import-commit", actor: access.userId, at: now, recordId: id, before: oldAccount.exists ? { accountExists: true } : null, after: { rows: metadata.rowCount, sourceHash: metadata.sourceHash }, reason: "Owner-reviewed statement import; corrections retain source identity" });
  });
  return { id, rowCount: preview.rows.length, newCount: preview.newCount, duplicateCount: preview.duplicateCount, control: preview.control };
}

const kinds: MovementKind[] = ["unreviewed", "business_receipt", "expense", "supplier_refund", "salary", "transfer", "personal", "drawings", "capital", "loan", "tax_payment"];
export type MovementReview = Pick<Movement, "kind" | "category" | "businessUseBps" | "evidence" | "receiptEvidence" | "taxTreatment" | "allowanceMinor" | "gstIncludedMinor" | "gstClaimableMinor" | "refundOf" | "expenseId">;
const reviewFields = ["kind", "category", "businessUseBps", "evidence", "receiptEvidence", "taxTreatment", "allowanceMinor", "gstIncludedMinor", "gstClaimableMinor", "refundOf", "expenseId"] as const;
export async function reviewMovement(tenantId: string, idToken: string, id: string, expectedRevision: number, review: MovementReview) {
  const access = await requireFinanceOwner(tenantId, idToken);
  resourceId(id, "movement");
  if (!review || typeof review !== "object" || Array.isArray(review) || Object.keys(review).some((key) => !(reviewFields as readonly string[]).includes(key))) throw new Error("Unsupported movement review field; source and receipt/transfer links are immutable");
  if (!kinds.includes(review.kind) || ["transfer", "business_receipt"].includes(review.kind)) throw new Error("Use transfer pairing or receipt recording for this classification");
  if (!Number.isInteger(review.businessUseBps ?? 0) || (review.businessUseBps ?? 0) < 0 || (review.businessUseBps ?? 0) > 10000) throw new Error("Invalid work use percentage");
  if ((review.evidence?.length || 0) > 2000 || (review.category?.length || 0) > 150) throw new Error("Review text exceeds limit");
  if (["expense", "supplier_refund"].includes(review.kind) && (!review.category?.trim() || review.businessUseBps === undefined || !review.evidence?.trim())) throw new Error("Work review requires category, work use and evidence/purpose");
  if (review.taxTreatment && !["operating", "asset_review", "non_deductible"].includes(review.taxTreatment)) throw new Error("Invalid tax treatment");
  if (review.receiptEvidence && !["missing", "attached", "not_required"].includes(review.receiptEvidence)) throw new Error("Invalid receipt evidence");
  for (const key of ["allowanceMinor", "gstIncludedMinor", "gstClaimableMinor"] as const) if (review[key] !== undefined && minor(review[key]) < 0) throw new Error("Adjustment amounts cannot be negative");
  const refs = financeRefs(tenantId), ref = refs.movements.doc(id);
  await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new Error("Movement not found");
    const old = snapshot.data() as Movement;
    const importIds = snapshot.data()!.importIds as string[];
    const importDocs = await tx.getAll(...importIds.map((key) => refs.imports.doc(key)));
    if (!importDocs.some((s) => s.data()?.status === "committed")) throw new Error("Statement import is incomplete");
    if (old.revision !== expectedRevision) throw new Error("Movement changed; reload before review");
    if (old.receiptId || old.transferId || old.taxPaymentId) throw new Error("Reverse the linked receipt/transfer/tax payment record before changing classification");
    if (review.kind === "expense" && old.amountMinor >= 0 || review.kind === "supplier_refund" && old.amountMinor <= 0) throw new Error("Expense/refund direction differs from source");
    if (review.refundOf) {
      resourceId(review.refundOf, "original purchase");
      const purchase = await tx.get(refs.movements.doc(review.refundOf));
      if (!purchase.exists || purchase.data()!.kind !== "expense" || purchase.data()!.amountMinor >= 0) throw new Error("Refund needs a reviewed original purchase in this tenant");
    }
    if (review.expenseId) {
      resourceId(review.expenseId, "expense");
      const expense = await tx.get(refs.tenant.collection("expenses").doc(review.expenseId));
      if (!expense.exists) throw new Error("Linked expense not found in this tenant");
    }
    // GST is set only through registration-aware accounting, never from an unchecked review field.
    if (review.gstClaimableMinor) throw new Error("GST credit needs registration-aware expense review");
    if ((review.gstIncludedMinor || 0) > Math.abs(old.amountMinor) || (review.allowanceMinor || 0) > portion(Math.abs(old.amountMinor), review.businessUseBps || 0)) throw new Error("Tax adjustment exceeds the reviewed purchase amount");
    const next = Object.fromEntries(reviewFields.filter((key) => review[key] !== undefined).map((key) => [key, review[key]]));
    const optionalFields = ["category", "businessUseBps", "evidence", "receiptEvidence", "taxTreatment", "allowanceMinor", "gstIncludedMinor", "gstClaimableMinor", "refundOf", "expenseId"] as const;
    const removed = Object.fromEntries(optionalFields.filter((key) => review[key] === undefined).map((key) => [key, FieldValue.delete()]));
    const previousReview = Object.fromEntries(["kind", ...optionalFields].filter((key) => old[key as keyof Movement] !== undefined).map((key) => [key, old[key as keyof Movement]]));
    const now = new Date().toISOString();
    tx.update(ref, { ...removed, ...next, revision: expectedRevision + 1, reviewedAt: now, reviewedBy: access.userId, ...(["personal", "salary", "drawings", "loan", "tax_payment"].includes(review.kind) ? { description: `[${review.kind.replaceAll("_", " ")}]` } : {}) });
    tx.create(refs.audit.doc(), { action: "movement-review", actor: access.userId, at: now, recordId: id, before: { ...previousReview, revision: old.revision }, after: next, reason: review.evidence || "Owner classification" });
  });
}

export interface RecordReceiptInput { id: string; date: string; accountId: string; amountMinor: number; movementId?: string; evidence: string; allocations: ReceiptAllocation[] }
export async function recordReceipt(tenantId: string, idToken: string, input: RecordReceiptInput) {
  const access = await requireFinanceOwner(tenantId, idToken);
  resourceId(input.id, "receipt");
  if (input.movementId) resourceId(input.movementId, "movement");
  const refs = financeRefs(tenantId), receiptRef = refs.receipts.doc(input.id);
  return adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(receiptRef);
    if (existing.exists) {
      const prior = existing.data() as Receipt;
      if (prior.reversedBy || prior.reversalOf) throw new Error("This receipt was reversed; review before recording a new receipt");
      if (receiptRequestSignature(prior) !== receiptRequestSignature(input)) throw new Error("Receipt request key was already used for different data");
      return input.id;
    }
    const account = await tx.get(refs.accounts.doc(input.accountId));
    if (!account.exists) throw new Error("Account not found");
    const movementSnapshot = input.movementId ? await tx.get(refs.movements.doc(input.movementId)) : undefined;
    const movement = movementSnapshot?.data() as Movement | undefined;
    validateReceipt(input, movement);
    if (movementSnapshot?.exists) {
      const importIds = movementSnapshot.data()!.importIds as string[];
      const sources = await tx.getAll(...importIds.map((id) => refs.imports.doc(id)));
      if (!sources.some((s) => s.data()?.status === "committed")) throw new Error("Source statement is incomplete");
    }
    if (!Array.isArray(input.allocations) || input.allocations.length > 50) throw new Error("Invalid allocations");
    for (const a of input.allocations) resourceId(a.invoiceId, "invoice");
    const invoiceDocs = input.allocations.length ? await tx.getAll(...input.allocations.map((a) => refs.invoices.doc(a.invoiceId))) : [];
    const invoices = invoiceDocs.filter((d) => d.exists).map((d) => financialInvoice(d.id, d.data()!));
    const updates = validateAllocations(input.amountMinor, input.allocations, invoices);
    const now = new Date().toISOString();
    const receipt: Receipt = { id: input.id, date: input.date, accountId: input.accountId, amountMinor: input.amountMinor, ...(input.movementId ? { movementId: input.movementId } : {}), evidence: input.evidence, allocations: input.allocations.map((a) => ({ invoiceId: a.invoiceId, amountMinor: a.amountMinor, replacesLegacyMinor: a.replacesLegacyMinor || 0 })), source: input.movementId ? "statement" : "manual", createdAt: now, createdBy: access.userId };
    if(invoices.length){
      const [creditDocs,receiptDocs]=await Promise.all([tx.get(refs.tenant.collection("creditNotes").limit(201)),tx.get(refs.receipts.limit(MAX_RECORDS+1))]);
      if(creditDocs.size>200||receiptDocs.size>MAX_RECORDS)throw new Error("Invoice settlement history exceeds the supported limit; no receipt saved");
      const credits=creditDocs.docs.map(d=>d.data() as CreditNote),receipts=[...receiptDocs.docs.map(d=>d.data() as Receipt),receipt];
      for(const invoice of invoices)assertInvoiceCreditTimeline(invoice,credits,receipts);
    }
    tx.create(receiptRef, Object.fromEntries(Object.entries(receipt).filter(([, v]) => v !== undefined)));
    for (const update of updates) {
      const { invoiceId, ...values } = update;
      tx.update(refs.invoices.doc(invoiceId), { ...values, updatedAt: FieldValue.serverTimestamp() });
    }
    if (input.movementId) tx.update(refs.movements.doc(input.movementId), { kind: "business_receipt", receiptId: input.id, evidence: input.evidence, revision: FieldValue.increment(1), reviewedBy: access.userId, reviewedAt: now });
    tx.create(refs.audit.doc(`receipt-${input.id}`), { action: "receipt-record", recordId: input.id, actor: access.userId, at: now, before: null, after: { receiptId: input.id, invoiceIds: updates.map((u) => u.invoiceId) }, reason: input.evidence });
    return input.id;
  });
}

export async function reverseReceipt(tenantId: string, idToken: string, id: string, reason: string) {
  const access = await requireFinanceOwner(tenantId, idToken);
  resourceId(id, "receipt");
  if (!reason.trim() || reason.length > 2000) throw new Error("Correction reason required");
  const refs = financeRefs(tenantId);
  await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(refs.receipts.doc(id));
    if (!snapshot.exists) throw new Error("Receipt not found");
    const receipt = snapshot.data() as Receipt;
    if (receipt.reversedBy) return;
    if (receipt.reversalOf) throw new Error("Cannot reverse a correction record");
    const invoiceDocs = receipt.allocations.length ? await tx.getAll(...receipt.allocations.map((a) => refs.invoices.doc(a.invoiceId))) : [];
    const invoices = invoiceDocs.map((d) => financialInvoice(d.id, d.data()!));
    const movement = receipt.movementId ? await tx.get(refs.movements.doc(receipt.movementId)) : undefined;
    if (movement && movement.data()?.receiptId !== id) throw new Error("Movement receipt link changed");
    for (const invoice of invoices) {
      const allocation = receipt.allocations.find((a) => a.invoiceId === invoice.id)!;
      const ledgerPaidMinor = add(invoice.ledgerPaidMinor, -allocation.amountMinor);
      const legacyUndatedMinor = add(invoice.legacyUndatedMinor, allocation.replacesLegacyMinor || 0);
      if (ledgerPaidMinor < 0) throw new Error("Receipt ledger conflict");
      const amountPaidMinor = add(ledgerPaidMinor, legacyUndatedMinor);
      tx.update(refs.invoices.doc(invoice.id), { ledgerPaidMinor, legacyUndatedMinor, amountPaidMinor, balanceDueMinor: add(invoice.totalMinor, -amountPaidMinor,-(invoice.creditAppliedMinor||0)), status: receiptInvoiceStatus(invoice, amountPaidMinor), updatedAt: FieldValue.serverTimestamp() });
    }
    const reversalId = identity("reversal", id);
    const now = new Date().toISOString();
    tx.update(snapshot.ref, { reversedBy: reversalId });
    tx.create(refs.receipts.doc(reversalId), { ...receipt, id: reversalId, amountMinor: -receipt.amountMinor, allocations: [], reversalOf: id, evidence: reason, createdAt: now, createdBy: access.userId });
    if (movement) tx.update(movement.ref, { receiptId: FieldValue.delete(), kind: "unreviewed", revision: FieldValue.increment(1) });
    tx.create(refs.audit.doc(), { action: "receipt-reverse", recordId: id, actor: access.userId, at: now, before: { receiptId: id }, after: { reversalId }, reason });
  });
}

export async function matchManualReceipt(tenantId: string, idToken: string, receiptId: string, movementId: string) {
  const access = await requireFinanceOwner(tenantId, idToken);
  resourceId(receiptId); resourceId(movementId);
  const refs = financeRefs(tenantId);
  await adminDb.runTransaction(async (tx) => {
    const [receiptDoc, movementDoc] = await Promise.all([tx.get(refs.receipts.doc(receiptId)), tx.get(refs.movements.doc(movementId))]);
    if (!receiptDoc.exists || !movementDoc.exists) throw new Error("Receipt or movement not found");
    const receipt = receiptDoc.data() as Receipt, movement = movementDoc.data() as Movement;
    if (receipt.reversedBy || receipt.reversalOf || receipt.movementId || receipt.source !== "manual") throw new Error("Receipt is unavailable for matching");
    validateReceipt({ ...receipt, movementId }, movement);
    const sourceDocs = await tx.getAll(...(movementDoc.data()!.importIds as string[]).map((id) => refs.imports.doc(id)));
    if (!sourceDocs.some((d) => d.data()?.status === "committed")) throw new Error("Source statement is incomplete");
    tx.update(receiptDoc.ref, { movementId, source: "statement" });
    tx.update(movementDoc.ref, { receiptId, kind: "business_receipt", revision: FieldValue.increment(1) });
    tx.create(refs.audit.doc(), { action: "manual-receipt-match", recordId: receiptId, actor: access.userId, at: new Date().toISOString(), before: null, after: { movementId }, reason: "Match existing receipt; no additional income" });
  });
}

export async function pairTransfer(tenantId: string, idToken: string, aId: string, bId: string, evidence: string) {
  const access = await requireFinanceOwner(tenantId, idToken);
  resourceId(aId); resourceId(bId);
  if (!evidence.trim() || evidence.length > 2000) throw new Error("Transfer evidence required");
  const refs = financeRefs(tenantId), id = identity("transfer", ...[aId, bId].sort());
  await adminDb.runTransaction(async (tx) => {
    const [aDoc, bDoc] = await Promise.all([tx.get(refs.movements.doc(aId)), tx.get(refs.movements.doc(bId))]);
    if (!aDoc.exists || !bDoc.exists) throw new Error("Transfer movement missing");
    const a = aDoc.data() as Movement, b = bDoc.data() as Movement;
    if (a.transferId === id && b.transferId === id) return;
    validateTransfer(a, b);
    const sourceDocs = await tx.getAll(...Array.from(new Set([...(aDoc.data()!.importIds as string[]), ...(bDoc.data()!.importIds as string[])])).map((id) => refs.imports.doc(id)));
    for (const doc of [aDoc, bDoc]) if (!(doc.data()!.importIds as string[]).some((id) => sourceDocs.some((source) => source.id === id && source.data()?.status === "committed"))) throw new Error("Transfer source import is incomplete");
    const now = new Date().toISOString();
    for (const doc of [aDoc, bDoc]) tx.update(doc.ref, { kind: "transfer", transferId: id, description: "[paired account transfer]", evidence, revision: FieldValue.increment(1), reviewedAt: now, reviewedBy: access.userId });
    tx.create(refs.audit.doc(), { action: "transfer-pair", recordId: id, actor: access.userId, at: now, before: null, after: { movementIds: [aId, bId] }, reason: evidence });
  });
  return id;
}

export function newFinancialRequestId() { return randomUUID(); }
export { financialDate };

export async function saveStatementControl(tenantId: string, idToken: string, importId: string, openingMinor: number, closingMinor: number, evidence: string) {
  const access = await requireFinanceOwner(tenantId, idToken);
  resourceId(importId); minor(openingMinor); minor(closingMinor);
  if (!evidence.trim() || evidence.length > 2000) throw new Error("Statement balance evidence required");
  const refs = financeRefs(tenantId);
  await adminDb.runTransaction(async (tx) => {
    const sourceDoc = await tx.get(refs.imports.doc(importId));
    if (!sourceDoc.exists || sourceDoc.data()!.status !== "committed") throw new Error("Committed statement not found");
    const source = sourceDoc.data() as StatementImport;
    const rowDocs = await tx.getAll(...source.sourceRows.map((r) => refs.movements.doc(r.movementId)));
    const rows = source.sourceRows.map((r, index) => { const row = rowDocs[index].data() as Movement; if (!row) throw new Error("Source movement missing"); const { balanceMinor: _balance, ...rest } = row; void _balance; return { ...rest, ...(r.balanceMinor === undefined ? {} : { balanceMinor: r.balanceMinor }), sourceRow: r.row }; });
    const control = reconcileStatement(rows, openingMinor, closingMinor);
    tx.update(sourceDoc.ref, { control, controlEvidence: evidence, controlReviewedAt: new Date().toISOString(), controlReviewedBy: access.userId });
    tx.create(refs.audit.doc(), { action: "statement-control", recordId: importId, actor: access.userId, at: new Date().toISOString(), before: source.control, after: control, reason: evidence });
  });
}

export async function unpairTransfer(tenantId: string, idToken: string, movementId: string, reason: string) {
  const access = await requireFinanceOwner(tenantId, idToken);
  resourceId(movementId);
  if (!reason.trim() || reason.length > 2000) throw new Error("Correction reason required");
  const refs = financeRefs(tenantId);
  await adminDb.runTransaction(async (tx) => {
    const movement = await tx.get(refs.movements.doc(movementId));
    if (!movement.exists || !movement.data()!.transferId) throw new Error("Paired transfer not found");
    const transferId = movement.data()!.transferId as string;
    const matches = await tx.get(refs.movements.where("transferId", "==", transferId));
    if (matches.size !== 2) throw new Error("Transfer pair is inconsistent");
    for (const doc of matches.docs) tx.update(doc.ref, { transferId: FieldValue.delete(), kind: "unreviewed", revision: FieldValue.increment(1) });
    tx.create(refs.audit.doc(), { action: "transfer-unpair", recordId: transferId, actor: access.userId, at: new Date().toISOString(), before: { movementIds: matches.docs.map((d) => d.id) }, after: null, reason });
  });
}
