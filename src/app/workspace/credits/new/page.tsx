import { CreditNoteForm } from "@/components/invoices/CreditNoteForm";
export default async function NewCreditPage({ searchParams }: { searchParams: Promise<{ invoiceId?: string }> }) {
    const { invoiceId } = await searchParams;
    return <CreditNoteForm invoiceId={invoiceId} />;
}
