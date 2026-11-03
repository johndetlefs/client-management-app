"use client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ProfitLossPanel } from "./ProfitLossPanel";
export default function ProfitLossPage() {
  const {tenantId}=useWorkspace();
  return <div className="mx-auto max-w-7xl p-4 sm:p-8"><div className="mb-8"><h1 className="text-3xl font-bold">Profit and loss</h1><p className="mt-1 text-gray-600">Cash basis · AUD · income and business operating expenses</p></div><ProfitLossPanel tenantId={tenantId}/></div>;
}
