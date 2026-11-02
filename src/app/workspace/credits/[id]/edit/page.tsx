"use client";
import { useParams } from "next/navigation";
import { CreditNoteForm } from "@/components/invoices/CreditNoteForm";
export default function EditCreditPage() { const { id } = useParams<{
    id: string;
}>(); return <CreditNoteForm creditId={id}/>; }
