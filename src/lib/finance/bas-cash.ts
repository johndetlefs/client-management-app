import type { BasPreparationSummary } from "@/lib/expenses/bas";
import type { BasPreparationSettings } from "@/types/tenant";
import type { FinancialReport } from "./report";
import { add } from "./money";

/** Dated-ledger preparation only; no assumption that labels have been lodged. */
export function cashBasFromReport(report: FinancialReport, settings: BasPreparationSettings): BasPreparationSummary {
  if (settings.accountingBasis !== "cash") throw new Error("Dated receipt BAS requires an explicitly selected cash basis");
  const registration = report.gst.registration, reasons: string[] = [];
  const registeredWholePeriod = registration.status === "registered" && !!registration.effectiveFrom && registration.effectiveFrom <= report.period.start && (!registration.effectiveTo || registration.effectiveTo >= report.period.end);
  if (!registeredWholePeriod) reasons.push("Registration is unknown, absent or changes during this period; labels require registration-period review.");
  if (report.totals.unallocatedMinor) reasons.push("Unallocated receipts have no supported sales/GST treatment.");
  if (report.totals.undatedPaidMinor) reasons.push("Undated legacy payments prevent complete receipt attribution.");
  if (report.coverage.some((c) => !c.throughPeriod || c.controlGaps || c.unreviewed) || !report.coverage.length) reasons.push("Statement coverage/reconciliation is incomplete; BAS labels are not certified.");
  if (report.costs.some((c) => !c.expenseId && !c.id.startsWith("refund:"))) reasons.push("Business purchases still require confirmed expense review.");
  const gstIssues = report.costs.filter((c) => c.exceptions.some((e) => /GST credit|Registration changed|source movement disagree/i.test(e)));
  if (gstIssues.length) reasons.push("Purchase GST eligibility or registration snapshot requires review.");
  if (!report.gst.evidence.currentStatusEvidence?.trim()) reasons.push("Current GST registration status evidence is missing.");
  if (report.gst.evidence.obligationStatus !== "reviewed" || !report.gst.evidence.obligationEvidence?.trim()) reasons.push("Historical registration obligation assessment or its supporting evidence is unresolved.");
  reasons.push(...report.materialSourceExceptions);
  const supported = reasons.length === 0;
  return { version: "bas-dated-cash-v2", period: { startDate: report.period.start, endDate: report.period.end, label: report.period.label }, settings, registration, status: supported ? "ready" : registration.status === "unknown" ? "registration_unknown" : registration.status === "not_registered" ? "not_registered" : "needs_review", preparationOnly: true, operationalIncomeMinor: report.totals.receivedMinor, operationalPurchasesMinor: report.totals.workCostMinor, g1TotalSalesMinor: supported ? report.totals.receivedMinor : null, oneAGstOnSalesMinor: supported ? report.totals.receivedGstMinor : null, oneBGstOnPurchasesMinor: supported ? report.totals.gstCreditMinor : null, netGstMinor: supported ? add(report.totals.receivedGstMinor, -report.totals.gstCreditMinor) : null, potentialGstOnPurchasesMinor: report.totals.gstCreditMinor, nonClaimableGstMinor: 0, reviewNeededGstMinor: 0, reviewNeededCount: reasons.length, includedExpenseCount: report.costs.length, includedInvoiceCount: new Set(report.receipts.flatMap((r) => r.allocations.map((a) => a.invoiceId))).size, reviewReasons: reasons };
}
