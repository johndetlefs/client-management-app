import { formatDate } from "@/lib/invoice-utils";
import { getBillableUnitLabel } from "@/types/jobItem";
import type { BillingDocumentData } from "@/lib/invoice-corrections/documents";

const date=(value:string)=>formatDate(new Date(`${value}T12:00:00Z`));

/** Matches the existing invoice/quote print template's A4 sheet, spacing and table columns. */
export function BillingDocument({document:d}:{document:BillingDocumentData}) {
 const money=(n:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:d.currency||"AUD"}).format(n/100);
 return <article className="billing-document invoice-container p-8 md:p-12 text-black bg-white">
  <div className="flex justify-between mb-8 gap-4"><div><h2 className="text-3xl font-bold mb-2">{d.title}</h2><div className="space-y-1 text-sm"><p><span className="font-semibold">{d.title.includes("CREDIT")?"Credit Note":"Invoice"} #:</span> {d.number}</p>{d.date&&<p><span className="font-semibold">Issue Date:</span> {date(d.date)}</p>}{d.dueDate&&<p><span className="font-semibold">Due Date:</span> {date(d.dueDate)}</p>}</div></div><div><span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${d.statusClass||"bg-gray-100 text-gray-800"}`}>{d.status}</span></div></div>
  <div className="grid grid-cols-2 gap-8 mb-8"><div><h3 className="font-semibold text-sm text-gray-500 mb-2">FROM</h3><div className="text-sm space-y-1"><p className="font-semibold">{d.supplier.businessName}</p>{d.supplier.abn&&<p className="text-gray-600">ABN: {d.supplier.abn}</p>}{d.supplier.address&&<p className="text-gray-600">{d.supplier.address}</p>}{d.supplier.phone&&<p className="text-gray-600">{d.supplier.phone}</p>}{d.supplier.email&&<p className="text-gray-600">{d.supplier.email}</p>}</div></div><div><h3 className="font-semibold text-sm text-gray-500 mb-2">TO</h3><div className="text-sm space-y-1"><p className="font-semibold">{d.customer.name}</p>{d.customer.email&&<p className="text-gray-600">{d.customer.email}</p>}{d.customer.abn&&<p className="text-gray-600">ABN: {d.customer.abn}</p>}{d.customer.address.map((line,i)=><p key={i} className="text-gray-600">{line}</p>)}</div></div></div>
  <p className="mb-6 text-sm text-gray-600">{d.reference}</p>
  <div className="mb-8 overflow-x-auto"><table className="w-full table-auto"><thead><tr className="border-b-2 border-black/20">{["Description","Price","Qty","Unit","Subtotal","GST","Total"].map((title,i)=><th key={title} className={`py-3 px-2 font-semibold uppercase text-sm ${i===0?"text-left w-2/5":i===2||i===3?"text-center":"text-right whitespace-nowrap"}`}>{title}</th>)}</tr></thead><tbody>{d.lines.map((l,i)=><tr key={i} className="border-b border-black/20"><td className="py-4 px-2"><p className="font-medium">{l.title}</p>{l.description&&<p className="text-sm text-gray-600 mt-1">{l.description}</p>}{l.jobTitle&&<p className="text-xs text-gray-500 mt-1">Job: {l.jobTitle}</p>}{l.reference&&<p className="text-xs text-gray-500 mt-1">{l.reference}</p>}{l.servicePeriod&&<p className="text-xs text-gray-500 mt-1">{l.servicePeriod}</p>}</td><td className="py-4 px-2 text-right whitespace-nowrap tabular-nums">{money(l.unitPriceMinor)}</td><td className="py-4 px-2 text-center">{l.quantity}</td><td className="py-4 px-2 text-center">{getBillableUnitLabel(l.unit,l.quantity)}</td><td className="py-4 px-2 text-right whitespace-nowrap tabular-nums">{money(l.subtotalMinor)}</td><td className="py-4 px-2 text-right whitespace-nowrap tabular-nums">{l.taxMinor?money(l.taxMinor):"—"}</td><td className="py-4 px-2 text-right whitespace-nowrap tabular-nums font-medium">{money(l.totalMinor)}</td></tr>)}</tbody></table></div>
  <div className="totals-section flex justify-end mb-8"><div className="w-80"><div className="flex justify-between py-2"><span className="font-medium">Subtotal</span><span className="font-semibold">{money(d.subtotalMinor)}</span></div><div className="flex justify-between py-2 border-b border-black/10"><span className="font-medium">GST</span><span className="font-semibold">{money(d.taxMinor)}</span></div><div className="flex justify-between py-3 border-t-2 border-black/20 mt-2"><span className="text-xl font-bold">Total</span><span className="text-2xl font-bold">{money(d.totalMinor)}</span></div>{d.amountPaidMinor!==undefined&&<><div className="flex justify-between py-2 text-green-700"><span>Amount Paid</span><span>-{money(d.amountPaidMinor)}</span></div><div className="flex justify-between py-3 border-t-2 border-black/20"><span className="text-xl font-bold">Balance Due</span><span className="text-2xl font-bold">{money(d.balanceMinor||0)}</span></div></>}</div></div>
  {d.payments?.map((p,i)=><p className="text-sm mb-2" key={i}>Payment received {date(p.date)}: {money(p.amountMinor)}</p>)}
  {d.bankAccount&&Object.values(d.bankAccount).some(Boolean)&&<div className="payment-section mb-8 p-6 bg-gray-50 rounded-lg"><h3 className="font-semibold mb-3">Payment Details</h3>{d.bankAccount.accountName&&<p className="text-sm mb-1">Account Name: {d.bankAccount.accountName}</p>}{d.bankAccount.bsb&&<p className="text-sm mb-1">BSB: {d.bankAccount.bsb}</p>}{d.bankAccount.accountNumber&&<p className="text-sm">Account Number: {d.bankAccount.accountNumber}</p>}</div>}
  {d.terms&&<div className="mb-6"><h3 className="font-semibold mb-2">Payment Terms</h3><p className="text-sm text-gray-600 whitespace-pre-wrap">{d.terms}</p></div>}{d.notes&&<div className="mb-6"><h3 className="font-semibold mb-2">{d.title.includes("CREDIT")?"Reason for Credit":"Notes"}</h3><p className="text-sm text-gray-600 whitespace-pre-wrap">{d.notes}</p></div>}{d.footer&&<div className="footer-section mt-12 pt-6 border-t border-black/10 text-center"><p className="text-sm text-gray-500">{d.footer}</p></div>}
 </article>;
}

export function BillingPrintStyles(){return <style>{`
 .billing-document { max-width:210mm; margin:0 auto; min-height:297mm; box-shadow:0 0 20px rgba(0,0,0,.1); }
 @media print {
  /* Match the public invoice: no browser margin chrome; spacing belongs to the document. */
  @page { margin:0; size:A4; }
  html,body { margin:0!important;padding:0!important;background:white!important;color:black!important; }
  html { --background:#fff!important; --foreground:#000!important; }
  header,nav,.no-print,.print-hide { display:none!important; }
  .billing-document-page { padding:0!important; margin:0!important; min-height:0!important; }
  .billing-document { box-shadow:none!important;min-height:0;margin:0!important;padding:.5in!important;max-width:100%!important;width:100%!important; }
  .billing-document + .billing-document { break-before:page; }
  .billing-document .overflow-x-auto { overflow:visible!important; }
  .billing-document table { page-break-inside:auto; }
  .billing-document tr { break-inside:avoid;page-break-inside:avoid; }
  .billing-document thead { display:table-header-group; }
  .billing-document .totals-section,.billing-document .payment-section,.billing-document .footer-section { break-inside:avoid;page-break-inside:avoid; }
  .billing-document h3 { break-after:avoid; }
  .billing-document { print-color-adjust:exact;-webkit-print-color-adjust:exact; }
 }
 `}</style>;}
