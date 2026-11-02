"use server";
import {loadFinance,recordReceipt,reverseReceipt,type RecordReceiptInput} from "@/lib/finance/firestore";
import {loadFinancialReport,exportFinancialReport} from "@/lib/finance/report-firestore";
import type {FinancialPeriod} from "@/lib/finance/period";
export async function getFinancialRecords(tenantId:string,idToken:string){return loadFinance(tenantId,idToken);}
export async function saveReceipt(tenantId:string,idToken:string,input:RecordReceiptInput){return recordReceipt(tenantId,idToken,input);}
export async function correctReceipt(tenantId:string,idToken:string,id:string,reason:string){return reverseReceipt(tenantId,idToken,id,reason);}
export async function getPeriodReport(tenantId:string,idToken:string,period:FinancialPeriod){return loadFinancialReport(tenantId,idToken,period);}
export async function downloadPeriodReport(tenantId:string,idToken:string,period:FinancialPeriod,format:"csv"|"xlsx",expectedSourceIdentity:string){return exportFinancialReport(tenantId,idToken,period,format,expectedSourceIdentity);}
