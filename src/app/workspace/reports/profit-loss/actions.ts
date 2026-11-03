"use server";
import { loadFinancialReport } from "@/lib/finance/report-firestore";
import { buildProfitLoss } from "@/lib/finance/profit-loss";
import type { FinancialPeriod } from "@/lib/finance/period";
export async function getProfitAndLoss(tenantId:string,idToken:string,period:FinancialPeriod) {
  return buildProfitLoss(await loadFinancialReport(tenantId,idToken,period));
}
