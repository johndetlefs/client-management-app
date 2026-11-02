"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getCredits, saveCreditNote } from "@/app/workspace/credits/actions";
import { parseSignedMoney } from "@/lib/finance/money";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { CREDIT_ROUTES } from "@/lib/routes";
import { selectClass } from "./credit-ui";
import type { CreditInput } from "@/lib/credits/types";
const blank = (): CreditInput => ({ id: crypto.randomUUID(), clientId: "", currency: "AUD", reason: "", reference: "", saleDate: "", lines: [{ id: crypto.randomUUID(), description: "", netMinor: 0, taxMinor: 0 }] });
function remainingLines(source: NonNullable<Awaited<ReturnType<typeof getCredits>>>["invoices"][number]["source"], credits: Awaited<ReturnType<typeof getCredits>>["credits"]) { return source.lines.map((l, index) => { const used = credits.filter(c => c.status === "issued" && c.original?.id === source.id).flatMap(c => c.input.lines.filter(v => v.originalLineIndex === index)); return { id: `${source.id}-${index}`, description: l.description, netMinor: l.netMinor - used.reduce((n, v) => n + v.netMinor, 0), taxMinor: l.taxMinor - used.reduce((n, v) => n + v.taxMinor, 0), originalLineIndex: index }; }).filter(l => l.netMinor + l.taxMinor > 0); }
const field = selectClass;
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
    const save = async () => { if (busy) return; setBusy(true); setError(""); try {
        const parsed = { ...input, lines: input.lines.map(l => ({ ...l, netMinor: texts[`${l.id}:netMinor`] === undefined ? l.netMinor : parseSignedMoney(texts[`${l.id}:netMinor`]), taxMinor: source || texts[`${l.id}:taxMinor`] === undefined ? l.taxMinor : parseSignedMoney(texts[`${l.id}:taxMinor`]) })) };
        const note = await saveCreditNote(tenantId, await requireActionIdToken(), parsed, revision);
        router.push(CREDIT_ROUTES.VIEW(note.id));
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } };
    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto">
            <Link className="text-blue-600 hover:underline mb-2 inline-block" href={CREDIT_ROUTES.LIST}>← Back to Credit notes</Link>
            <div className="mb-6"><h1 className="text-3xl font-bold">{creditId ? "Edit credit note" : "New credit note"}</h1><p className="text-gray-600 mt-1">Credit a client for all or part of a sale</p></div>
            {error && <p role="alert" className="p-4 mb-6 border border-red-200 bg-red-50 text-red-700 rounded-lg">{error}</p>}
            <form onSubmit={e => { e.preventDefault(); void save(); }}>
                <fieldset disabled={busy} className="space-y-6">
                    <Card className="p-6 space-y-4">
                        <h2 className="text-lg font-semibold">Credit details</h2>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <label className="block text-sm font-medium">Client<select required className={`${field} mt-2`} value={input.clientId} disabled={!!invoiceId} onChange={e => { setTexts({}); change({ clientId: e.target.value, originalInvoiceId: undefined, reference: "", saleDate: "", lines: blank().lines }); }}><option value="">Select client</option>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                            <label className="block text-sm font-medium">Currency<div className="mt-2"><Input aria-label="Currency" required pattern="[A-Z]{3}" value={input.currency} maxLength={3} disabled={!!source} onChange={e => change({ currency: e.target.value.toUpperCase() })} /></div></label>
                        </div>
                        <label className="block text-sm font-medium">Original invoice (optional)<select className={`${field} mt-2`} value={input.originalInvoiceId || ""} onChange={e => chooseOriginal(e.target.value)}><option value="">No linked invoice</option>{data.invoices.filter(i => i.source.clientId === input.clientId).map(i => <option key={i.source.id} value={i.source.id}>{i.source.number} · {new Intl.NumberFormat("en-AU", { style: "currency", currency: i.source.currency }).format(i.source.totalMinor / 100)}</option>)}</select></label>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <label className="block text-sm font-medium">Original sale reference<div className="mt-2"><Input aria-label="Original sale reference" value={input.reference} onChange={e => change({ reference: e.target.value })} /></div></label>
                            <label className="block text-sm font-medium">Supply date<div className="mt-2"><Input aria-label="Supply date" type="date" value={input.saleDate} onChange={e => change({ saleDate: e.target.value })} /></div></label>
                        </div>
                    </Card>
                    <Card className="overflow-hidden">
                        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800"><h2 className="text-lg font-semibold">Credit items</h2></div>
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {input.lines.map((line, index) => (
                                <div className="p-6 space-y-4" key={line.id || `${input.originalInvoiceId || "manual"}-${line.originalLineIndex ?? index}`}>
                                    <label className="block text-sm font-medium">Description<div className="mt-2"><Input aria-label={`Line ${index + 1} description`} required value={line.description} onChange={e => change({ lines: input.lines.map((v, i) => i === index ? { ...v, description: e.target.value } : v) })} /></div></label>
                                    <div className="grid sm:grid-cols-2 gap-6">
                                        <label className="block text-sm font-medium">Amount before tax ({input.currency})<div className="mt-2"><Input aria-label={`Line ${index + 1} amount before tax`} inputMode="decimal" required value={texts[`${line.id}:netMinor`] ?? (line.netMinor / 100).toFixed(2)} onChange={e => setTexts({ ...texts, [`${line.id}:netMinor`]: e.target.value })} onBlur={e => amount(index, "netMinor", e.target.value)} /></div></label>
                                        <label className="block text-sm font-medium">Tax amount ({input.currency})<div className="mt-2">{source ? <p className="py-2 text-gray-600">{formatCurrency(line.taxMinor)} · from original supply</p> : <Input aria-label={`Line ${index + 1} tax amount`} inputMode="decimal" required value={texts[`${line.id}:taxMinor`] ?? (line.taxMinor / 100).toFixed(2)} onChange={e => setTexts({ ...texts, [`${line.id}:taxMinor`]: e.target.value })} onBlur={e => amount(index, "taxMinor", e.target.value)} />}</div></label>
                                    </div>
                                    <div className="flex justify-end"><Button type="button" variant="ghost" onClick={() => change({ lines: input.lines.filter((_, i) => i !== index) })}>Remove item</Button></div>
                                </div>
                            ))}
                            {!input.lines.length && <p className="p-6 text-gray-600">Add an item to this credit note.</p>}
                        </div>
                        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                            {!source && <Button type="button" variant="secondary" onClick={() => change({ lines: [...input.lines, { id: crypto.randomUUID(), description: "", netMinor: 0, taxMinor: 0 }] })}>Add item</Button>}
                            <p className="font-semibold sm:ml-auto">Credit total: {formatCurrency(input.lines.reduce((n, l) => n + l.netMinor + l.taxMinor, 0))}</p>
                        </div>
                    </Card>
                    <Card className="p-6"><label className="block text-sm font-medium">Reason for credit<textarea required className={`${field} mt-2 min-h-24`} value={input.reason} onChange={e => change({ reason: e.target.value })} /></label></Card>
                    <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => router.push(creditId ? CREDIT_ROUTES.VIEW(creditId) : CREDIT_ROUTES.LIST)}>Cancel</Button><Button type="submit" disabled={busy || !input.lines.length}>{busy ? "Saving…" : "Save draft"}</Button></div>
                </fieldset>
            </form>
        </div>
    );
}
