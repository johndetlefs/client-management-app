import type { FinancialInvoice, Receipt } from "./types";
import { add, minor } from "./money";

/** Cumulative allocation rounding makes split receipts tie exactly to invoice GST. */
export function receiptGstAllocations(receipts: Receipt[], invoices: FinancialInvoice[]): Map<string, number> {
  const result = new Map<string, number>(), byInvoice = new Map(invoices.map((i) => [i.id, i]));
  const paid = new Map<string, number>();
  for (const receipt of receipts.filter((r) => !r.reversalOf && !r.reversedBy).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))) {
    let receiptTax = 0;
    for (const allocation of receipt.allocations) {
      const invoice = byInvoice.get(allocation.invoiceId);
      if (!invoice || invoice.totalMinor <= 0 || invoice.taxMinor < 0 || invoice.taxMinor > invoice.totalMinor || allocation.amountMinor <= 0) throw new Error("Receipt tax source is inconsistent; review invoice allocation");
      const prior = paid.get(invoice.id) || 0, next = add(prior, allocation.amountMinor);
      if (next > invoice.totalMinor) throw new Error("Dated receipts exceed invoice total");
      const roundedTax = (amount: number) => { const n = BigInt(minor(amount)) * BigInt(minor(invoice.taxMinor)), d = BigInt(minor(invoice.totalMinor)); return minor(Number((n + d / BigInt(2)) / d)); };
      receiptTax = add(receiptTax, roundedTax(next), -roundedTax(prior)); paid.set(invoice.id, next);
    }
    result.set(receipt.id, receiptTax);
  }
  return result;
}
