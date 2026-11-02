import type { FinancialInvoice, Receipt } from "./types";
import type { BasPeriod } from "@/lib/expenses/bas";
import { add } from "./money";

/** Do not misattribute advance consideration or unallocated/undated receipts to invoice issue dates. */
export function nonCashAttributionReasons(invoices: FinancialInvoice[], receipts: Receipt[], period: BasPeriod): string[] {
  const reasons = new Set<string>();
  const inside = (date: string) => date >= period.startDate && date <= period.endDate;
  const active = receipts.filter(r => !r.reversedBy && !r.reversalOf);
  for (const receipt of active) if (inside(receipt.date) && add(...receipt.allocations.map(a => a.amountMinor)) < receipt.amountMinor) reasons.add("Unallocated receipts need sales and GST attribution before non-cash BAS labels can be calculated.");
  for (const invoice of invoices.filter(i => !["draft", "void"].includes(i.status))) {
    if (invoice.legacyUndatedMinor > 0) reasons.add("Undated payments need an attribution date before non-cash BAS labels can be calculated.");
    const first = active.filter(r => r.allocations.some(a => a.invoiceId === invoice.id && a.amountMinor > 0)).map(r => r.date).sort()[0];
    if (first && first < invoice.issueDate && (inside(first) !== inside(invoice.issueDate))) reasons.add("A payment predates its invoice. Review the earlier consideration date before assigning non-cash sales and GST to a BAS period.");
  }
  return [...reasons];
}
