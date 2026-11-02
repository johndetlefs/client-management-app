"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getCredits, issueCreditNote, recordCreditAction } from "@/app/workspace/invoices/credits/actions";
import { getCorrection } from "@/app/workspace/invoice-corrections/actions";
import { BillingDocument, BillingPrintStyles } from "./BillingDocument";
import { creditDocument, creditCsv } from "@/lib/credits/documents";
import { correctionDocuments } from "@/lib/invoice-corrections/documents";
import type { InvoiceCorrection } from "@/lib/invoice-corrections/types";
import type { CreditRequest } from "@/lib/credits/types";
import { parseSignedMoney } from "@/lib/finance/money";
import { sydneyDate } from "@/lib/finance/period";
const field = "w-full border rounded px-3 py-2 bg-background";
export function CreditNoteDetail() {
    const { tenantId } = useWorkspace(), { id } = useParams<{
        id: string;
    }>();
    const [data, setData] = useState<Awaited<ReturnType<typeof getCredits>>>(), [legacy, setLegacy] = useState<InvoiceCorrection>(), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [issueConfirm, setIssueConfirm] = useState(false);
    const [mode, setMode] = useState<"allocation" | "refund" | "reversal" | "">(""), [target, setTarget] = useState(""), [amount, setAmount] = useState(""), [date, setDate] = useState(() => sydneyDate()), [reason, setReason] = useState(""), [reference, setReference] = useState(""), [entryId, setEntryId] = useState(""), [pending, setPending] = useState<CreditRequest>();
    const reload = async () => { const token = await requireActionIdToken(), d = await getCredits(tenantId, token); setData(d); if (!d.credits.some(c => c.id === id))
        setLegacy(await getCorrection(tenantId, token, id)); };
    useEffect(() => { let active = true; (async () => { try {
        const token = await requireActionIdToken(), d = await getCredits(tenantId, token);
        if (!active)
            return;
        setData(d);
        if (!d.credits.some(c => c.id === id)) {
            const old = await getCorrection(tenantId, token, id);
            if (active)
                setLegacy(old);
        }
    }
    catch (e) {
        if (active)
            setError((e as Error).message);
    } })(); return () => { active = false; }; }, [tenantId, id]);
    const act = async (work: () => Promise<void>) => { setBusy(true); setError(""); try {
        await work();
        await reload();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    if (error && !data)
        return <p role="alert" className="p-8">{error}</p>;
    if (!data)
        return <p className="p-8">Loading credit note…</p>;
    if (legacy)
        return <div className="billing-document-page p-4 md:p-8 bg-white text-black space-y-5"><BillingPrintStyles /><div className="no-print space-y-3"><Link className="underline" href="/workspace/invoices/credits">← Credit notes</Link><h1 className="text-2xl font-bold">Credit record</h1><div><h2 className="font-semibold">Related documents</h2>{legacy.originals.map(o => <Link key={o.id} className="block underline" href={`/workspace/invoices/${o.id}`}>{o.number}</Link>)}{legacy.replacementId && <Link className="block underline" href={`/workspace/invoices/${legacy.replacementId}`}>{legacy.replacementNumber}</Link>}</div><button className="underline" onClick={() => window.print()}>Print / Save as PDF</button></div><BillingDocument document={correctionDocuments(legacy).credit}/></div>;
    const note = data.credits.find(c => c.id === id);
    if (!note)
        return <p role="alert" className="p-8">Credit note not found</p>;
    const formatCurrency = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: note.input.currency }).format(n / 100);
    const availableInvoices = data.invoices.map(i => i.invoice).filter(i => i.clientId === note.input.clientId && i.currency === note.input.currency && i.balanceDueMinor > 0), publicPath = note.status === "issued" && note.publicToken ? `/public/credit/${note.publicToken}` : undefined;
    const begin = (kind: typeof mode, reverses = "") => { setMode(kind); setEntryId(reverses); setPending(undefined); setAmount(""); setReason(""); setReference(""); setDate(sydneyDate()); setTarget(""); };
    const review = () => { try {
        if (!mode)
            return;
        setPending({ id: crypto.randomUUID(), kind: mode, amountMinor: mode === "reversal" ? 0 : parseSignedMoney(amount), ...(mode === "allocation" ? { invoiceId: target } : {}), ...(mode === "reversal" ? { entryId } : {}), date, reference, reason });
        setError("");
    }
    catch (e) {
        setError((e as Error).message);
    } };
    const exportCsv = () => { const url = URL.createObjectURL(new Blob([creditCsv(note)], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `credit-${note.number || note.id}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    return <div className="billing-document-page p-4 md:p-8 bg-white text-black space-y-6"><BillingPrintStyles /><div className="no-print max-w-5xl mx-auto space-y-5"><div className="flex flex-wrap justify-between items-center gap-3"><Link className="underline" href="/workspace/invoices/credits">← Credit notes</Link><div className="flex flex-wrap gap-4"><button className="underline" onClick={() => window.print()}>Print / Save as PDF</button><button className="underline" onClick={exportCsv}>Export CSV</button>{note.status === "draft" && <Link className="underline" href={`/workspace/invoices/credits/${id}/edit`}>Edit draft</Link>}</div></div><h1 className="text-2xl font-bold">{note.number || "Draft credit note"} · {note.client.name}</h1>{error && <p role="alert" className="border rounded p-3">{error}</p>}{notice && <p role="status">{notice}</p>}
 <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 border rounded p-4">{[["Issued", note.issuedAmountMinor], ["Applied", note.appliedMinor], ["Recorded refunds", note.refundedMinor], ["Available", note.availableMinor]].map(([label, value]) => <div key={label}><dt className="text-sm text-gray-600">{label}</dt><dd className="text-xl font-semibold">{formatCurrency(value as number)}</dd></div>)}</dl>
 {note.status === "draft" ? <section className="space-y-3"><button disabled={busy} className="rounded bg-black text-white px-4 py-2" onClick={() => setIssueConfirm(true)}>Issue credit note</button>{issueConfirm && <div className="border rounded p-4 space-y-3"><p>Issue a credit note for {formatCurrency(note.totalMinor)}? It will remain available until you choose how to use it. Nothing will be sent.</p><div className="flex gap-4"><button onClick={() => setIssueConfirm(false)} disabled={busy}>Cancel</button><button className="underline" disabled={busy} onClick={() => act(async () => { await issueCreditNote(tenantId, await requireActionIdToken(), id, note.revision); setIssueConfirm(false); })}>Confirm issue credit note</button></div></div>}</section> : <div className="flex flex-wrap gap-4"><button className="underline" disabled={busy || !note.availableMinor} onClick={() => begin("allocation")}>Apply credit</button><button className="underline" disabled={busy || !note.availableMinor} onClick={() => begin("refund")}>Record refund</button></div>}
 {mode && <section className="border rounded p-4 space-y-3"><h2 className="font-semibold">{mode === "allocation" ? "Apply credit to invoice" : mode === "refund" ? "Record refund" : "Reverse disposition"}</h2>{mode === "refund" && <p className="text-sm">This records a refund in your books. No payment will be sent.</p>}<fieldset disabled={busy || !!pending} className="space-y-3">{mode === "allocation" && <label className="block">Invoice<select className={field} value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose outstanding invoice</option>{availableInvoices.map(i => <option key={i.id} value={i.id}>{i.number} · {formatCurrency(i.balanceDueMinor)} due</option>)}</select></label>}{mode !== "reversal" && <label className="block">Amount ({note.input.currency})<input aria-label="Disposition amount" className={field} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}/></label>}<label className="block">Date<input className={field} type="date" value={date} onChange={e => setDate(e.target.value)}/></label><label className="block">Reference<input className={field} value={reference} onChange={e => setReference(e.target.value)}/></label><label className="block">Reason<input className={field} value={reason} onChange={e => setReason(e.target.value)}/></label></fieldset>{!pending ? <div className="flex gap-4"><button className="underline" onClick={review}>Review action</button><button onClick={() => begin("")}>Cancel</button></div> : <div className="space-y-3"><p>{pending.kind === "reversal" ? "Reverse this recorded disposition and restore its credit?" : `${pending.kind === "allocation" ? "Apply" : "Record refund of"} ${formatCurrency(pending.amountMinor)}${pending.invoiceId ? ` to ${availableInvoices.find(i => i.id === pending.invoiceId)?.number || pending.invoiceId}` : ""}?`}</p><div className="flex gap-4"><button disabled={busy} onClick={() => setPending(undefined)}>Back</button><button className="underline" disabled={busy} onClick={() => act(async () => { await recordCreditAction(tenantId, await requireActionIdToken(), id, pending); begin(""); })}>Confirm credit action</button></div></div>}</section>}
 {publicPath && <section className="border rounded p-4 space-y-2"><label className="block" htmlFor="credit-public-link">Credit note link</label><div className="flex flex-wrap gap-3"><input id="credit-public-link" readOnly className="border rounded px-3 py-2 flex-1 min-w-0" value={`${typeof window !== "undefined" ? window.location.origin : ""}${publicPath}`}/><button className="underline" onClick={async () => { try {
        await navigator.clipboard.writeText(window.location.origin + publicPath);
        setNotice("Link copied");
    }
    catch {
        setNotice("Select and copy the link above.");
    } }}>Copy Link</button><Link className="underline" target="_blank" href={publicPath}>Open link</Link></div></section>}
 {note.entries.length > 0 && <section><h2 className="font-semibold mb-3">Credit history</h2><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{["Date", "Action", "Invoice", "Amount", "Reference", "Reason", ""].map((h, i) => <th key={i} className="p-2">{h}</th>)}</tr></thead><tbody>{note.entries.map(e => <tr key={e.id} className="border-t"><td className="p-2">{e.date}</td><td>{e.kind === "allocation" ? "Applied" : e.kind === "refund" ? "Refund recorded" : "Reversed"}</td><td>{e.invoiceId ? <Link className="underline" href={`/workspace/invoices/${e.invoiceId}`}>{e.invoiceNumber}</Link> : "—"}</td><td>{formatCurrency(e.amountMinor)}</td><td>{e.reference}</td><td>{e.reason}</td><td>{e.kind !== "reversal" && !note.entries.some(r => r.reverses === e.id) && <button disabled={busy} className="underline" onClick={() => begin("reversal", e.id)}>Reverse</button>}</td></tr>)}</tbody></table></div></section>}
 {note.original && <section><h2 className="font-semibold">Related documents</h2><Link className="underline" href={`/workspace/invoices/${note.original.id}`}>Original invoice {note.original.number}</Link></section>}
 </div><BillingDocument document={creditDocument(note)}/></div>;
}
