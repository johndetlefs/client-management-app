"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getCredits } from "@/app/workspace/credits/actions";
import { getCorrection } from "@/app/workspace/invoice-corrections/actions";
import { creditDocument } from "@/lib/credits/documents";
import { correctionDocuments, type BillingDocumentData } from "@/lib/invoice-corrections/documents";
import { CREDIT_ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/Button";
import { BillingDocument, BillingPrintStyles } from "./BillingDocument";

export function CreditNotePrint() {
    const { tenantId } = useWorkspace();
    const { id } = useParams<{ id: string }>();
    const [document, setDocument] = useState<BillingDocumentData>();
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const token = await requireActionIdToken();
                const workspace = await getCredits(tenantId, token);
                const note = workspace.credits.find(c => c.id === id);
                const result = note ? creditDocument(note) : correctionDocuments(await getCorrection(tenantId, token, id)).credit;
                if (active) setDocument(result);
            } catch (e) { if (active) setError((e as Error).message); }
        })();
        return () => { active = false; };
    }, [tenantId, id]);
    return <div className="billing-document-page min-h-screen bg-gray-100 p-4 sm:p-8"><BillingPrintStyles /><div className="no-print max-w-5xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3"><Link href={CREDIT_ROUTES.VIEW(id)} className="text-blue-600 hover:underline">← Back to Credit note</Link><Button disabled={!document} onClick={() => window.print()}>Print / Save as PDF</Button></div>{error ? <p role="alert" className="no-print max-w-5xl mx-auto text-red-600">{error}</p> : document ? <BillingDocument document={document} /> : <p role="status" className="max-w-5xl mx-auto">Loading credit note…</p>}</div>;
}
