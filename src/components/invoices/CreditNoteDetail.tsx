"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getCredits, issueCreditNote } from "@/app/workspace/credits/actions";
import { getCorrection } from "@/app/workspace/invoice-corrections/actions";
import { creditCsv } from "@/lib/credits/documents";
import type { InvoiceCorrection } from "@/lib/invoice-corrections/types";
import type { CreditRequest } from "@/lib/credits/types";
import { CREDIT_ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CreditActionForm } from "./CreditActionForm";
import { CreditStatus, creditDate, creditMoney } from "./credit-ui";

type Action = { kind: CreditRequest["kind"]; entryId?: string };
export function CreditNoteDetail() {
    const { tenantId } = useWorkspace();
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<Awaited<ReturnType<typeof getCredits>>>();
    const [legacy, setLegacy] = useState<InvoiceCorrection>();
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);
    const [issueConfirm, setIssueConfirm] = useState(false);
    const [action, setAction] = useState<Action>();
    const reload = async () => {
        const token = await requireActionIdToken();
        setData(await getCredits(tenantId, token));
    };
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const token = await requireActionIdToken();
                const workspace = await getCredits(tenantId, token);
                if (!active) return;
                setData(workspace);
                if (!workspace.credits.some(c => c.id === id)) {
                    const old = await getCorrection(tenantId, token, id);
                    if (active) setLegacy(old);
                }
            } catch (e) { if (active) setError((e as Error).message); }
        })();
        return () => { active = false; };
    }, [tenantId, id]);
    const note = data?.credits.find(c => c.id === id);
    if (!data || !note && !legacy) return <div className="p-4 sm:p-8 max-w-5xl mx-auto"><Link href={CREDIT_ROUTES.LIST} className="text-blue-600 hover:underline">← Back to Credit notes</Link><Card className="p-6 mt-6">{error ? <p role="alert" className="text-red-600">{error}</p> : <p role="status">Loading credit note…</p>}</Card></div>;
    if (legacy) return <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6"><Link className="text-blue-600 hover:underline" href={CREDIT_ROUTES.LIST}>← Back to Credit notes</Link><h1 className="text-3xl font-bold">Credit record</h1><Card className="p-6 space-y-3"><h2 className="font-semibold">Related documents</h2>{legacy.originals.map(o => <Link key={o.id} className="block text-blue-600 hover:underline" href={`/workspace/invoices/${o.id}`}>{o.number}</Link>)}{legacy.replacementId && <Link className="block text-blue-600 hover:underline" href={`/workspace/invoices/${legacy.replacementId}`}>{legacy.replacementNumber}</Link>}</Card><Button variant="secondary" onClick={() => window.open(CREDIT_ROUTES.PRINT(id), "_blank")}>Preview / Print</Button></div>;
    if (!note) return null;
    const money = (amount: number) => creditMoney(note.input.currency, amount);
    const publicPath = note.status === "issued" && note.publicToken ? CREDIT_ROUTES.PUBLIC(note.publicToken) : undefined;
    const issue = async () => {
        if (busy) return;
        setBusy(true); setError("");
        try {
            await issueCreditNote(tenantId, await requireActionIdToken(), id, note.revision);
            await reload(); setIssueConfirm(false); setNotice("Credit note issued");
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };
    const exportCsv = () => {
        const url = URL.createObjectURL(new Blob([creditCsv(note)], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = `credit-${note.number || note.id}.csv`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto">
            <Link className="text-blue-600 hover:underline mb-2 inline-block" href={CREDIT_ROUTES.LIST}>← Back to Credit notes</Link>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6"><div><h1 className="text-3xl font-bold">{note.number || "Draft credit note"}</h1><Link className="text-gray-600 hover:underline mt-1 inline-block" href={`/workspace/clients/${note.input.clientId}`}>{note.client.name}</Link></div><CreditStatus status={note.status} /></div>
            {error && <p role="alert" className="p-4 mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700">{error}</p>}
            {notice && <p role="status" aria-live="polite" className="p-4 mb-6 rounded-lg border border-green-200 bg-green-50 text-green-800">{notice}</p>}
            <Card className="p-6 mb-6"><dl className="grid grid-cols-2 sm:grid-cols-4 gap-6">{[[note.status === "draft" ? "Credit amount" : "Issued amount", note.totalMinor], ["Applied", note.appliedMinor], ["Refunded", note.refundedMinor], ["Available credit", note.availableMinor]].map(([label, value]) => <div key={label}><dt className="text-sm text-gray-600 mb-1">{label}</dt><dd className="text-xl font-semibold tabular-nums">{money(value as number)}</dd></div>)}</dl></Card>
            <div className="flex flex-wrap gap-3 mb-6">
                <Button variant="secondary" onClick={() => window.open(CREDIT_ROUTES.PRINT(id), "_blank")}>Preview / Print</Button>
                <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
                {note.status === "draft" ? <><Link href={CREDIT_ROUTES.EDIT(id)} className="px-6 py-2 border border-foreground/20 rounded-lg font-medium hover:bg-foreground/5">Edit draft</Link><Button disabled={busy} onClick={() => setIssueConfirm(true)}>Issue credit note</Button></> : <><Button disabled={!note.availableMinor} onClick={() => setAction({ kind: "allocation" })}>Apply credit</Button><Button variant="secondary" disabled={!note.availableMinor} onClick={() => setAction({ kind: "refund" })}>Record refund</Button></>}
            </div>
            {issueConfirm && <Card className="p-6 mb-6 space-y-4"><h2 className="font-semibold">Issue credit note</h2><p>Issue {money(note.totalMinor)} for {note.client.name}? The credit will remain available until you apply it or record a refund. No email will be sent.</p><div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={() => setIssueConfirm(false)}>Cancel</Button><Button disabled={busy} onClick={() => void issue()}>{busy ? "Issuing…" : "Confirm issue credit note"}</Button></div></Card>}
            {action && <Card className="p-6 mb-6"><CreditActionForm key={`${action.kind}-${action.entryId || ""}`} note={note} invoices={data.invoices.map(i => i.invoice)} kind={action.kind} entryId={action.entryId} onCancel={() => setAction(undefined)} onDone={async () => { await reload(); setAction(undefined); setNotice("Credit balance updated"); }} /></Card>}
            <Card className="p-6 mb-6"><div className="grid sm:grid-cols-2 gap-6"><section><h2 className="font-semibold mb-2">Client</h2><p className="font-medium">{note.client.name}</p>{note.client.email && <p className="text-sm text-gray-600">{note.client.email}</p>}{note.client.address.map((line, index) => <p key={index} className="text-sm text-gray-600">{line}</p>)}</section><dl className="space-y-3 text-sm">{[["Issue date", creditDate(note.issueDate)], ["Supply date", creditDate(note.input.saleDate)], ["Currency", note.input.currency], ["Sale reference", note.input.reference || "—"]].map(([label, value]) => <div className="flex justify-between gap-4" key={label}><dt className="text-gray-600">{label}</dt><dd>{value}</dd></div>)}</dl></div></Card>
            <Card className="overflow-hidden mb-6"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 dark:bg-zinc-800"><tr>{["Description", "Amount before tax", "Tax", "Total"].map((title, index) => <th scope="col" key={title} className={`px-6 py-3 text-xs text-gray-500 uppercase tracking-wider whitespace-nowrap ${index ? "text-right" : ""}`}>{title}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{note.input.lines.map((line, index) => <tr key={line.id || index}><td className="px-6 py-4 font-medium">{line.description}</td><td className="px-6 py-4 text-right whitespace-nowrap tabular-nums">{money(line.netMinor)}</td><td className="px-6 py-4 text-right whitespace-nowrap tabular-nums">{money(line.taxMinor)}</td><td className="px-6 py-4 text-right whitespace-nowrap tabular-nums">{money(line.netMinor + line.taxMinor)}</td></tr>)}</tbody></table></div><div className="p-6 border-t flex justify-end"><dl className="w-full sm:w-80 space-y-3"><div className="flex justify-between"><dt>Subtotal</dt><dd>{money(note.netMinor)}</dd></div><div className="flex justify-between"><dt>Tax</dt><dd>{money(note.taxMinor)}</dd></div><div className="flex justify-between text-lg font-bold border-t pt-3"><dt>Total credit</dt><dd>{money(note.totalMinor)}</dd></div></dl></div></Card>
            <Card className="p-6 mb-6"><h2 className="font-semibold mb-2">Reason for credit</h2><p className="text-gray-600 whitespace-pre-wrap">{note.input.reason}</p>{note.original && <p className="mt-4 text-sm">Original invoice: <Link className="text-blue-600 hover:underline" href={`/workspace/invoices/${note.original.id}`}>{note.original.number}</Link></p>}</Card>
            {publicPath && <Card className="p-6 mb-6"><h2 className="font-semibold mb-2">Public credit note link</h2><p className="text-sm text-gray-600 mb-3">Share this link with your client to view the credit note.</p><div className="flex flex-wrap gap-3"><div className="flex-1 min-w-0"><Input aria-label="Credit note link" readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}${publicPath}`} onClick={e => e.currentTarget.select()} /></div><Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(window.location.origin + publicPath); setNotice("Link copied"); } catch { setNotice("Select and copy the link above."); } }}>Copy Link</Button><Link target="_blank" href={publicPath} className="px-6 py-2 border border-foreground/20 rounded-lg font-medium hover:bg-foreground/5">Open link</Link></div></Card>}
            <Card className="overflow-hidden"><div className="p-6 border-b"><h2 className="font-semibold">Credit history</h2></div>{note.entries.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 dark:bg-zinc-800"><tr>{["Date", "Action", "Invoice", "Amount", "Reference", "Reason", "Actions"].map(h => <th scope="col" key={h} className={`px-6 py-3 text-xs text-gray-500 uppercase whitespace-nowrap ${h === "Amount" ? "text-right" : ""}`}>{h}</th>)}</tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{note.entries.map(entry => <tr key={entry.id}><td className="px-6 py-4 whitespace-nowrap">{creditDate(entry.date)}</td><td className="px-6 py-4 whitespace-nowrap">{entry.kind === "allocation" ? "Applied" : entry.kind === "refund" ? "Refund recorded" : "Reversed"}</td><td className="px-6 py-4">{entry.invoiceId ? <Link className="text-blue-600 hover:underline" href={`/workspace/invoices/${entry.invoiceId}`}>{entry.invoiceNumber}</Link> : "—"}</td><td className="px-6 py-4 text-right whitespace-nowrap tabular-nums">{money(entry.amountMinor)}</td><td className="px-6 py-4">{entry.reference || "—"}</td><td className="px-6 py-4">{entry.reason}</td><td className="px-6 py-4">{entry.kind !== "reversal" && !note.entries.some(e => e.reverses === entry.id) && <Button variant="secondary" onClick={() => setAction({ kind: "reversal", entryId: entry.id })}>Reverse</Button>}</td></tr>)}</tbody></table></div> : <p className="p-6 text-gray-600">No credit applications or refunds recorded.</p>}</Card>
        </div>
    );
}
