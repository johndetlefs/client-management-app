"use client";

import { useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { recordCreditAction } from "@/app/workspace/credits/actions";
import { parseSignedMoney } from "@/lib/finance/money";
import { sydneyDate } from "@/lib/finance/period";
import type { CreditInvoice, CreditNote, CreditRequest } from "@/lib/credits/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { creditMoney, selectClass } from "./credit-ui";

export function CreditActionForm({ note, invoices, kind, invoiceId, entryId, onDone, onCancel }: {
    note: CreditNote;
    invoices: CreditInvoice[];
    kind: CreditRequest["kind"];
    invoiceId?: string;
    entryId?: string;
    onDone: () => Promise<void>;
    onCancel: () => void;
}) {
    const { tenantId } = useWorkspace();
    const [target, setTarget] = useState(invoiceId || "");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(sydneyDate);
    const [reference, setReference] = useState("");
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState<CreditRequest>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const availableInvoices = invoices.filter(i => i.clientId === note.input.clientId && i.currency === note.input.currency && i.balanceDueMinor > 0 && i.status !== "draft" && i.status !== "void" && !i.creditedBy);
    const invoice = availableInvoices.find(i => i.id === target);
    const review = () => {
        try {
            if (!date) throw Error("Choose a date");
            if (!reason.trim()) throw Error("Enter a reason");
            const amountMinor = kind === "reversal" ? 0 : parseSignedMoney(amount);
            if (kind !== "reversal" && (amountMinor <= 0 || amountMinor > note.availableMinor)) throw Error("Enter an amount greater than zero, up to the available credit");
            if (kind === "allocation" && (!invoice || amountMinor > invoice.balanceDueMinor)) throw Error("Choose an outstanding invoice and an amount no greater than its balance due");
            setPending({ id: crypto.randomUUID(), kind, amountMinor, date, reference, reason, ...(kind === "allocation" ? { invoiceId: target } : {}), ...(kind === "reversal" ? { entryId } : {}) });
            setError("");
        } catch (e) { setError((e as Error).message); }
    };
    const confirm = async () => {
        if (!pending || busy) return;
        setBusy(true); setError("");
        try {
            await recordCreditAction(tenantId, await requireActionIdToken(), note.id, pending);
            await onDone();
        } catch (e) { setError((e as Error).message); }
        finally { setBusy(false); }
    };
    const title = kind === "allocation" ? "Apply credit note" : kind === "refund" ? "Record refund" : "Reverse credit entry";
    return (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); review(); }} aria-label={title}>
            <h3 className="font-semibold">{title}</h3>
            {kind === "refund" && <p className="text-sm text-gray-600">Record a refund you have made. This does not send a payment.</p>}
            {error && <p role="alert" className="text-red-600">{error}</p>}
            <fieldset disabled={busy || !!pending} className="space-y-4">
                {kind === "allocation" && (invoiceId ? <p className="text-sm text-gray-600">Invoice {invoice?.number || invoiceId} · {creditMoney(note.input.currency, invoice?.balanceDueMinor || 0)} due</p> : <label className="block text-sm font-medium">Invoice<select required className={`${selectClass} mt-2`} value={target} onChange={e => setTarget(e.target.value)}><option value="">Choose outstanding invoice</option>{availableInvoices.map(i => <option key={i.id} value={i.id}>{i.number} · {creditMoney(i.currency, i.balanceDueMinor)} due</option>)}</select></label>)}
                <div className="grid sm:grid-cols-2 gap-4">
                    {kind !== "reversal" && <label className="block text-sm font-medium">Amount ({note.input.currency})<div className="mt-2"><Input aria-label="Credit amount to apply or refund" required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></div><span className="block text-xs text-gray-500 mt-1">{creditMoney(note.input.currency, note.availableMinor)} available</span></label>}
                    <label className="block text-sm font-medium">Date<div className="mt-2"><Input aria-label="Credit action date" required type="date" value={date} onChange={e => setDate(e.target.value)} /></div></label>
                    <label className="block text-sm font-medium">Reference<div className="mt-2"><Input aria-label="Credit action reference" value={reference} onChange={e => setReference(e.target.value)} /></div></label>
                    <label className="block text-sm font-medium">Reason<div className="mt-2"><Input aria-label="Credit action reason" required value={reason} onChange={e => setReason(e.target.value)} /></div></label>
                </div>
            </fieldset>
            {pending ? <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-4 space-y-4" role="group" aria-label="Confirm credit action">
                <p>{kind === "reversal" ? "Reverse this entry and restore the credit balance?" : kind === "allocation" ? `Apply ${creditMoney(note.input.currency, pending.amountMinor)} from ${note.number} to invoice ${invoice?.number}? The remaining invoice balance will be ${creditMoney(note.input.currency, (invoice?.balanceDueMinor || 0) - pending.amountMinor)}.` : `Record a refund of ${creditMoney(note.input.currency, pending.amountMinor)} from ${note.number}?`}</p>
                <p className="text-sm text-gray-600">Date: {date} · Reason: {reason}</p>
                <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={busy} onClick={() => setPending(undefined)}>Back</Button><Button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "Saving…" : kind === "allocation" ? "Apply credit" : kind === "refund" ? "Confirm refund record" : "Confirm reversal"}</Button></div>
            </div> : <div className="flex flex-wrap gap-3"><Button type="submit">Review {kind === "allocation" ? "credit" : kind === "refund" ? "refund" : "reversal"}</Button><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button></div>}
        </form>
    );
}
