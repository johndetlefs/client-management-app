import { add, minor } from "./money";
import { financialDate, resourceId } from "./native-csv";
import type { FinancialInvoice, Movement, Receipt, ReceiptAllocation } from "./types";
import { determineInvoiceStatus } from "@/lib/invoice-utils";
import type { InvoiceStatus } from "@/types/invoice";

export function receiptInvoiceStatus(invoice: FinancialInvoice, paidMinor: number) {
  return determineInvoiceStatus(invoice.status as InvoiceStatus, invoice.totalMinor, add(paidMinor,invoice.creditAppliedMinor||0), invoice.dueDate ? new Date(invoice.dueDate) : undefined);
}

export function receiptRequestSignature(input: { date: string; accountId: string; amountMinor: number; movementId?: string; evidence: string; allocations: ReceiptAllocation[] }) {
  return JSON.stringify([input.date, input.accountId, input.amountMinor, input.movementId || "", input.evidence, input.allocations.map((a) => [a.invoiceId, a.amountMinor, a.replacesLegacyMinor || 0]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
}

export function validateAllocations(amountMinor: number, allocations: ReceiptAllocation[], invoices: FinancialInvoice[]) {
  minor(amountMinor);
  if (amountMinor <= 0 || !Array.isArray(allocations) || allocations.length > 50) throw new Error("Invalid receipt or allocation count");
  if (new Set(allocations.map((a) => a.invoiceId)).size !== allocations.length) throw new Error("An invoice may appear once per receipt");
  const total = add(...allocations.map((a) => minor(a.amountMinor)));
  if (total > amountMinor) throw new Error("Allocations exceed the received amount");
  return allocations.map((allocation) => {
    resourceId(allocation.invoiceId, "invoice");
    const invoice = invoices.find((i) => i.id === allocation.invoiceId);
    if (!invoice || invoice.creditedBy || ["draft", "void"].includes(invoice.status)) throw new Error("Invoice unavailable for receipt allocation");
    const replaces = minor(allocation.replacesLegacyMinor || 0);
    if (allocation.amountMinor <= 0 || replaces < 0 || replaces > allocation.amountMinor || replaces > invoice.legacyUndatedMinor) throw new Error("Invalid allocation or legacy replacement");
    const ledgerPaidMinor = add(invoice.ledgerPaidMinor, allocation.amountMinor);
    const legacyUndatedMinor = add(invoice.legacyUndatedMinor, -replaces);
    const amountPaidMinor = add(ledgerPaidMinor, legacyUndatedMinor);
    if (add(amountPaidMinor,invoice.creditAppliedMinor||0) > invoice.totalMinor) throw new Error("Receipt would overpay an invoice; review legacy payment evidence");
    return { invoiceId: invoice.id, ledgerPaidMinor, legacyUndatedMinor, amountPaidMinor, balanceDueMinor: add(invoice.totalMinor, -amountPaidMinor,-(invoice.creditAppliedMinor||0)), status: receiptInvoiceStatus(invoice, amountPaidMinor) };
  });
}

export function validateReceipt(input: Pick<Receipt, "date" | "amountMinor" | "accountId" | "evidence" | "movementId">, movement?: Movement) {
  financialDate(input.date);
  resourceId(input.accountId, "account");
  if (!input.evidence?.trim() || input.evidence.length > 2000) throw new Error("Source evidence is required (maximum 2,000 characters)");
  if (minor(input.amountMinor) <= 0) throw new Error("Receipt must be positive");
  if (input.movementId && (!movement || movement.amountMinor !== input.amountMinor || movement.date !== input.date || movement.accountId !== input.accountId || !["unreviewed", "business_receipt"].includes(movement.kind) || movement.receiptId)) throw new Error("Movement is unavailable or differs from the receipt");
}

export function validateTransfer(a: Movement, b: Movement) {
  if (a.id === b.id || a.accountId === b.accountId || add(a.amountMinor, b.amountMinor) !== 0 || !a.amountMinor || a.currency !== b.currency) throw new Error("A transfer needs opposite equal amounts in different accounts");
  if (a.receiptId || b.receiptId || a.expenseId || b.expenseId || a.transferId || b.transferId) throw new Error("Movement is already linked; reverse the prior review first");
  if (!["unreviewed", "transfer"].includes(a.kind) || !["unreviewed", "transfer"].includes(b.kind)) throw new Error("Review existing classifications before transfer pairing");
}
