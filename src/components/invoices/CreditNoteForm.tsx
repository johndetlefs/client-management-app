"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getCredits, saveCreditNote } from "@/app/workspace/invoices/credits/actions";
import { parseSignedMoney } from "@/lib/finance/money";
import type { CreditInput } from "@/lib/credits/types";
const blank = (): CreditInput => ({ id: crypto.randomUUID(), clientId: "", currency: "AUD", reason: "", reference: "", saleDate: "", lines: [{ id: crypto.randomUUID(), description: "", netMinor: 0, taxMinor: 0 }] });
function remainingLines(source: NonNullable<Awaited<ReturnType<typeof getCredits>>>["invoices"][number]["source"], credits: Awaited<ReturnType<typeof getCredits>>["credits"]) { return source.lines.map((l, index) => { const used = credits.filter(c => c.status === "issued" && c.original?.id === source.id).flatMap(c => c.input.lines.filter(v => v.originalLineIndex === index)); return { id: `${source.id}-${index}`, description: l.description, netMinor: l.netMinor - used.reduce((n, v) => n + v.netMinor, 0), taxMinor: l.taxMinor - used.reduce((n, v) => n + v.taxMinor, 0), originalLineIndex: index }; }).filter(l => l.netMinor + l.taxMinor > 0); }
const field = "w-full rounded-md border border-foreground/25 bg-background px-3 py-2";
export function CreditNoteForm({ invoiceId, creditId }: {
    invoiceId?: string;
    creditId?: string;
}) {
    const { tenantId } = useWorkspace(), router = useRouter();
    const [data, setData] = useState<Awaited<ReturnType<typeof getCredits>>>(), [input, setInput] = useState<CreditInput>(), [revision, setRevision] = useState(0), [texts, setTexts] = useState<Record<string, string>>({}), [error, setError] = useState(""), [busy, setBusy] = useState(false);
    useEffect(() => { let active = true; (async () => { try {
        const d = await getCredits(tenantId, await requireActionIdToken());
        if (!active)
            return;
        setData(d);
        const old = d.credits.find(c => c.id === creditId);
        if (old) {
            if (old.status !== "draft")
                throw Error("Issued credit notes cannot be edited");
            setInput(old.input);
            setRevision(old.revision);
        }
        else if (creditId)
            throw Error("Credit note not found");
        else if (invoiceId) {
            const source = d.invoices.find(i => i.source.id === invoiceId)?.source;
            if (!source)
                throw Error("Original invoice unavailable");
            setInput({ ...blank(), clientId: source.clientId, currency: source.currency, originalInvoiceId: source.id, reference: source.number, saleDate: "", lines: remainingLines(source, d.credits) });
        }
        else
            setInput(blank());
    }
    catch (e) {
        if (active)
            setError((e as Error).message);
    } })(); return () => { active = false; }; }, [tenantId, creditId, invoiceId]);
    if (!input || !data)
        return <div className="p-8">{error ? <p role="alert">{error}</p> : "Loading credit note…"}</div>;
    const formatCurrency = (n: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: /^[A-Z]{3}$/.test(input.currency) ? input.currency : "AUD" }).format(n / 100);
    const change = (v: Partial<CreditInput>) => setInput({ ...input, ...v });
    const source = data.invoices.find(i => i.source.id === input.originalInvoiceId)?.source;
    const chooseOriginal = (id: string) => { setTexts({}); const s = data.invoices.find(i => i.source.id === id)?.source; change(s ? { originalInvoiceId: s.id, currency: s.currency, reference: s.number, saleDate: "", lines: remainingLines(s, data.credits) } : { originalInvoiceId: undefined, reference: "", saleDate: "", lines: blank().lines }); };
    const amount = (index: number, key: "netMinor" | "taxMinor", text: string) => { try {
        const value = text ? parseSignedMoney(text) : 0;
        const lines = input.lines.map((l, i) => i === index ? { ...l, [key]: value } : l);
        if (source && key === "netMinor") {
            const line = lines[index], o = source.lines[line.originalLineIndex!], used = data.credits.filter(c => c.status === "issued" && c.original?.id === source.id).flatMap(c => c.input.lines.filter(v => v.originalLineIndex === line.originalLineIndex)).reduce((n, v) => n + v.netMinor, 0);
            const tax = (net: number) => o.netMinor ? Number((BigInt(net) * BigInt(o.taxMinor) + BigInt(o.netMinor) / BigInt(2)) / BigInt(o.netMinor)) : 0;
            line.taxMinor = tax(used + value) - tax(used);
        }
        change({ lines });
        setError("");
    }
    catch (e) {
        setError((e as Error).message);
    } };
    const save = async () => { setBusy(true); setError(""); try {
        const parsed = { ...input, lines: input.lines.map(l => ({ ...l, netMinor: texts[`${l.id}:netMinor`] === undefined ? l.netMinor : parseSignedMoney(texts[`${l.id}:netMinor`]), taxMinor: source || texts[`${l.id}:taxMinor`] === undefined ? l.taxMinor : parseSignedMoney(texts[`${l.id}:taxMinor`]) })) };
        const note = await saveCreditNote(tenantId, await requireActionIdToken(), parsed, revision);
        router.push(`/workspace/invoices/credits/${note.id}`);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-5"><Link className="underline" href="/workspace/invoices/credits">← Credit notes</Link><h1 className="text-2xl font-bold">{creditId ? "Edit credit note" : "New credit note"}</h1>{error && <p role="alert" className="border rounded p-3">{error}</p>}<fieldset disabled={busy} className="space-y-4"><div className="grid sm:grid-cols-2 gap-4"><label>Client<select className={field} value={input.clientId} disabled={!!invoiceId} onChange={e => { setTexts({}); change({ clientId: e.target.value, originalInvoiceId: undefined, reference: "", saleDate: "", lines: blank().lines }); }}><option value="">Select client</option>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Currency<input className={field} value={input.currency} maxLength={3} disabled={!!source} onChange={e => change({ currency: e.target.value.toUpperCase() })}/></label></div><label className="block">Original invoice (optional)<select className={field} value={input.originalInvoiceId || ""} onChange={e => chooseOriginal(e.target.value)}><option value="">No linked invoice</option>{data.invoices.filter(i => i.source.clientId === input.clientId).map(i => <option key={i.source.id} value={i.source.id}>{i.source.number} · {formatCurrency(i.source.totalMinor)}</option>)}</select></label><div className="grid sm:grid-cols-2 gap-4"><label>Original sale reference<input className={field} value={input.reference} onChange={e => change({ reference: e.target.value })}/></label><label>Supply date<input className={field} type="date" value={input.saleDate} onChange={e => change({ saleDate: e.target.value })}/></label></div>
 <section className="space-y-3"><h2 className="font-semibold">Credit lines</h2>{input.lines.map((l, index) => <div className="border rounded p-4 space-y-3" key={l.id || `${input.originalInvoiceId || "manual"}-${l.originalLineIndex ?? index}`}><label className="block">Description<input className={field} value={l.description} onChange={e => change({ lines: input.lines.map((v, i) => i === index ? { ...v, description: e.target.value } : v) })}/></label><div className="grid sm:grid-cols-2 gap-3"><label>Amount before tax ({input.currency})<input aria-label={`Line ${index + 1} amount before tax`} className={field} inputMode="decimal" value={texts[`${l.id}:netMinor`] ?? (l.netMinor / 100).toFixed(2)} onChange={e => setTexts({ ...texts, [`${l.id}:netMinor`]: e.target.value })} onBlur={e => amount(index, "netMinor", e.target.value)}/></label><label>Tax amount ({input.currency}){source ? <p className="py-2">{formatCurrency(l.taxMinor)} · from original supply</p> : <input aria-label={`Line ${index + 1} tax amount`} className={field} inputMode="decimal" value={texts[`${l.id}:taxMinor`] ?? (l.taxMinor / 100).toFixed(2)} onChange={e => setTexts({ ...texts, [`${l.id}:taxMinor`]: e.target.value })} onBlur={e => amount(index, "taxMinor", e.target.value)}/>}</label></div><button className="underline" onClick={() => change({ lines: input.lines.filter((_, i) => i !== index) })}>Remove line</button></div>)}{!source && <button className="underline" onClick={() => change({ lines: [...input.lines, { id: crypto.randomUUID(), description: "", netMinor: 0, taxMinor: 0 }] })}>Add line</button>}</section><p className="font-semibold">Credit total: {formatCurrency(input.lines.reduce((n, l) => n + l.netMinor + l.taxMinor, 0))}</p><label className="block">Reason for credit<textarea className={field} value={input.reason} onChange={e => change({ reason: e.target.value })}/></label><button onClick={save} className="rounded-md bg-foreground text-background px-5 py-2">{busy ? "Saving…" : "Save draft"}</button></fieldset></div>;
}
