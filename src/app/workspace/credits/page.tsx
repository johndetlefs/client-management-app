"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { CREDIT_ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getCredits } from "./actions";
import { CreditStatus, creditMoney, creditDate, selectClass } from "@/components/invoices/credit-ui";

export default function CreditsPage() {
    const { tenantId } = useWorkspace();
    const router = useRouter();
    const [data, setData] = useState<Awaited<ReturnType<typeof getCredits>>>();
    const [error, setError] = useState("");
    const [client, setClient] = useState("");
    const [status, setStatus] = useState("all");
    const [search, setSearch] = useState("");
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const result = await getCredits(tenantId, await requireActionIdToken());
                if (active) setData(result);
            } catch (e) {
                if (active) setError((e as Error).message);
            }
        })();
        return () => { active = false; };
    }, [tenantId]);
    const credits = data?.credits.filter(note =>
        (!client || note.input.clientId === client) &&
        (status === "all" || note.status === status) &&
        `${note.number || "Draft credit note"} ${note.client.name} ${note.input.reference}`.toLowerCase().includes(search.trim().toLowerCase())
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) || [];
    const filtered = !!(client || search || status !== "all");
    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div><h1 className="text-3xl font-bold">Credit notes</h1><p className="text-gray-600 mt-1">Manage client credits and available balances</p></div>
                <Button onClick={() => router.push(CREDIT_ROUTES.NEW)}>New credit note</Button>
            </div>
            <Card className="mb-6 p-4">
                <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-0 sm:min-w-64"><Input aria-label="Search credit notes" placeholder="Search by client or credit note number..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                    <select aria-label="Filter by status" className={`${selectClass} sm:w-44`} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="issued">Issued</option></select>
                    <select aria-label="Filter by client" className={`${selectClass} sm:w-56`} value={client} onChange={e => setClient(e.target.value)}><option value="">All clients</option>{data?.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </div>
            </Card>
            {error ? <Card className="p-6"><p role="alert" className="text-red-600">{error}</p></Card> : !data ? <Card className="p-12"><p role="status">Loading credit notes…</p></Card> : !credits.length ? (
                <Card className="p-12 text-center"><h2 className="text-xl font-semibold mb-2">{filtered ? "No credit notes match your filters" : "No credit notes yet"}</h2><p className="text-gray-600 mb-4">{filtered ? "Try another search or clear your filters." : "Create a credit note for a client to get started."}</p>{filtered ? <Button variant="secondary" onClick={() => { setSearch(""); setClient(""); setStatus("all"); }}>Clear filters</Button> : <Button onClick={() => router.push(CREDIT_ROUTES.NEW)}>New credit note</Button>}</Card>
            ) : (
                <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-zinc-50 dark:bg-zinc-800"><tr>{["Credit note #", "Client", "Status", "Date", "Currency", "Amount", "Available"].map(h => <th key={h} scope="col" className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${h === "Amount" || h === "Available" ? "text-right" : ""}`}>{h}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{credits.map(note => (
                    <tr key={note.id} onClick={() => router.push(CREDIT_ROUTES.VIEW(note.id))} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                        <td className="px-6 py-4 font-medium whitespace-nowrap"><Link className="hover:underline focus:underline" href={CREDIT_ROUTES.VIEW(note.id)}>{note.number || "Draft credit note"}</Link></td>
                        <td className="px-6 py-4">{note.client.name}</td><td className="px-6 py-4"><CreditStatus status={note.status} /></td>
                        <td className="px-6 py-4 whitespace-nowrap">{creditDate(note.issueDate || note.createdAt)}</td><td className="px-6 py-4">{note.input.currency}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap tabular-nums">{creditMoney(note.input.currency, note.totalMinor)}</td><td className="px-6 py-4 text-right whitespace-nowrap tabular-nums font-medium">{creditMoney(note.input.currency, note.availableMinor)}</td>
                    </tr>
                ))}</tbody></table></div></Card>
            )}
            {data && credits.length > 0 && <p className="text-sm text-gray-500 text-center mt-6">Showing {credits.length} credit {credits.length === 1 ? "note" : "notes"}</p>}
        </div>
    );
}
