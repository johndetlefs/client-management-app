import type { InvoiceCorrection } from "./types";
/** Private accountant handoff, retaining original issue/supply/payment dates independently. */
export function correctionCsv(c: InvoiceCorrection): string {
 const rows: (string|number)[][] = [["correction",c.id,"status",c.status],["credit",c.creditNumber||"prepared","replacement",c.replacementNumber||"prepared"],["new_issue_date",c.postingDate||"not issued"],["GST_adjustment_reporting_period","Unassigned"],["reason",c.input.reason],["evidence",c.input.evidence],["original_id","original_number","original_issue_date","base_minor","gst_minor","gross_minor"]];
 for(const o of c.originals)rows.push([o.id,o.number,o.issueDate,o.subtotalMinor,o.taxMinor,o.totalMinor]);
 rows.push(["credit_signed_minor",c.preview.creditSubtotalMinor,c.preview.creditTaxMinor,c.preview.creditTotalMinor]);
 rows.push(["original_id","original_line","service_from","service_through","description","base_minor","gst_minor","gross_minor"]);
 for(const l of c.preview.lines)rows.push([l.originalInvoiceId,l.originalLineIndex+1,l.serviceFrom,l.serviceThrough,`${l.jobTitle}: ${l.title} ${l.description||""}`,l.subtotalMinor,l.taxMinor,l.totalMinor]);
 rows.push(["receipt_id","actual_receipt_date","cash_minor","account","movement","source_evidence","allocations_before","allocations_after"]);
 for(const r of c.receipts){const change=c.preview.receiptChanges.find(v=>v.id===r.id);rows.push([r.id,r.date,r.amountMinor,r.accountId,r.movementId||"",r.evidence,JSON.stringify(change?.before||r.allocations),JSON.stringify(change?.after||r.allocations)]);}
 rows.push(["replacement_gross_minor",c.preview.totalMinor],["payment_carry_minor",c.preview.carriedMinor],["balance_minor",c.preview.balanceMinor],["cash_created_minor",0]);
 if(c.settlement)rows.push(["current_paid_minor",c.settlement.amountPaidMinor],["current_balance_minor",c.settlement.balanceDueMinor]);
 for(const a of c.input.attachments)rows.push(["original_attachment",a.name,"sha256",a.sha256]);
 for(const pending of c.preview.blockers)rows.push(["unresolved",pending]);
 const quote=(v:string|number)=>`"${String(typeof v==="string"&&/^[=+\-@\t\r]/.test(v)?`'${v}`:v).replaceAll('"','""')}"`;
 return rows.map(row=>row.map(quote).join(",")).join("\r\n");
}
