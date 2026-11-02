import { add, minor, portion } from "@/lib/finance/money";
import { calendarDate } from "@/lib/finance/period";
import type { ReceiptAllocation } from "@/lib/finance/types";
import type { CorrectionContext, CorrectionInput, CorrectionLine, CorrectionPreview } from "./types";

const text = (value: string, label: string, max = 4000) => { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} is required (maximum ${max} characters)`); };
/** Shared by prepared preview and atomic posting. Never infers registration or cash. */
export function previewCorrection(input: CorrectionInput, context: CorrectionContext): CorrectionPreview {
  text(input.id, "Correction identity", 100); text(input.reason, "Reason for credit");
  if (!Array.isArray(input.originalIds) || !input.originalIds.length || input.originalIds.length > 10 || new Set(input.originalIds).size !== input.originalIds.length) throw new Error("Select one to ten distinct original invoices");
  if (!Array.isArray(input.periods) || !Array.isArray(input.receiptMatches) || !Array.isArray(input.unresolved) || !Array.isArray(input.omittedLines) || !Array.isArray(input.attachments) || input.periods.length > 100 || input.receiptMatches.length > 100 || input.omittedLines.length > 100 || input.unresolved.length > 30) throw new Error("Invalid correction detail or supported bounds exceeded");
  if (![0, 1000].includes(input.taxRateBps)) throw new Error("Choose explicit zero GST or 10% GST on top");
  const originals = input.originalIds.map(id => { const original = context.originals.find(o => o.id === id); if (!original) throw new Error("Original invoice missing"); return original; });
  if (new Set(originals.map(o => o.clientId)).size !== 1 || originals.some(o => o.currency !== "AUD")) throw new Error("Originals must be for the same client in AUD");
  if (originals.some(o => ["draft", "void", "credited"].includes(o.status) || o.snapshot.creditedBy || o.snapshot.correctionId)) throw new Error("Original is unavailable or already credited");
  const sum = (values: number[]) => add(...values);
  for (const o of originals) {
    calendarDate(o.issueDate);
    if (!o.lines.length || o.lines.length > 100 || o.lines.some(l => minor(l.subtotalMinor) < 0 || minor(l.taxMinor) < 0 || add(l.subtotalMinor, l.taxMinor) !== minor(l.totalMinor)) || sum(o.lines.map(l => l.subtotalMinor)) !== minor(o.subtotalMinor) || sum(o.lines.map(l => l.taxMinor)) !== minor(o.taxMinor) || add(o.subtotalMinor, o.taxMinor) !== minor(o.totalMinor)) throw new Error("Original line economics do not reconcile");
  }
  const lineKey = (invoiceId: string, lineIndex: number) => `${invoiceId}:${lineIndex}`;
  const validLine = (invoiceId: string, index: number) => Number.isSafeInteger(index) && index >= 0 && originals.some(o => o.id === invoiceId && index < o.lines.length);
  for (const records of [input.periods, input.omittedLines]) if (new Set(records.map(p => lineKey(p.invoiceId, p.lineIndex))).size !== records.length || records.some(p => !validLine(p.invoiceId, p.lineIndex))) throw new Error("Invalid or duplicate original line reference");
  for (const p of input.periods) { calendarDate(p.from); calendarDate(p.through); if (p.from > p.through || p.through > context.today) throw new Error("Service period is reversed or in the future"); }
  for (const omission of input.omittedLines) text(omission.reason, "Omitted-line authority");
  const blockers: string[] = [];
  if (input.unresolved.some(value => typeof value !== "string" || value.length > 2000)) throw new Error("Invalid unresolved fact");

  if (!input.dueDate) blockers.push("Confirm the replacement payment due date.");
  else if (calendarDate(input.dueDate) < context.today) blockers.push("Replacement due date is before the proposed issue date.");
  const lines: CorrectionLine[] = [];
  for (const o of originals) for (const [index, line] of o.lines.entries()) {
    if (input.omittedLines.some(p => p.invoiceId === o.id && p.lineIndex === index)) continue;
    const period = input.periods.find(p => p.invoiceId === o.id && p.lineIndex === index);
    if (!period) blockers.push(`${o.number}, line ${index + 1}: enter service dates.`);
    if (input.taxRateBps) {
      const reg = context.registration;
      if (!reg || reg.status !== "registered" || !reg.effectiveFrom) blockers.push("GST is not enabled for these services. Check the GST registration dates in business settings.");
      else if (period && (period.from < calendarDate(reg.effectiveFrom) || (reg.effectiveTo && period.through > calendarDate(reg.effectiveTo)))) blockers.push(`${o.number}, line ${index + 1}: service dates fall outside your GST registration dates.`);
    }
    const taxMinor = portion(line.subtotalMinor, input.taxRateBps);
    lines.push({ ...line, originalInvoiceId: o.id, originalNumber: o.number, originalLineIndex: index, serviceFrom: period?.from || "", serviceThrough: period?.through || "", gstApplicable: input.taxRateBps > 0, taxMinor, totalMinor: add(line.subtotalMinor, taxMinor) });
  }
  if (!lines.length) throw new Error("Replacement needs at least one retained line");
  const replacementId = `replacement-${input.id}`;
  const selected = new Set(input.originalIds), seenMatches = new Set<string>();
  for (const match of input.receiptMatches) {
    const key = `${match.receiptId}:${match.invoiceId}`;
    if (!selected.has(match.invoiceId) || seenMatches.has(key)) throw new Error("Invalid or duplicate receipt match");
    seenMatches.add(key); text(match.evidence, "Remittance matching evidence");
    if (minor(match.amountMinor) <= 0) throw new Error("Matched amount must be positive integer cents");
    const receipt = context.receipts.find(r => r.id === match.receiptId);
    if (!receipt || receipt.reversedBy || receipt.reversalOf) throw new Error("Matched receipt missing or reversed");
    if (receipt.allocations.some(a => a.invoiceId === match.invoiceId)) throw new Error("Receipt is already allocated to that original; it will carry automatically");
  }
  const receiptChanges: CorrectionPreview["receiptChanges"] = [];
  const sourcePaid = new Map<string, number>();
  const nextPaid = new Map<string, number>();
  for (const receipt of context.receipts.filter(r => !r.reversedBy && !r.reversalOf)) {
    calendarDate(receipt.date);
    if (receipt.date > context.today) throw new Error("Receipt date cannot be in the future");
    const matches = input.receiptMatches.filter(m => m.receiptId === receipt.id);
    const before = receipt.allocations;
    if (!before.some(a => selected.has(a.invoiceId)) && !matches.length) continue;
    const used = sum(before.map(a => minor(a.amountMinor)));
    if (used > minor(receipt.amountMinor) || receipt.amountMinor <= 0 || matches.some(m => m.amountMinor <= 0) || before.some(a => a.amountMinor <= 0)) throw new Error("Receipt allocation economics are inconsistent");
    if (sum(matches.map(m => m.amountMinor)) > add(receipt.amountMinor, -used)) throw new Error("Matches exceed unallocated receipt cash");
    const origins: { invoiceId: string; amountMinor: number }[] = [];
    for (const a of before.filter(a => selected.has(a.invoiceId))) {
      sourcePaid.set(a.invoiceId, add(sourcePaid.get(a.invoiceId) || 0, a.amountMinor));
      origins.push({ invoiceId: a.invoiceId, amountMinor: a.amountMinor });
    }
    for (const m of matches) origins.push({ invoiceId: m.invoiceId, amountMinor: m.amountMinor });
    for (const origin of origins) nextPaid.set(origin.invoiceId, add(nextPaid.get(origin.invoiceId) || 0, origin.amountMinor));
    const carriedMinor = sum(origins.map(a => a.amountMinor));
    const after: ReceiptAllocation[] = [...before.filter(a => !selected.has(a.invoiceId)), { invoiceId: replacementId, amountMinor: carriedMinor, correctionId: input.id, originalAllocations: origins }];
    receiptChanges.push({ id: receipt.id, before, after });
  }
  for (const o of originals) {
    if (o.legacyUndatedMinor || o.amountPaidMinor !== o.ledgerPaidMinor || (sourcePaid.get(o.id) || 0) !== o.ledgerPaidMinor) blockers.push(`${o.number}: payment totals do not match recorded receipts. Reconcile payments for this invoice.`);
    if ((nextPaid.get(o.id) || 0) > o.totalMinor) throw new Error("Matched payments exceed an original total");
  }
  const subtotalMinor = sum(lines.map(l => l.subtotalMinor)), taxMinor = sum(lines.map(l => l.taxMinor));
  const totalMinor = add(subtotalMinor, taxMinor), carriedMinor = sum(receiptChanges.flatMap(c => c.after.filter(a => a.invoiceId === replacementId).map(a => a.amountMinor)));
  if (carriedMinor > totalMinor) throw new Error("Carried payments exceed replacement total; a separate approved credit/refund decision is required");
  if (receiptChanges.length > 100) throw new Error("Too many receipt changes for one atomic correction");
  return { creditSubtotalMinor: -sum(originals.map(o => o.subtotalMinor)), creditTaxMinor: -sum(originals.map(o => o.taxMinor)), creditTotalMinor: -sum(originals.map(o => o.totalMinor)), subtotalMinor, taxMinor, totalMinor, carriedMinor, balanceMinor: add(totalMinor, -carriedMinor), lines, blockers: [...new Set(blockers)], receiptChanges };
}
