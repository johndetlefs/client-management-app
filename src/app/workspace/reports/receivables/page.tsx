"use client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { requireActionIdToken } from "@/lib/action-auth";
import { Card } from "@/components/ui/Card";
import { ReportPanel } from "@/app/workspace/finances/ReportPanel";
export default function ReceivablesPage() {
    const { tenantId } = useWorkspace();
    return <div className="p-4 sm:p-8 max-w-7xl mx-auto"><div className="mb-8"><h1 className="text-3xl font-bold">Receivables &amp; credits</h1><p className="text-gray-600 mt-1">Dated invoice balances, client credits and money received</p></div><Card className="p-6"><ReportPanel tenantId={tenantId} token={requireActionIdToken} /></Card></div>;
}
