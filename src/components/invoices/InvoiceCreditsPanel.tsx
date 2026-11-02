"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getCredits } from "@/app/workspace/credits/actions";
import { CREDIT_ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CreditActionForm } from "./CreditActionForm";
import { creditMoney, selectClass } from "./credit-ui";

export function InvoiceCreditsPanel({ invoiceId, balanceDueMinor, allowPayment }: {
    invoiceId: string;
    balanceDueMinor: number;
    allowPayment: boolean;
}) {
    const { tenantId } = useWorkspace();
    const router = useRouter();
    const [data, setData] = useState<Awaited<ReturnType<typeof getCredits>>>();
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [method, setMethod] = useState<"payment" | "credit">("payment");
    const [creditId, setCreditId] = useState("");
    const reload = async () => setData(await getCredits(tenantId, await requireActionIdToken()));
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const result = await getCredits(tenantId, await requireActionIdToken());
                if (active) { setData(result); setError(""); }
            } catch (e) { if (active) setError((e as Error).message); }
        })();
        return () => { active = false; };
    }, [tenantId, invoiceId, balanceDueMinor]);
    const invoice = data?.invoices.find(i => i.invoice.id === invoiceId)?.invoice;
    const credits = invoice ? data?.credits.filter(c => c.status === "issued" && c.input.clientId === invoice.clientId && c.input.currency === invoice.currency && c.availableMinor > 0) || [] : [];
    const note = credits.find(c => c.id === creditId);
    return (
        <Card className="p-6 mb-6 space-y-4">
            <h2 className="text-lg font-semibold">{balanceDueMinor > 0 ? "Settle invoice" : "Credit notes"}</h2>
            {error && <p role="alert" className="text-red-600">{error}</p>}
            {notice && <p role="status" aria-live="polite" className="text-green-700">{notice}</p>}
            {balanceDueMinor > 0 && <>
                <p className="text-sm text-gray-600">Record a payment received or apply available client credit.</p>
                <fieldset className="flex flex-wrap gap-6"><legend className="sr-only">Settlement method</legend>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="settlement-method" value="payment" checked={method === "payment"} onChange={() => setMethod("payment")} />Payment received</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="settlement-method" value="credit" checked={method === "credit"} onChange={() => setMethod("credit")} />Apply credit note</label>
                </fieldset>
                {method === "payment" ? <div className="space-y-3">{allowPayment ? <Button onClick={() => router.push(`/workspace/payments?invoice=${encodeURIComponent(invoiceId)}`)}>Record payment</Button> : <p className="text-sm text-gray-600">Payment recording is currently available for AUD invoices.</p>}</div> : !data ? <p role="status">Loading available credit…</p> : !credits.length ? <p className="text-sm text-gray-600">No available credit notes for this client and currency.</p> : <div className="space-y-4">
                    <label className="block text-sm font-medium">Credit note<select className={`${selectClass} mt-2`} value={creditId} onChange={e => setCreditId(e.target.value)}><option value="">Choose a credit note</option>{credits.map(c => <option key={c.id} value={c.id}>{c.number} · {creditMoney(c.input.currency, c.availableMinor)} available</option>)}</select></label>
                    {note && <CreditActionForm key={note.id} note={note} kind="allocation" invoiceId={invoiceId} invoices={data.invoices.map(i => i.invoice)} onCancel={() => setCreditId("")} onDone={async () => { await reload(); setCreditId(""); setNotice("Credit applied. The invoice balance has been updated."); }} />}
                </div>}
            </>}
            <div className="flex flex-wrap gap-4 pt-3 border-t text-sm"><Link className="text-blue-600 hover:underline" href={`${CREDIT_ROUTES.NEW}?invoiceId=${encodeURIComponent(invoiceId)}`}>Create credit note for this invoice</Link><Link className="text-blue-600 hover:underline" href={CREDIT_ROUTES.LIST}>View credit notes</Link></div>
        </Card>
    );
}
