import type { CreditNote } from "@/lib/credits/types";
import type { InvoiceCorrection } from "@/lib/invoice-corrections/types";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { TenantSettings } from "@/types/tenant";
import { financeRefs, financialInvoice, requireFinanceOwner } from "./firestore";
import { buildFinancialReport, reportCsv, type FinancialReport, type ReportExpense } from "./report";
import type { FinancialPeriod } from "./period";
import type { GstEvidence } from "./gst";
import { identity, resourceId } from "./native-csv";
import type { FinancialAccount, Movement, Receipt, StatementImport } from "./types";

export async function loadFinancialReport(tenantId: string, idToken: string, period: FinancialPeriod) {
  await requireFinanceOwner(tenantId, idToken); const refs = financeRefs(tenantId);
  // All source queries share one Firestore read timestamp, including receipt/invoice projections.
  const { accounts, movements, imports, receipts, invoices, expenses, categories, notes, settings, gst, corrections, credits } = await adminDb.runTransaction(async (tx) => {
    const collections = [refs.accounts, refs.movements, refs.imports, refs.receipts, refs.invoices, refs.tenant.collection("expenses"), refs.tenant.collection("expenseCategories"), refs.tenant.collection("financialReviewNotes"), refs.tenant.collection("financialMigrations")];
    const rows = await Promise.all(collections.map((collection) => tx.get(collection.limit(20001))));
    if (rows[8].docs.some((d) => d.data().status !== "committed")) throw new Error("Owner record setup is incomplete; no partial report was produced. Resume the reviewed backfill first.");
    if (rows.some((r) => r.size > 20000)) throw new Error("Report source limit exceeded; no partial report produced");
    const [settings, gst, corrections, credits] = await Promise.all([tx.get(refs.tenant.collection("settings").doc("business")), tx.get(refs.workpapers.doc("gst-evidence")), tx.get(refs.tenant.collection("invoiceCorrections").limit(101)), tx.get(refs.tenant.collection("creditNotes").limit(201))]);
    if (credits.size > 200) throw new Error("Credit register limit exceeded; no partial report produced");
    if (corrections.size > 100) throw new Error("Correction register limit exceeded; no partial report produced");
    return { accounts: rows[0], movements: rows[1], imports: rows[2], receipts: rows[3], invoices: rows[4], expenses: rows[5], categories: rows[6], notes: rows[7], settings, gst, corrections, credits };
  }, { readOnly: true });
  const committedImports = imports.docs.filter((d) => d.data().status === "committed"), committedIds = new Set(committedImports.map((d) => d.id));
  const records = { accounts: accounts.docs.map((d) => d.data() as FinancialAccount), movements: movements.docs.filter((d) => (d.data().importIds as string[] || []).some((id) => committedIds.has(id))).map((d) => d.data() as Movement), imports: committedImports.map((d) => d.data() as StatementImport), receipts: receipts.docs.map((d) => d.data() as Receipt), invoices: invoices.docs.map((d) => financialInvoice(d.id, d.data())), incompleteImports: imports.size - committedImports.length };
  const expenseRows = expenses.docs.map((d) => { const e = d.data(); return { id: d.id, date: e.date, merchantName: e.merchantName, amountMinor: e.amountMinor, businessUsePercent: e.businessUsePercent, categoryId: e.categoryId, gstTreatment: e.gstTreatment, taxInvoiceStatus: e.taxInvoiceStatus, receiptFileId: e.receiptFileId, reviewStatus: e.reviewStatus, gstRegistrationStatusAtCalculation: e.gstRegistrationStatusAtCalculation, gstRegistrationEffectiveFromAtCalculation: e.gstRegistrationEffectiveFromAtCalculation, gstRegistrationEffectiveToAtCalculation: e.gstRegistrationEffectiveToAtCalculation, financeMovementId: e.financeMovementId } as ReportExpense; });
  const report = buildFinancialReport({ creditNotes: credits.docs.map(d=>d.data() as CreditNote), corrections: corrections.docs.map(d=>d.data() as InvoiceCorrection), ...records, expenses: expenseRows, categoryNames: Object.fromEntries(categories.docs.map((d) => [d.id, String(d.data().name)])), period, registration: (settings.data() as TenantSettings | undefined)?.tax?.gstRegistration, gstEvidence: gst.data() as GstEvidence | undefined });
  for (const note of notes.docs) {
    const value = note.data();
    if (value.status === "unresolved" && typeof value.note === "string" && value.note.trim()) report.exceptions.push(`Pending source review: ${value.note}`);
  }
  if (report.exceptions.length) report.status = "qualified";
  const sourceIdentity = createHash("sha256").update(JSON.stringify(report)).digest("hex");
  return JSON.parse(JSON.stringify({ ...report, sourceIdentity })) as FinancialReport & { sourceIdentity: string };
}

export async function exportFinancialReport(tenantId: string, idToken: string, period: FinancialPeriod, format: "csv" | "xlsx", expectedSourceIdentity: string) {
  const access = await requireFinanceOwner(tenantId, idToken);
  if (!["csv", "xlsx"].includes(format)) throw new Error("Unsupported report format");
  const report = await loadFinancialReport(tenantId, idToken, period);
  if (!expectedSourceIdentity || report.sourceIdentity !== expectedSourceIdentity) throw new Error("Source records changed. Generate the report again before exporting so the screen and download agree.");
  const serialized = JSON.stringify(report), hash = createHash("sha256").update(serialized).digest("hex");
  if (Buffer.byteLength(serialized) > 850000) throw new Error("Report exceeds supported immutable snapshot size; select a shorter period");
  const refs = financeRefs(tenantId), snapshot = refs.snapshots.doc(hash), generatedAt = new Date().toISOString();
  await adminDb.runTransaction(async (tx) => { const old = await tx.get(snapshot); if (old.exists) return; tx.create(snapshot, { id: hash, report, hash, generatedAt, createdBy: access.userId }); tx.create(refs.audit.doc(), { action: "report-snapshot", actor: access.userId, at: generatedAt, recordId: hash, before: null, after: { period, version: report.version }, reason: "Immutable report and export source" }); });
  const name = `bookkeeping-${period.start}-${period.end}-${hash.slice(0, 10)}`;
  if (format === "csv") return { fileName: `${name}.csv`, mimeType: "text/csv;charset=utf-8", base64: Buffer.from(reportCsv(report)).toString("base64"), snapshotId: hash };
  const workbook = new ExcelJS.Workbook(); workbook.creator = "Client Management App";
  const addSheet = (name: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) => { const sheet = workbook.addWorksheet(name); sheet.addRow(headers); for (const row of rows) sheet.addRow(row.map((v) => v ?? "")); sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.columns.forEach((column, i) => { column.width = i === 0 ? 30 : 23; }); sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: headers.length } }; };
  addSheet("Read me", ["Field", "Value"], [["Version", report.version], ["Snapshot SHA256", hash], ["From", period.start], ["Through", period.end], ["Date zone", "Australia/Sydney"], ["Status", report.status], ["Money", "Integer AUD cents; no rounding to BAS whole dollars"], ["Basis", report.basis], ["Scope", "Preparation and bookkeeping; not lodged or paid"]]);
  addSheet("Summary cents", ["Metric", "AUD minor units"], Object.entries(report.totals));
  addSheet("Received cash", ["Receipt", "Date", "AUD cents", "Account", "Movement", "Evidence"], report.receipts.map((r) => [r.id, r.date, r.amountMinor, r.accountId, r.movementId, r.evidence]));
  addSheet("Allocations", ["Receipt", "Invoice", "Number", "AUD cents"], report.receipts.flatMap((r) => r.allocations.map((a) => [r.id, a.invoiceId, a.invoiceNumber, a.amountMinor])));
  addSheet("Expense bridge", ["Source", "Date", "Merchant", "Category", "Gross", "Work", "Private", "GST credit", "Operating", "Capital", "Allowance", "Not deductible", "Movement", "Expense", "Evidence", "Exceptions"], report.costs.map((c) => [c.id, c.date, c.description, c.category, c.grossMinor, c.workMinor, c.privateMinor, c.gstCreditMinor, c.operatingMinor, c.capitalMinor, c.allowanceMinor, c.nonDeductibleMinor, c.movementId, c.expenseId, c.evidence, c.exceptions.join("; ")]));
  addSheet("Invoice corrections", ["Correction", "State", "Credit", "Replacement", "New issue date", "Original numbers", "Original issue dates", "Service periods", "Credit cents", "Replacement cents", "Carried cents", "Balance cents", "Evidence", "Unresolved", "Original PDF hashes"], (report.correctionRegister || []).map(c=>[c.id,c.status,c.credit,c.replacement,c.issueDate,c.originals,c.originalIssueDates,c.servicePeriods,c.signedCreditMinor,c.replacementMinor,c.paymentCarryMinor,c.balanceMinor,c.evidence,c.unresolved,c.attachmentHashes]));
  addSheet("Client credits", ["ID","Number","Client","Currency","Original invoice","Issue date","Supply date","Reference","Reason","Net","Tax","Issued","Applied","Recorded refunds","Available"], (report.creditRegister||[]).map(c=>[c.id,c.number,c.client,c.currency,c.original,c.issueDate,c.supplyDate,c.reference,c.reason,c.netMinor,c.taxMinor,c.issuedMinor,c.appliedMinor,c.refundedMinor,c.availableMinor]));
  addSheet("Credit history", ["Credit","Date","Action","Amount","Invoice","Reverses","Reference","Reason"], (report.creditHistory||[]).map(e=>[e.creditId,e.date,e.kind,e.amountMinor,e.invoiceId,e.reverses,e.reference,e.reason]));
  addSheet("Invoice balances", ["ID", "Number", "Issue date", "Total", "Dated paid through end", "Credits through end", "Dated ledger remaining", "Undated paid", "Current balance"], report.invoices.map((i) => [i.id, i.number, i.issueDate, i.totalMinor, i.datedPaidThroughEndMinor, i.creditsAppliedThroughEndMinor||0, i.datedLedgerRemainingMinor, i.legacyUndatedMinor, i.currentBalanceMinor]));
  addSheet("Categories", ["Category", "Gross", "Work", "Operating", "Capital", "Allowance"], report.categories.map((c) => [c.category, c.grossMinor, c.workMinor, c.operatingMinor, c.capitalMinor, c.allowanceMinor]));
  addSheet("Coverage", ["Account", "First source", "Last source", "Complete period", "Control gaps", "Unreviewed"], report.coverage.map((c) => [c.label, c.first, c.last, c.throughPeriod, c.controlGaps, c.unreviewed]));
  addSheet("Exclusions", ["Kind", "Count", "Net cents"], report.exclusions.map((e) => [e.kind, e.count, e.netMinor]));
  addSheet("Exceptions", ["Outstanding evidence / qualification"], report.exceptions.map((e) => [e]));
  return { fileName: `${name}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64"), snapshotId: hash };
}

/** Copy only an owner-reviewed business debit into the existing expense workflow. */
export async function prepareMovementExpense(tenantId: string, idToken: string, movementId: string) {
  const access = await requireFinanceOwner(tenantId, idToken); resourceId(movementId);
  const refs = financeRefs(tenantId), candidateId = identity("finance-expense", movementId), candidateRef = refs.tenant.collection("expenseCandidates").doc(candidateId);
  await adminDb.runTransaction(async (tx) => {
    const [source, candidate] = await Promise.all([tx.get(refs.movements.doc(movementId)), tx.get(candidateRef)]);
    if (!source.exists) throw new Error("Source movement not found");
    const m = source.data() as Movement;
    if (m.kind !== "expense" || m.amountMinor >= 0 || !m.evidence?.trim() || !m.businessUseBps || m.businessUseBps % 100) throw new Error("First review this business expense with evidence and a whole work-use percentage");
    if (m.receiptId || m.transferId) throw new Error("Movement is linked to another ledger event");
    if (m.expenseId) return;
    if (candidate.exists) return;
    const importIds = source.data()!.importIds as string[], sources = await tx.getAll(...importIds.map((id) => refs.imports.doc(id)));
    if (!sources.some((d) => d.data()?.status === "committed")) throw new Error("Source import is incomplete");
    const now = FieldValue.serverTimestamp();
    tx.create(candidateRef, { id: candidateId, tenantId, financeMovementId: movementId, importBatchId: `native-${importIds[0]}`, sourceFormat: "csv", sourceAccountKey: m.accountId, sourceTransactionId: movementId, transactionFingerprint: m.fingerprint, occurrenceIndex: m.occurrence, duplicateStatus: "new", postedDate: m.date, rawDescription: m.description, normalizedMerchantName: m.description, amountMinor: -m.amountMinor, currency: "AUD", direction: "debit", reviewStatus: m.businessUseBps === 10000 ? "business" : "mixed_use", retentionStatus: "active", suggested: { source: "merchant_history", confidence: 1, businessUsePercent: m.businessUseBps / 100 }, createdAt: now, updatedAt: now, createdBy: access.userId, reviewedAt: now, reviewedBy: access.userId });
    tx.create(refs.audit.doc(), { action: "expense-review-link", recordId: movementId, actor: access.userId, at: new Date().toISOString(), before: null, after: { candidateId }, reason: m.evidence });
  });
  return candidateId;
}
