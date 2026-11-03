import { add, minor } from "./money";
import { calendarDate, inPeriod, type FinancialPeriod, validatePeriod } from "./period";
import type { FinancialReport } from "./report";

export interface ProfitLossMonth { month: string; salesGstMinor: number; purchaseGstMinor: number; incomeMinor: number; expensesMinor: number; profitMinor: number }
export interface ProfitLossReport {
  period: FinancialPeriod;
  basis: "cash";
  currency: "AUD";
  sourceIdentity?: string;
  totals: { incomeMinor: number; expensesMinor: number; profitMinor: number };
  months: ProfitLossMonth[];
  categories: { name: string; amountMinor: number }[];
  details: { grossReceiptsMinor: number; salesGstMinor: number; operatingPurchaseGstMinor: number; capitalPurchasesMinor: number; privatePurchasesMinor: number; notes: string[] };
}

/** A read-only operating P&L. Capital/tax allowances are not invented depreciation expenses. */
export function buildProfitLoss(source: FinancialReport): ProfitLossReport {
  validatePeriod(source.period);
  const rows = new Map<string, ProfitLossMonth>();
  for (let month = source.period.start.slice(0,7); month <= source.period.end.slice(0,7);) {
    rows.set(month,{ month, salesGstMinor:0, purchaseGstMinor:0, incomeMinor:0, expensesMinor:0, profitMinor:0 });
    const [year,m] = month.split("-").map(Number);
    month = `${year + (m===12 ? 1 : 0)}-${String(m===12 ? 1 : m+1).padStart(2,"0")}`;
    if (rows.size>132) throw new Error("Choose a shorter report period");
  }
  function row(date: string) {
    calendarDate(date);
    if (!inPeriod(date,source.period)) throw new Error("Report source date is outside the selected period");
    return rows.get(date.slice(0,7))!;
  }
  let grossReceiptsMinor=0,salesGstMinor=0,operatingPurchaseGstMinor=0;
  for (const receipt of source.receipts) {
    const gross=minor(receipt.amountMinor),tax=minor(receipt.gstMinor);
    if (gross<0 || tax<0 || tax>gross) throw new Error("Invalid receipt or sales GST amount");
    grossReceiptsMinor=add(grossReceiptsMinor,gross);salesGstMinor=add(salesGstMinor,tax);
    const month=row(receipt.date);month.incomeMinor=add(month.incomeMinor,gross,-tax);month.salesGstMinor=add(month.salesGstMinor,tax);
  }
  if (grossReceiptsMinor!==source.totals.receivedMinor || salesGstMinor!==source.totals.receivedGstMinor) throw new Error("Receipt totals changed; generate the report again");
  const categories=new Map<string,number>();
  for (const cost of source.costs) {
    // Business operating costs belong in P&L even where they are not income-tax deductible.
    const expense=add(cost.operatingMinor,cost.nonDeductibleMinor),month=row(cost.date);
    month.expensesMinor=add(month.expensesMinor,expense);
    if(expense){categories.set(cost.category,add(categories.get(cost.category)||0,expense));operatingPurchaseGstMinor=add(operatingPurchaseGstMinor,cost.gstCreditMinor);month.purchaseGstMinor=add(month.purchaseGstMinor,cost.gstCreditMinor);}
  }
  const months=[...rows.values()].map(m=>({...m,profitMinor:add(m.incomeMinor,-m.expensesMinor)}));
  const incomeMinor=add(...months.map(m=>m.incomeMinor)),expensesMinor=add(...months.map(m=>m.expensesMinor)),profitMinor=add(incomeMinor,-expensesMinor);
  if (add(...months.map(m=>m.salesGstMinor))!==salesGstMinor || add(...months.map(m=>m.purchaseGstMinor))!==operatingPurchaseGstMinor || expensesMinor!==add(source.totals.operatingMinor,source.totals.nonDeductibleMinor) || add(...categories.values())!==expensesMinor || add(...months.map(m=>m.profitMinor))!==profitMinor) throw new Error("Profit and loss does not reconcile in cents");
  const notes:string[]=[];
  if(source.totals.unallocatedMinor) notes.push("Some cash receipts are not matched to invoices. They are included in income; their GST treatment may need review.");
  if(source.gst.registration.status!=="registered") notes.push(source.gst.registration.status==="unknown" ? "GST registration is not recorded. GST follows the amounts currently recorded on invoices and expenses." : "The business is recorded as not GST registered. This report uses the tax amounts already recorded.");
  if(source.costs.some(c=>c.exceptions.length)) notes.push("Some expenses still need category, receipt or GST review.");
  if((source.creditRegister||[]).some(c=>c.refundedMinor>0)) notes.push("Recorded client refunds need matching to actual outgoing payments; no bank refund has been assumed.");
  if(!source.coverage.length || source.coverage.some(c=>!c.throughPeriod||c.controlGaps||c.unreviewed)) notes.push("Statement coverage or categorisation is incomplete. This report includes the transactions currently recorded.");
  return {period:source.period,basis:"cash",currency:"AUD",sourceIdentity:source.sourceIdentity,totals:{incomeMinor,expensesMinor,profitMinor},months,categories:[...categories].map(([name,amountMinor])=>({name,amountMinor})).sort((a,b)=>b.amountMinor-a.amountMinor||a.name.localeCompare(b.name)),details:{grossReceiptsMinor,salesGstMinor,operatingPurchaseGstMinor,capitalPurchasesMinor:source.totals.capitalMinor,privatePurchasesMinor:source.totals.privateCostMinor,notes}};
}
