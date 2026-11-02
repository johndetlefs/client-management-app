"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getCredits } from "./actions";
const creditMoney = (currency: string, n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(n / 100);
export default function CreditsPage() { const { tenantId } = useWorkspace(); const [data, setData] = useState<Awaited<ReturnType<typeof getCredits>>>(), [error, setError] = useState(""), [client, setClient] = useState(""); useEffect(() => { let active = true; (async () => { try {
    const d = await getCredits(tenantId, await requireActionIdToken());
    if (active)
        setData(d);
}
catch (e) {
    if (active)
        setError((e as Error).message);
} })(); return () => { active = false; }; }, [tenantId]); return <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-5"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">Credit notes</h1><div className="flex gap-4"><Link className="underline" href="/workspace/invoices">Invoices</Link><Link className="rounded-md bg-foreground text-background px-4 py-2" href="/workspace/invoices/credits/new">New credit note</Link></div></div>{error && <p role="alert">{error}</p>}{!data && !error && <p>Loading credits…</p>}{data && <><label>Client <select className="border rounded p-2" value={client} onChange={e => setClient(e.target.value)}><option value="">All clients</option>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{["Credit note", "Client", "State", "Currency", "Amount", "Applied", "Recorded refunds", "Available"].map(h => <th key={h} className="py-3 px-2">{h}</th>)}</tr></thead><tbody>{data.credits.filter(c => !client || c.input.clientId === client).map(c => <tr key={c.id} className="border-t"><td className="p-2"><Link className="underline" href={`/workspace/invoices/credits/${c.id}`}>{c.number || "Draft credit"}</Link></td><td className="p-2">{c.client.name}</td><td>{c.status === "draft" ? "Draft" : "Issued"}</td><td>{c.input.currency}</td><td>{creditMoney(c.input.currency, c.totalMinor)}</td><td>{creditMoney(c.input.currency, c.appliedMinor)}</td><td>{creditMoney(c.input.currency, c.refundedMinor)}</td><td>{creditMoney(c.input.currency, c.availableMinor)}</td></tr>)}</tbody></table>{!data.credits.length && <p className="py-6">No credit notes yet.</p>}</div></>}</div>; }
