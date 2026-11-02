import { redirect } from "next/navigation";
export default async function InvoiceCreditPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/workspace/credits/new?invoiceId=${encodeURIComponent(id)}`); }
