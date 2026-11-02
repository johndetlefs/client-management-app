"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { getFinancialRecords } from "@/app/workspace/finances/actions";
import { LedgerPanel } from "@/app/workspace/finances/LedgerPanel";
import { Card } from "@/components/ui/Card";
export default function PaymentsPage() {
    const { tenantId } = useWorkspace();
    const [records, setRecords] = useState<Awaited<ReturnType<typeof getFinancialRecords>>>();
    const [error, setError] = useState("");
    const reload = useCallback(async () => { setRecords(await getFinancialRecords(tenantId, await requireActionIdToken())); setError(""); }, [tenantId]);
    useEffect(() => { let active = true; (async () => { try { const data = await getFinancialRecords(tenantId, await requireActionIdToken()); if (active) setRecords(data); } catch (e) { if (active) setError((e as Error).message); } })(); return () => { active = false; }; }, [tenantId]);
    return <div className="p-4 sm:p-8 max-w-7xl mx-auto"><div className="mb-8"><h1 className="text-3xl font-bold">Payments received</h1><p className="text-gray-600 mt-1">Record incoming payments and allocate them to invoices</p></div>{error && <p role="alert" className="text-red-600 mb-6">{error}</p>}{!records && !error && <Card className="p-6"><p role="status">Loading payments…</p></Card>}{records && <Card className="p-6"><Suspense fallback={<p>Loading payments…</p>}><LedgerPanel records={records} tenantId={tenantId} token={requireActionIdToken} done={reload} /></Suspense></Card>}</div>;
}
