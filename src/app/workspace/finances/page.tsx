"use client";
import Link from "next/link";
import {Suspense,useCallback,useEffect,useState} from "react";
import {useWorkspace} from "@/contexts/WorkspaceContext";
import {requireActionIdToken} from "@/lib/action-auth";
import {getFinancialRecords} from "./actions";
import {LedgerPanel} from "./LedgerPanel";
import {ReportPanel} from "./ReportPanel";
import {secondaryClass} from "./styles";
export default function PaymentRecords(){
 const {tenantId}=useWorkspace(),[records,setRecords]=useState<Awaited<ReturnType<typeof getFinancialRecords>>>(),[error,setError]=useState(""),[tab,setTab]=useState("receipts");
 const reload=useCallback(async()=>{setRecords(await getFinancialRecords(tenantId,await requireActionIdToken()));setError("");},[tenantId]);
 useEffect(()=>{let active=true;(async()=>{try{const data=await getFinancialRecords(tenantId,await requireActionIdToken());if(active)setRecords(data);}catch(e){if(active)setError(e instanceof Error?e.message:"Could not load receipts");}})();return()=>{active=false;};},[tenantId]);
 return <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">Receipts & reports</h1><Link className="underline" href="/workspace/invoices/credits">Credit notes</Link></div>{error&&<p role="alert">{error}</p>}{!records&&!error&&<p>Loading receipts…</p>}{records&&<><nav aria-label="Receipt workspace" className="flex gap-3 border-b pb-3">{[["receipts","Dated receipts"],["reports","Business reports"]].map(([id,title])=><button key={id} className={secondaryClass} aria-current={tab===id?"page":undefined} onClick={()=>setTab(id)}>{title}</button>)}</nav>{tab==="receipts"?<Suspense fallback={<p>Loading receipts…</p>}><LedgerPanel records={records} tenantId={tenantId} token={requireActionIdToken} done={reload}/></Suspense>:<ReportPanel tenantId={tenantId} token={requireActionIdToken}/>}</>}</main>;
}
