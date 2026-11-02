"use client";
import {useParams} from "next/navigation";
import {CreditNoteForm} from "@/components/invoices/CreditNoteForm";
export default function InvoiceCreditPage(){const {id}=useParams<{id:string}>();return <CreditNoteForm invoiceId={id}/>;}
