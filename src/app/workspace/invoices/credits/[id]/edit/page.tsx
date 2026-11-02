import { redirect } from "next/navigation";
export default async function LegacyCreditPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/workspace/credits/${id}/edit`); }
