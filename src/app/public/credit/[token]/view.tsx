"use client";
import { BillingDocument,BillingPrintStyles } from "@/components/invoices/BillingDocument";
import type { BillingDocumentData } from "@/lib/invoice-corrections/documents";
export function PublicCreditView({document}:{document:BillingDocumentData}){
 return <main className="billing-document-page py-8 px-4 space-y-6 bg-white text-black min-h-screen"><BillingPrintStyles/><div className="no-print max-w-[210mm] mx-auto flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-lg font-semibold">{document.supplier.businessName}</h1><p className="text-sm text-gray-600">Credit note {document.number}</p></div><div className="flex gap-4 items-center"><button className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:opacity-90" onClick={()=>window.print()}>Print / Save as PDF</button></div></div><BillingDocument document={document}/></main>;
}
