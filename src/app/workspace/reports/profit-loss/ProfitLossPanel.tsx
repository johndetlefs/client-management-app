"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { requireActionIdToken } from "@/lib/action-auth";
import { formatCurrency } from "@/lib/invoice-utils";
import { financialYear, sydneyDate, type FinancialPeriod } from "@/lib/finance/period";
import type { ProfitLossReport } from "@/lib/finance/profit-loss";
import { fieldClass } from "@/app/workspace/finances/styles";
import { getProfitAndLoss } from "./actions";
import { ProfitLossChart, monthName } from "./ProfitLossChart";

export function ProfitLossPanel({tenantId}:{tenantId:string}) {
  const [today]=useState(sydneyDate);
  const [initialPeriod]=useState(()=>financialYear(Number(today.slice(0,4))-(Number(today.slice(5,7))<7?1:0),today));
  const [period,setPeriod]=useState<FinancialPeriod>(initialPeriod),[report,setReport]=useState<ProfitLossReport|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState("");
  const requestId=useRef(0);
  useEffect(()=>{
    let active=true;const id=++requestId.current;
    setBusy(true);setError("");
    requireActionIdToken().then(token=>getProfitAndLoss(tenantId,token,initialPeriod)).then(data=>{if(active&&id===requestId.current)setReport(data);}).catch(reason=>{if(active&&id===requestId.current)setError(reason instanceof Error?reason.message:"Unable to load profit and loss");}).finally(()=>{if(active&&id===requestId.current)setBusy(false);});
    return()=>{active=false;};
  },[tenantId,initialPeriod]);
  async function generate() {
    const id=++requestId.current;setBusy(true);setError("");
    try {const data=await getProfitAndLoss(tenantId,await requireActionIdToken(),period);if(id===requestId.current)setReport(data);}
    catch(reason){if(id===requestId.current)setError(reason instanceof Error?reason.message:"Unable to generate report");}
    finally{if(id===requestId.current)setBusy(false);}
  }
  const changed=report&&(report.period.start!==period.start||report.period.end!==period.end);
  return <div className="min-w-0 space-y-6" aria-busy={busy}>
    <Card className="p-5 sm:p-6"><form onSubmit={event=>{event.preventDefault();void generate();}} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-medium">From<input aria-label="Profit and loss from" className={`${fieldClass} mt-2 block w-full`} type="date" required max={today} value={period.start} onChange={e=>setPeriod({...period,start:e.target.value,label:"Custom period"})}/></label><label className="text-sm font-medium">Through<input aria-label="Profit and loss through" className={`${fieldClass} mt-2 block w-full`} type="date" required max={today} value={period.end} onChange={e=>setPeriod({...period,end:e.target.value,label:"Custom period"})}/></label><Button type="submit" disabled={busy}>{busy?"Loading…":"Update report"}</Button></form></Card>
    {error&&<p role="alert" className="rounded-lg border border-red-300 p-4 text-sm">{error}</p>}
    {changed&&<p role="status" className="text-sm text-foreground/65">Update the report to apply the new dates. The figures below still show {report.period.start} to {report.period.end}.</p>}
    {!report&&busy&&<p role="status" className="py-12 text-center text-foreground/60">Loading profit and loss…</p>}
    {report&&<>
      <div className="flex flex-wrap justify-between gap-3 text-sm text-foreground/65"><p>{report.period.start} to {report.period.end} · Australia/Sydney</p><p>Cash basis · Recorded transactions · Before income tax and depreciation</p></div>
      {report.details.notes.filter(note=>note.startsWith("Some cash receipts")||note.startsWith("Some expenses")||note.startsWith("Recorded client refunds")).map(note=><p key={note} className="text-sm text-amber-800 dark:text-amber-300">{note}</p>)}
      <dl className="grid gap-4 sm:grid-cols-3">{[["Income · GST excluded",report.totals.incomeMinor],["Operating expenses",report.totals.expensesMinor],[report.totals.profitMinor<0?"Operating loss":"Operating profit",Math.abs(report.totals.profitMinor)]].map(([label,amount])=><Card key={String(label)} className="p-6"><dt className="text-sm text-foreground/65">{label}</dt><dd className={`mt-3 text-3xl font-semibold tabular-nums ${label==="Operating loss"?"text-red-700":""}`}>{formatCurrency(Number(amount))}</dd></Card>)}</dl>
      <Card className="min-w-0 p-5 sm:p-6"><h2 className="mb-5 text-lg font-semibold">Monthly performance</h2>{report.months.every(m=>m.incomeMinor===0&&m.expensesMinor===0)&&<p className="mb-5 rounded-lg bg-foreground/5 p-4 text-sm">No recorded income or operating expenses in this period.</p>}<ProfitLossChart key={`${report.period.start}-${report.period.end}-${report.sourceIdentity}`} months={report.months}/></Card>
      <Card className="overflow-hidden"><div className="border-b border-foreground/10 p-5 sm:p-6"><h2 className="text-lg font-semibold">Monthly breakdown</h2><p className="mt-2 text-sm text-foreground/65">Income excludes sales GST; operating expenses exclude recoverable GST. GST columns show the recorded amounts removed from each month.</p></div><div className="max-w-full overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><caption className="sr-only">Cash basis profit and loss by month, AUD</caption><thead className="bg-foreground/5"><tr><th className="px-6 py-3">Month</th>{["Income ex GST","Sales GST","Operating expenses","Recoverable GST","Profit / loss"].map(label=><th key={label} className="whitespace-nowrap px-6 py-3 text-right">{label}</th>)}</tr></thead><tbody>{report.months.map(m=><tr key={m.month} className="border-t border-foreground/10"><th scope="row" className="whitespace-nowrap px-6 py-4 font-normal">{monthName(m.month)}</th>{[m.incomeMinor,m.salesGstMinor,m.expensesMinor,m.purchaseGstMinor,m.profitMinor].map((value,i)=><td key={i} className={`whitespace-nowrap px-6 py-4 text-right tabular-nums ${i===4&&value<0?"text-red-700":""}`}>{formatCurrency(value)}</td>)}</tr>)}</tbody><tfoot className="border-t border-foreground/20 font-semibold"><tr><th scope="row" className="px-6 py-4">Total</th>{[report.totals.incomeMinor,report.details.salesGstMinor,report.totals.expensesMinor,report.details.operatingPurchaseGstMinor,report.totals.profitMinor].map((value,i)=><td key={i} className="whitespace-nowrap px-6 py-4 text-right tabular-nums">{formatCurrency(value)}</td>)}</tr></tfoot></table></div></Card>
      <Card className="p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Operating expenses by category</h2><p className="mt-2 text-sm text-foreground/65">Business operating costs after recoverable GST. Capital purchases and private spending are excluded.</p></div><Link href="/workspace/expenses" className="text-sm underline">View expenses</Link></div>{report.categories.length?<dl className="divide-y divide-foreground/10">{report.categories.map(c=><div key={c.name} className="flex justify-between gap-4 py-3 text-sm"><dt>{c.name}</dt><dd className="tabular-nums">{formatCurrency(c.amountMinor)}</dd></div>)}</dl>:<p className="text-sm text-foreground/60">No operating expenses recorded in this period.</p>}</Card>

    </>}
  </div>;
}
