import { creditState } from "@/lib/credits/domain";
import type { CreditNote } from "@/lib/credits/types";
import type { InvoiceCorrection } from "@/lib/invoice-corrections/types";
import type { Expense } from "@/types/expense";
import type { GstRegistrationSettings } from "@/types/tenant";
import { calculateExpenseAmounts, expenseRegistrationSnapshotMatches } from "@/lib/expenses/calculations";
import { add, minor, portion } from "./money";
import { inPeriod, nextDate, validatePeriod, type FinancialPeriod } from "./period";
import { gstExceptions, type GstEvidence } from "./gst";
import type { FinancialAccount, FinancialInvoice, Movement, Receipt, StatementImport } from "./types";
import { receiptGstAllocations } from "./receipt-gst";

export const FINANCIAL_REPORT_VERSION = "financial-report-v1";
export type ReportExpense = Pick<Expense, "id" | "date" | "merchantName" | "amountMinor" | "businessUsePercent" | "categoryId" | "gstTreatment" | "taxInvoiceStatus" | "receiptFileId" | "reviewStatus" | "gstRegistrationStatusAtCalculation" | "gstRegistrationEffectiveFromAtCalculation" | "gstRegistrationEffectiveToAtCalculation"> & { financeMovementId?: string };
export interface ReportInput {
  corrections?: InvoiceCorrection[];
  creditNotes?: CreditNote[];
  period: FinancialPeriod; movements: Movement[]; receipts: Receipt[]; invoices: FinancialInvoice[];
  accounts: FinancialAccount[]; imports: StatementImport[]; incompleteImports: number;
  expenses: ReportExpense[]; categoryNames: Record<string, string>; registration?: GstRegistrationSettings; gstEvidence?: GstEvidence;
}
export interface CostRow {
  id: string; movementId?: string; expenseId?: string; date: string; description: string; category: string;
  grossMinor: number; workMinor: number; privateMinor: number; gstCreditMinor: number;
  operatingMinor: number; capitalMinor: number; allowanceMinor: number; nonDeductibleMinor: number;
  evidence: string; exceptions: string[];
}
export interface FinancialReport {
  creditRegister?: { id:string; number:string; client:string; currency:string; original:string; issueDate:string; supplyDate:string; reference:string; reason:string; netMinor:number; taxMinor:number; issuedMinor:number; appliedMinor:number; refundedMinor:number; availableMinor:number }[];
  creditHistory?: { creditId:string; date:string; kind:string; amountMinor:number; invoiceId:string; reverses:string; reference:string; reason:string }[];
  correctionRegister?: { id: string; status: string; credit: string; replacement: string; issueDate: string; originals: string; originalIssueDates: string; servicePeriods: string; signedCreditMinor: number; replacementMinor: number; paymentCarryMinor: number; balanceMinor: number; evidence: string; unresolved: string; attachmentHashes: string }[];
  sourceIdentity?: string;
  version: string; period: FinancialPeriod; basis: string;
  totals: { receivedMinor: number; receivedGstMinor: number; allocatedMinor: number; unallocatedMinor: number; grossCostMinor: number; workCostMinor: number; privateCostMinor: number; gstCreditMinor: number; operatingMinor: number; capitalMinor: number; allowanceMinor: number; nonDeductibleMinor: number; cashSurplusMinor: number; indicativeProfitMinor: number; datedLedgerRemainingMinor: number; undatedPaidMinor: number };
  receipts: { id: string; date: string; amountMinor: number; gstMinor: number; accountId: string; movementId?: string; evidence: string; allocations: { invoiceId: string; invoiceNumber: string; amountMinor: number }[] }[];
  costs: CostRow[];
  invoices: { id: string; number: string; issueDate: string; totalMinor: number; datedPaidThroughEndMinor: number; creditsAppliedThroughEndMinor?: number; datedLedgerRemainingMinor: number; legacyUndatedMinor: number; currentBalanceMinor: number }[];
  categories: { category: string; grossMinor: number; workMinor: number; operatingMinor: number; capitalMinor: number; allowanceMinor: number }[];
  exclusions: { kind: string; count: number; netMinor: number }[];
  coverage: { accountId: string; label: string; first: string | null; last: string | null; throughPeriod: boolean; controlGaps: number; unreviewed: number }[];
  gst: { registration: GstRegistrationSettings; evidence: GstEvidence };
  exceptions: string[]; status: "qualified" | "reviewed_sources";
  materialSourceExceptions: string[];
}
const sum = (values: number[]) => add(...values);

/** One cent-exact projection feeds the screen, downloads and stored report snapshots. */
export function buildFinancialReport(input: ReportInput): FinancialReport {
  validatePeriod(input.period);
  const { period } = input, exceptions = gstExceptions(input.registration, input.gstEvidence);
  const materialSourceExceptions: string[] = [];
  const sourceException = (message: string) => { exceptions.push(message); materialSourceExceptions.push(message); };
  const invoicesById = new Map(input.invoices.map((i) => [i.id, i]));
  const allReceipts = input.receipts.filter((r) => !r.reversedBy && !r.reversalOf);
  const receiptTaxes = receiptGstAllocations(allReceipts, input.invoices);
  // A later correction retains the original invoice destinations for earlier receivable snapshots.
  const historicalReceipts = allReceipts.map(r => ({...r, allocations: r.allocations.flatMap(a => a.correctionId && a.originalAllocations && (invoicesById.get(a.invoiceId)?.issueDate || "") > period.end ? a.originalAllocations : [a])}));
  const correctionRegister = (input.corrections || []).map(c => ({id:c.id,status:c.status,credit:c.creditNumber||"prepared",replacement:c.replacementNumber||"prepared",issueDate:c.postingDate||"not issued",originals:c.originals.map(o=>o.number).join("; "),originalIssueDates:c.originals.map(o=>o.issueDate).join("; "),servicePeriods:c.preview.lines.map(l=>`${l.originalNumber}: ${l.serviceFrom||"unconfirmed"}–${l.serviceThrough||"unconfirmed"}`).join("; "),signedCreditMinor:c.preview.creditTotalMinor,replacementMinor:c.preview.totalMinor,paymentCarryMinor:c.preview.carriedMinor,balanceMinor:input.invoices.find(i=>i.id===c.replacementId)?.balanceDueMinor ?? c.preview.balanceMinor,evidence:c.input.evidence,unresolved:c.preview.blockers.join("; "),attachmentHashes:c.input.attachments.map(a=>`${a.name}: ${a.sha256}`).join("; ")}));
  if (correctionRegister.some(c=>c.status==="posted")) sourceException("Credit adjustments have no assigned GST reporting period.");
  const credits = (input.creditNotes || []).filter(c => c.status === "issued" && c.issueDate && c.issueDate <= period.end);
  const creditRegister = credits.map(c => ({id:c.id,number:c.number||c.id,client:c.client.name,currency:c.input.currency,original:c.original?.number||"",issueDate:c.issueDate!,supplyDate:c.input.saleDate,reference:c.input.reference,reason:c.input.reason,netMinor:c.netMinor,taxMinor:c.taxMinor,issuedMinor:c.issuedAmountMinor,...creditState(c,period.end)}));
  const creditHistory = credits.flatMap(c => c.entries.filter(e => e.date <= period.end).map(e => ({creditId:c.id,date:e.date,kind:e.kind,amountMinor:e.amountMinor,invoiceId:e.invoiceId||"",reverses:e.reverses||"",reference:e.reference,reason:e.reason})));
  const appliedByInvoice = new Map<string,number>();
  for (const c of credits) for (const e of c.entries.filter(e => e.date <= period.end)) {
    const original = e.kind === "reversal" ? c.entries.find(o => o.id === e.reverses) : e;
    if (original?.kind === "allocation" && original.invoiceId) appliedByInvoice.set(original.invoiceId,add(appliedByInvoice.get(original.invoiceId)||0,e.kind === "reversal" ? -e.amountMinor : e.amountMinor));
  }
  if (credits.length) sourceException("Client credits and recorded refunds are listed separately from cash receipts. Their GST adjustment periods and any bank refund reconciliation are not assigned by the credit issue date.");
  const receipts = historicalReceipts.filter((r) => inPeriod(r.date, period)).map((r) => ({ id: r.id, date: r.date, accountId: r.accountId, ...(r.movementId ? { movementId: r.movementId } : {}), amountMinor: minor(r.amountMinor), gstMinor: receiptTaxes.get(r.id) || 0, evidence: r.evidence, allocations: r.allocations.map((a) => ({ invoiceId: a.invoiceId, invoiceNumber: invoicesById.get(a.invoiceId)?.number || a.invoiceId, amountMinor: minor(a.amountMinor) })) }));
  for (const r of receipts) if (sum(r.allocations.map((a) => a.amountMinor)) < r.amountMinor) exceptions.push(`Receipt ${r.id}: unallocated business cash requires remittance review.`);
  const expensesById = new Map(input.expenses.map((e) => [e.id, e]));
  const movementsById = new Map(input.movements.map((m) => [m.id, m]));
  const linkedExpenses = new Map<string, string>();
  for (const m of input.movements) if (m.expenseId) {
    if (linkedExpenses.has(m.expenseId)) sourceException(`Expense ${m.expenseId}: linked to multiple source movements; review duplicate evidence.`);
    linkedExpenses.set(m.expenseId, m.id);
  }
  for (const e of input.expenses) if (e.financeMovementId) linkedExpenses.set(e.id, e.financeMovementId);
  function purchase(m: Movement | undefined, e: ReportExpense | undefined): CostRow {
    const grossMinor = e ? minor(e.amountMinor) : -minor(m!.amountMinor);
    if (grossMinor <= 0) throw new Error("Purchase must have a positive cost");
    const workMinor = portion(grossMinor, e ? e.businessUsePercent * 100 : m?.businessUseBps ?? 0);
    const issues: string[] = [];
    if (!e) issues.push("Not yet linked to a confirmed expense; use Expense review for receipts, category and merchant rules.");
    if (!e?.receiptFileId && e?.taxInvoiceStatus !== "not_required") issues.push("Receipt file/substantiation remains to be reviewed.");
    if (m && e && (m.date !== e.date || -m.amountMinor !== e.amountMinor || m.kind !== "expense")) { const message = "Confirmed expense and source movement disagree; correct before relying on this report."; issues.push(message); materialSourceExceptions.push(`${e.id}: ${message}`); }
    const calculation = e ? calculateExpenseAmounts({ amountMinor: grossMinor, businessUsePercent: e.businessUsePercent, expenseDate: e.date, gstTreatment: e.gstTreatment, taxInvoiceStatus: e.receiptFileId ? e.taxInvoiceStatus : e.taxInvoiceStatus === "attached" ? "missing" : e.taxInvoiceStatus, gstRegistration: input.registration }) : undefined;
    if (e && !expenseRegistrationSnapshotMatches(e, input.registration)) issues.push("Registration changed since expense review; current eligibility was recalculated.");
    if (calculation?.reviewRequired) issues.push("GST credit or tax-invoice eligibility needs review.");
    const gstCreditMinor = calculation?.gstAmountMinor || 0, workNet = add(workMinor, -gstCreditMinor);
    const taxTreatment = m?.taxTreatment || (e?.categoryId === "equipment-assets" ? "asset_review" : "operating");
    if (taxTreatment === "asset_review" && m?.allowanceMinor === undefined) issues.push("Capital allowance is unresolved; purchase cost is excluded from operating deductions.");
    if (taxTreatment === "asset_review" && (m?.allowanceMinor || 0) > 0 && !m?.evidence?.trim()) throw new Error("Capital allowance needs evidence");
    if ((m?.allowanceMinor || 0) > workNet) throw new Error("Capital allowance exceeds the work cost excluding eligible GST");
    return { id: e ? `expense:${e.id}` : `movement:${m!.id}`, ...(m ? { movementId: m.id } : {}), ...(e ? { expenseId: e.id } : {}), date: e?.date || m!.date, description: e?.merchantName || m!.description, category: input.categoryNames[e?.categoryId || ""] || m?.category || "Accountant review", grossMinor, workMinor, privateMinor: add(grossMinor, -workMinor), gstCreditMinor, operatingMinor: taxTreatment === "operating" ? workNet : 0, capitalMinor: taxTreatment === "asset_review" ? workNet : 0, allowanceMinor: taxTreatment === "asset_review" ? minor(m?.allowanceMinor ?? 0) : 0, nonDeductibleMinor: taxTreatment === "non_deductible" ? workNet : 0, evidence: m?.evidence || "Confirmed expense review", exceptions: issues };
  }
  const costs: CostRow[] = [];
  for (const e of input.expenses) if (inPeriod(e.date, period)) costs.push(purchase(movementsById.get(linkedExpenses.get(e.id) || ""), e));
  for (const m of input.movements) if (inPeriod(m.date, period) && m.kind === "expense" && !(m.expenseId && expensesById.has(m.expenseId)) && !input.expenses.some((e) => e.financeMovementId === m.id)) costs.push(purchase(m, undefined));
  const refundedByOriginal = new Map<string, number>();
  for (const refund of input.movements.filter((m) => m.kind === "supplier_refund" && m.date <= period.end).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    // An owner can establish a business cash refund without identifying one original
    // purchase (for example, a foreign-currency subscription adjustment). Never infer
    // original cost, capital allowance or GST from that evidence.
    if (!refund.refundOf && refund.amountMinor > 0 && refund.taxTreatment === "operating" && refund.category?.trim() && refund.evidence?.trim() && refund.reviewedBy && refund.reviewedAt && Number.isInteger(refund.businessUseBps) && refund.businessUseBps! >= 0 && refund.businessUseBps! <= 10000) {
      if (inPeriod(refund.date, period)) {
        const issue = `Refund ${refund.id}: business cash treatment is owner-reviewed; original purchase and any GST adjustment remain unresolved.`;
        sourceException(issue);
        const grossMinor = -refund.amountMinor, workMinor = -portion(refund.amountMinor, refund.businessUseBps!);
        costs.push({ id: `refund:${refund.id}`, movementId: refund.id, date: refund.date, description: refund.description, category: refund.category, grossMinor, workMinor, privateMinor: add(grossMinor, -workMinor), gstCreditMinor: 0, operatingMinor: workMinor, capitalMinor: 0, allowanceMinor: 0, nonDeductibleMinor: 0, evidence: refund.evidence, exceptions: [] });
      }
      continue;
    }
    const original = movementsById.get(refund.refundOf || ""), originalExpense = original?.expenseId ? expensesById.get(original.expenseId) : input.expenses.find((e) => e.financeMovementId === original?.id);
    const priorRefunded = refundedByOriginal.get(original?.id || "") || 0, nextRefunded = add(priorRefunded, refund.amountMinor);
    if (!original || original.kind !== "expense" || original.amountMinor >= 0 || original.date > refund.date || refund.amountMinor <= 0 || nextRefunded > -original.amountMinor) {
      if (inPeriod(refund.date, period)) sourceException(`Refund ${refund.id}: original purchase or total refund amount is unsupported; excluded from deductions pending review.`); continue;
    }
    refundedByOriginal.set(original.id, nextRefunded);
    if (!inPeriod(refund.date, period)) continue;
    const source = purchase(original, originalExpense), grossMinor = -refund.amountMinor;
    // Difference of rounded cumulative shares: split full refunds cancel each component exactly.
    const prorate = (value: number) => { const d = BigInt(source.grossMinor); const cumulative = (amount: number) => Number((BigInt(value) * BigInt(amount) + d / BigInt(2)) / d); return add(cumulative(priorRefunded), -cumulative(nextRefunded)); };
    const workMinor = prorate(source.workMinor), gstCreditMinor = prorate(source.gstCreditMinor);
    const workNet = add(workMinor, -gstCreditMinor);
    costs.push({ ...source, id: `refund:${refund.id}`, movementId: refund.id, expenseId: undefined, date: refund.date, description: refund.description, grossMinor, workMinor, privateMinor: add(grossMinor, -workMinor), gstCreditMinor, operatingMinor: source.operatingMinor ? workNet : 0, capitalMinor: source.capitalMinor ? workNet : 0, allowanceMinor: prorate(source.allowanceMinor), nonDeductibleMinor: source.nonDeductibleMinor ? workNet : 0, evidence: refund.evidence || "Linked supplier refund", exceptions: source.exceptions });
  }
  costs.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const c of costs) for (const issue of c.exceptions) exceptions.push(`${c.id}: ${issue}`);
  const eligibleInvoices = input.invoices.filter((i) => (!i.creditedBy || (i.creditedAt || "") > period.end) && i.status !== "draft" && i.status !== "void" && i.issueDate && i.issueDate <= period.end);
  const foreignInvoices = eligibleInvoices.filter(i => i.currency && i.currency !== "AUD");
  if (foreignInvoices.length) sourceException(`${foreignInvoices.length} non-AUD invoice(s) excluded from AUD invoice balances; no exchange rate was applied.`);
  const invoices = eligibleInvoices.filter(i => !i.currency || i.currency === "AUD").map((i) => {
    const datedPaidThroughEndMinor = sum(historicalReceipts.filter((r) => r.date <= period.end).flatMap((r) => r.allocations.filter((a) => a.invoiceId === i.id).map((a) => a.amountMinor)));
    const creditsAppliedThroughEndMinor = appliedByInvoice.get(i.id)||0;
    if (add(datedPaidThroughEndMinor,creditsAppliedThroughEndMinor) > i.totalMinor) throw new Error("Receipt allocations exceed an invoice total");
    if (i.legacyUndatedMinor > 0) exceptions.push(`Invoice ${i.number}: undated legacy payment ${i.id}; historical outstanding is uncertain until dated evidence is supplied.`);
    return { id: i.id, number: i.number, issueDate: i.issueDate, totalMinor: i.totalMinor, datedPaidThroughEndMinor, creditsAppliedThroughEndMinor, datedLedgerRemainingMinor: add(i.totalMinor, -datedPaidThroughEndMinor,-creditsAppliedThroughEndMinor), legacyUndatedMinor: i.legacyUndatedMinor, currentBalanceMinor: i.balanceDueMinor };
  });
  const categoryMap = new Map<string, FinancialReport["categories"][number]>();
  for (const cost of costs) { const row = categoryMap.get(cost.category) || { category: cost.category, grossMinor: 0, workMinor: 0, operatingMinor: 0, capitalMinor: 0, allowanceMinor: 0 }; for (const field of ["grossMinor", "workMinor", "operatingMinor", "capitalMinor", "allowanceMinor"] as const) row[field] = add(row[field], cost[field]); categoryMap.set(cost.category, row); }
  const coverage = input.accounts.map((account) => {
    const sources = input.imports.filter((i) => i.accountId === account.id && i.start <= period.end && i.end >= period.start).sort((a, b) => a.start.localeCompare(b.start));
    let cursor = period.start;
    for (const source of sources) if (source.completeDays && source.start <= cursor && source.end >= cursor) cursor = nextDate(source.end);
    const row = { accountId: account.id, label: account.label, first: sources[0]?.start || null, last: sources.length ? sources.reduce((last, s) => s.end > last ? s.end : last, "") : null, throughPeriod: cursor > period.end, controlGaps: sources.filter((s) => s.control.state !== "balanced").length, unreviewed: input.movements.filter((m) => m.accountId === account.id && inPeriod(m.date, period) && m.kind === "unreviewed").length };
    if (!row.throughPeriod) exceptions.push(`${account.label}: complete statement coverage for the selected period has not been established.`);
    if (row.controlGaps) exceptions.push(`${account.label}: ${row.controlGaps} statement balance controls are missing, unverified or in variance.`);
    if (row.unreviewed) exceptions.push(`${account.label}: ${row.unreviewed} source movements remain unreviewed.`);
    return row;
  });
  if (!input.accounts.length) exceptions.push("No source accounts or statement coverage recorded.");
  if (input.incompleteImports) sourceException(`${input.incompleteImports} incomplete imports are excluded.`);
  const receivedMinor = sum(receipts.map((r) => r.amountMinor)), allocatedMinor = sum(receipts.flatMap((r) => r.allocations.map((a) => a.amountMinor)));
  const total = (key: "grossMinor" | "workMinor" | "privateMinor" | "gstCreditMinor" | "operatingMinor" | "capitalMinor" | "allowanceMinor" | "nonDeductibleMinor") => sum(costs.map((c) => c[key]));
  const receivedGstMinor = sum(receipts.map((r) => receiptTaxes.get(r.id) || 0));
  const totals = { receivedMinor, receivedGstMinor, allocatedMinor, unallocatedMinor: add(receivedMinor, -allocatedMinor), grossCostMinor: total("grossMinor"), workCostMinor: total("workMinor"), privateCostMinor: total("privateMinor"), gstCreditMinor: total("gstCreditMinor"), operatingMinor: total("operatingMinor"), capitalMinor: total("capitalMinor"), allowanceMinor: total("allowanceMinor"), nonDeductibleMinor: total("nonDeductibleMinor"), cashSurplusMinor: add(receivedMinor, -total("workMinor")), indicativeProfitMinor: add(receivedMinor, -receivedGstMinor, -total("operatingMinor"), -total("allowanceMinor")), datedLedgerRemainingMinor: sum(invoices.map((i) => i.datedLedgerRemainingMinor)), undatedPaidMinor: sum(invoices.map((i) => i.legacyUndatedMinor)) };
  if (add(totals.workCostMinor, totals.privateCostMinor) !== totals.grossCostMinor || add(totals.operatingMinor, totals.capitalMinor, totals.nonDeductibleMinor, totals.gstCreditMinor) !== totals.workCostMinor) throw new Error("Report expense bridge does not reconcile in cents");
  const exclusions = ["salary", "transfer", "personal", "drawings", "loan", "tax_payment", "capital", "unreviewed"].map((kind) => { const rows = input.movements.filter((m) => m.kind === kind && inPeriod(m.date, period)); return { kind, count: rows.length, netMinor: sum(rows.map((m) => m.amountMinor)) }; });
  if (exclusions.find((e) => e.kind === "capital")!.count) exceptions.push("Unclassified capital movements require an expense link and allowance review before entering the profit bridge.");
  return { creditRegister, creditHistory, correctionRegister, version: FINANCIAL_REPORT_VERSION, period, basis: "Dated business receipts and reviewed paid costs; cash planning view. Legal income-tax derivation and GST accounting basis require separate confirmation.", totals, receipts, costs, invoices, categories: [...categoryMap.values()].sort((a, b) => a.category.localeCompare(b.category)), exclusions, coverage, gst: { registration: input.registration || { status: "unknown" }, evidence: input.gstEvidence || {} }, exceptions: [...new Set(exceptions)], materialSourceExceptions: [...new Set(materialSourceExceptions)], status: exceptions.length ? "qualified" : "reviewed_sources" };
}

export function reportCsv(report: FinancialReport): string {
  const rows: unknown[][] = [["report_version", report.version], ["period_start", report.period.start], ["period_end", report.period.end], ["status", report.status], ["basis", report.basis], [], ["summary", "amount_minor_AUD"]];
  for (const [key, value] of Object.entries(report.totals)) rows.push([key, value]);
  rows.push([], ["receipt_id", "date", "amount_minor_AUD", "account", "movement_id", "evidence"]);
  for (const r of report.receipts) rows.push([r.id, r.date, r.amountMinor, r.accountId, r.movementId, r.evidence]);
  rows.push([], ["receipt_id", "invoice_id", "invoice_number", "allocated_minor_AUD"]);
  for (const r of report.receipts) for (const a of r.allocations) rows.push([r.id, a.invoiceId, a.invoiceNumber, a.amountMinor]);
  rows.push([], ["cost_id", "date", "description", "category", "gross_minor", "work_minor", "private_minor", "gst_credit_minor", "operating_minor", "capital_minor", "allowance_minor", "non_deductible_minor", "movement_id", "expense_id", "evidence", "exceptions"]);
  for (const c of report.costs) rows.push([c.id, c.date, c.description, c.category, c.grossMinor, c.workMinor, c.privateMinor, c.gstCreditMinor, c.operatingMinor, c.capitalMinor, c.allowanceMinor, c.nonDeductibleMinor, c.movementId, c.expenseId, c.evidence, c.exceptions.join("; ")]);
  rows.push([], ["invoice_id", "number", "issue_date", "total_minor", "dated_paid_through_end_minor", "dated_ledger_remaining_minor", "undated_legacy_minor", "current_balance_minor"]);
  for (const i of report.invoices) rows.push([i.id, i.number, i.issueDate, i.totalMinor, i.datedPaidThroughEndMinor, i.datedLedgerRemainingMinor, i.legacyUndatedMinor, i.currentBalanceMinor]);
  rows.push([], ["excluded_kind", "count", "net_minor"]); for (const e of report.exclusions) rows.push([e.kind, e.count, e.netMinor]);
  rows.push([], ["account", "first_source_date", "last_source_date", "complete_period", "control_gaps", "unreviewed"]); for (const c of report.coverage) rows.push([c.label, c.first, c.last, c.throughPeriod, c.controlGaps, c.unreviewed]);
  rows.push([], ["correction_id", "status", "credit", "replacement", "new_issue_date", "original_numbers", "original_issue_dates", "service_periods", "signed_credit_minor", "replacement_minor", "carried_minor", "balance_minor", "evidence", "unresolved", "attachment_hashes"]);
  for (const c of report.correctionRegister || []) rows.push([c.id,c.status,c.credit,c.replacement,c.issueDate,c.originals,c.originalIssueDates,c.servicePeriods,c.signedCreditMinor,c.replacementMinor,c.paymentCarryMinor,c.balanceMinor,c.evidence,c.unresolved,c.attachmentHashes]);
  rows.push([], ["credit_id","number","client","currency","original_invoice","issue_date","supply_date","reference","reason","net_minor","tax_minor","issued_minor","applied_minor","recorded_refunds_minor","available_minor"]);
  for (const c of report.creditRegister||[]) rows.push([c.id,c.number,c.client,c.currency,c.original,c.issueDate,c.supplyDate,c.reference,c.reason,c.netMinor,c.taxMinor,c.issuedMinor,c.appliedMinor,c.refundedMinor,c.availableMinor]);
  rows.push([], ["credit_id","date","action","amount_minor","invoice_id","reverses","reference","reason"]);
  for (const e of report.creditHistory||[]) rows.push([e.creditId,e.date,e.kind,e.amountMinor,e.invoiceId,e.reverses,e.reference,e.reason]);
  rows.push([], ["invoice_id","cash_paid_through_end_minor","credits_applied_through_end_minor","ledger_remaining_minor"]);
  for (const i of report.invoices) rows.push([i.id,i.datedPaidThroughEndMinor,i.creditsAppliedThroughEndMinor||0,i.datedLedgerRemainingMinor]);
  rows.push([], ["exceptions"]); for (const e of report.exceptions) rows.push([e]);
  // Neutralize spreadsheet formulas in untrusted descriptions and evidence.
  const quote = (value: unknown) => { let text = value === undefined || value === null ? "" : String(value); if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; };
  return rows.map((row) => row.map(quote).join(",")).join("\r\n");
}
