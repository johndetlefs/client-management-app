"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getCredits } from "@/app/workspace/invoices/credits/actions";
export function InvoiceCreditsPanel({ invoiceId }: {
    invoiceId: string;
}) { const { tenantId } = useWorkspace(); const [data, setData] = useState<Awaited<ReturnType<typeof getCredits>>>(); useEffect(() => { let active = true; (async () => { try {
    const d = await getCredits(tenantId, await requireActionIdToken());
    if (active)
        setData(d);
}
catch { /* Financial credit controls are owner-only. */ } })(); return () => { active = false; }; }, [tenantId, invoiceId]); const invoice = data?.invoices.find(i => i.invoice.id === invoiceId)?.invoice; if (!data || !invoice)
    return null; const credits = data.credits.filter(c => c.status === "issued" && c.input.clientId === invoice.clientId && c.input.currency === invoice.currency && c.availableMinor > 0); return <section className="border rounded p-5 mb-6 space-y-3"><h2 className="font-semibold">Credit notes</h2><div className="flex flex-wrap gap-4"><Link className="underline" href={`/workspace/invoices/${invoiceId}/credit`}>Create credit note</Link><Link className="underline" href="/workspace/invoices/credits">View credit notes</Link></div>{credits.length > 0 && <div><p className="text-sm mb-2">Available client credit — choose a credit note to apply an amount.</p>{credits.map(c => <Link className="underline block" key={c.id} href={`/workspace/invoices/credits/${c.id}`}>{c.number} · {new Intl.NumberFormat("en-AU", { style: "currency", currency: c.input.currency }).format(c.availableMinor / 100)} available</Link>)}</div>}</section>; }
