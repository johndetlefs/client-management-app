import { getStatusColor, getStatusLabel } from "@/lib/invoice-utils";
import type { InvoiceLine } from "@/types/invoice";
import type { InvoiceCorrection } from "./types";

export interface BillingDocumentData {
  currency?:string; title: string; number: string; date?: string; dueDate?: string; status: string; statusClass?: string;
  supplier: { businessName: string; abn: string; address: string; email: string; phone?: string; logoUrl?: string };
  customer: { name: string; email: string; abn: string; address: string[] };
  lines: (Omit<InvoiceLine, "jobItemId" | "jobId"> & { reference?: string; servicePeriod?: string })[];
  subtotalMinor: number; taxMinor: number; totalMinor: number;
  amountPaidMinor?: number; balanceMinor?: number; reference: string; notes?: string;
  payments?: { date: string; amountMinor: number }[];
  bankAccount?: { accountName?: string; bsb?: string; accountNumber?: string };
  terms?: string; footer?: string;
}

/** Explicit customer-field projection. Never pass stored correction records to public clients. */
export function correctionDocuments(c: InvoiceCorrection): { credit: BillingDocumentData; replacement: BillingDocumentData } {
  const original = c.originals[0], snapshot = original.snapshot;
  const address = snapshot.clientAddress as Record<string,string> | undefined;
  const customer = { name: original.clientName, email: String(snapshot.clientEmail || ""), abn: String(snapshot.clientAbn || ""), address: address ? [address.street, [address.city,address.state,address.postcode].filter(Boolean).join(" "), address.country].filter(Boolean) : [] };
  const s=c.settingsSnapshot;
  const supplier={businessName:s.businessName,abn:s.abn,address:s.address,email:s.email,phone:s.phone,logoUrl:s.logoUrl};
  const draft=c.status!=="posted";
  const common={supplier,customer,date:c.postingDate,status:draft?"Draft":"Issued",footer:s.invoiceFooter};
  const credit:BillingDocumentData={...common,title:draft?"DRAFT CREDIT NOTE":"CREDIT NOTE",number:c.creditNumber||"Draft",lines:c.originals.flatMap(o=>o.lines.map(l=>({jobTitle:l.jobTitle,title:l.title,description:l.description,unit:l.unit,quantity:l.quantity,unitPriceMinor:l.unitPriceMinor,gstApplicable:l.gstApplicable,subtotalMinor:l.subtotalMinor,taxMinor:l.taxMinor,totalMinor:l.totalMinor,reference:`Invoice ${o.number} · ${o.issueDate}`}))),subtotalMinor:-c.preview.creditSubtotalMinor,taxMinor:-c.preview.creditTaxMinor,totalMinor:-c.preview.creditTotalMinor,reference:`Applies to ${c.originals.map(o=>o.number).join(", ")}. Replacement invoice ${c.replacementNumber||"(draft)"}.`,notes:c.input.reason};
  const invoiceStatus=c.settlement?.status||(c.preview.balanceMinor===0?"paid":c.preview.carriedMinor?"partially_paid":"sent");
  const replacement:BillingDocumentData={...common,status:draft?"Draft":getStatusLabel(invoiceStatus),statusClass:draft?getStatusColor("draft"):getStatusColor(invoiceStatus),title:draft?"DRAFT INVOICE":c.preview.taxMinor?"TAX INVOICE":"INVOICE",number:c.replacementNumber||"Draft",dueDate:c.input.dueDate,lines:c.preview.lines.map(l=>({jobTitle:l.jobTitle,title:l.title,description:l.description,unit:l.unit,quantity:l.quantity,unitPriceMinor:l.unitPriceMinor,gstApplicable:l.gstApplicable,subtotalMinor:l.subtotalMinor,taxMinor:l.taxMinor,totalMinor:l.totalMinor,servicePeriod:l.serviceFrom&&l.serviceThrough?`${l.serviceFrom} – ${l.serviceThrough}`:undefined})),subtotalMinor:c.preview.subtotalMinor,taxMinor:c.preview.taxMinor,totalMinor:c.preview.totalMinor,amountPaidMinor:c.settlement?.amountPaidMinor??c.preview.carriedMinor,balanceMinor:c.settlement?.balanceDueMinor??c.preview.balanceMinor,reference:`Replaces ${c.originals.map(o=>`${o.number} (${o.issueDate})`).join(", ")}. Credit note ${c.creditNumber||"(draft)"}.`,notes:c.input.evidence||undefined,payments:c.receipts.flatMap(r=>{const change=c.preview.receiptChanges.find(x=>x.id===r.id);const amountMinor=change?.after.filter(a=>a.invoiceId===c.replacementId||a.invoiceId===`replacement-${c.id}`).reduce((n,a)=>n+a.amountMinor,0)||0;return amountMinor?[{date:r.date,amountMinor}]:[];}),bankAccount:{accountName:String(s.bankAccount.accountName||""),bsb:String(s.bankAccount.bsb||""),accountNumber:String(s.bankAccount.accountNumber||"")},terms:s.invoiceTerms};
  return {credit,replacement};
}

export function publicCreditDocument(c: InvoiceCorrection) {
  if(c.status!=="posted" || !c.creditNumber) throw new Error("Credit note not found");
  return {document:correctionDocuments(c).credit};
}
