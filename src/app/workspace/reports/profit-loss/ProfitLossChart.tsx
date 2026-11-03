"use client";
import { useState } from "react";
import { formatCurrency } from "@/lib/invoice-utils";
import type { ProfitLossMonth } from "@/lib/finance/profit-loss";

export function monthName(month:string,short=false) {
  return new Intl.DateTimeFormat("en-AU",{month:short?"short":"long",year:short?undefined:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T00:00:00Z`));
}
const series=[{key:"incomeMinor",label:"Income",color:"#0f766e"},{key:"expensesMinor",label:"Operating expenses",color:"#64748b"},{key:"profitMinor",label:"Operating profit / loss",color:"#7c3aed"}] as const;
export function ProfitLossChart({months}:{months:ProfitLossMonth[]}) {
  const [selected,setSelected]=useState(months.length-1);
  const chosen=months[selected]||months[0];
  const values=months.flatMap(m=>series.map(s=>m[s.key]));
  const rawHigh=Math.max(0,...values),rawLow=Math.min(0,...values),rawStep=rawHigh===0&&rawLow===0?20:Math.max((rawHigh-rawLow)/5,1);
  const magnitude=10**Math.floor(Math.log10(rawStep));
  const step=[1,2,5,10].map(n=>n*magnitude).find(n=>n>=rawStep)!;
  const high=rawHigh===0&&rawLow===0?step*5:Math.ceil(rawHigh/step)*step,low=Math.floor(rawLow/step)*step,range=high-low;
  const ticks=Array.from({length:Math.round(range/step)+1},(_,i)=>low+i*step);
  const width=Math.max(720,months.length*82+110),height=350,left=84,right=20,top=32,bottom=274;
  const y=(value:number)=>top+(high-value)/range*(bottom-top),zero=y(0),slot=(width-left-right)/months.length;
  const tick=(value:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",notation:Math.abs(value)>=100000?"compact":"standard",maximumFractionDigits:step<100?2:0}).format(value/100);
  return <div className="min-w-0 space-y-5">
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{series.map(s=><span key={s.key} className="flex items-center gap-2"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{background:s.color}}/>{s.label}</span>)}</div>
    {chosen&&<div aria-live="polite" className="flex min-h-8 flex-wrap items-center gap-x-5 gap-y-2 text-sm"><span className="font-medium">{monthName(chosen.month)}</span><span>Income {formatCurrency(chosen.incomeMinor)}</span><span>Expenses {formatCurrency(chosen.expensesMinor)}</span><span className={chosen.profitMinor<0?"font-medium text-red-700":"font-medium"}>{chosen.profitMinor<0?"Loss":"Profit"} {formatCurrency(Math.abs(chosen.profitMinor))}</span></div>}
    <div className="max-w-full overflow-x-auto rounded-lg border border-foreground/10">
      <svg role="group" aria-label="Monthly cash-basis income, expenses and operating profit graph" viewBox={`0 0 ${width} ${height}`} className="block w-full" style={{minWidth:width,height}}>
        <g aria-hidden="true" fill="currentColor">
          <text x={left} y={17} fontSize="12" fontWeight="600">Amount (AUD)</text>
          <line x1={left} x2={left} y1={top} y2={bottom} stroke="currentColor" opacity="0.55"/>
          <line x1={left} x2={width-right} y1={bottom} y2={bottom} stroke="currentColor" opacity="0.55"/>
          <text x={(left+width-right)/2} y={height-9} textAnchor="middle" fontSize="12" fontWeight="600">Month</text>
        </g>
        {ticks.map(value=><g key={value} aria-hidden="true"><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="currentColor" strokeWidth={value===0?1.5:1} opacity={value===0?0.6:0.12}/><line x1={left-5} x2={left} y1={y(value)} y2={y(value)} stroke="currentColor" opacity="0.55"/><text x={left-10} y={y(value)+4} textAnchor="end" fill="currentColor" fontSize="12" opacity="0.8">{tick(value)}</text></g>)}
        {months.map((m,index)=>{const x=left+index*slot;return <g key={m.month} role="button" tabIndex={0} aria-pressed={selected===index} aria-label={`${monthName(m.month)}. Income ${formatCurrency(m.incomeMinor)}, expenses ${formatCurrency(m.expensesMinor)}, operating ${m.profitMinor<0?"loss":"profit"} ${formatCurrency(Math.abs(m.profitMinor))}`} onMouseEnter={()=>setSelected(index)} onFocus={()=>setSelected(index)} onClick={()=>setSelected(index)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelected(index);}}} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-foreground">
          <rect x={x+2} y={top-4} width={slot-4} height={bottom-top+10} fill="currentColor" opacity={selected===index?0.035:0}/>
          {series.map((s,n)=>{const value=m[s.key],point=y(value);return <rect key={s.key} x={x+slot/2-27+n*18} y={Math.min(point,zero)} width={14} height={value===0?0:Math.max(2,Math.abs(point-zero))} rx="2" fill={s.key==="profitMinor"&&value<0?"#b91c1c":s.color}/>;})}
          <line aria-hidden="true" x1={x+slot/2} x2={x+slot/2} y1={bottom} y2={bottom+5} stroke="currentColor" opacity="0.55"/>
          <text x={x+slot/2} y={bottom+24} textAnchor="middle" fill="currentColor" fontSize="11">{monthName(m.month,true)}</text>
          {(index===0||m.month.endsWith("-01"))&&<text x={x+slot/2} y={bottom+40} textAnchor="middle" fill="currentColor" opacity="0.6" fontSize="10">{m.month.slice(0,4)}</text>}
        </g>;})}
      </svg>
    </div>
    <p className="text-xs text-foreground/60">Select a month for its figures. The table below shows the same amounts.</p>
  </div>;
}
