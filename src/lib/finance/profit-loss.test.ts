import test from "node:test";
import assert from "node:assert/strict";
import { buildProfitLoss } from "./profit-loss";
import { buildFinancialReport, type ReportInput, type ReportExpense } from "./report";
import type { FinancialInvoice, Movement, Receipt } from "./types";
const invoice:FinancialInvoice={id:"paid",number:"SYN",clientId:"client",currency:"AUD",issueDate:"2026-06-30",totalMinor:220000,taxMinor:20000,amountPaidMinor:220000,ledgerPaidMinor:220000,legacyUndatedMinor:0,balanceDueMinor:0,status:"paid"};
const receipt=(id:string,date:string):Receipt=>({id,date,amountMinor:110000,accountId:"bank",source:"manual",evidence:"Synthetic receipt",allocations:[{invoiceId:invoice.id,amountMinor:110000}],createdAt:date,createdBy:"owner"});
const expense:ReportExpense={id:"software",date:"2026-07-10",merchantName:"Synthetic software",amountMinor:11000,businessUsePercent:75,categoryId:"software",gstTreatment:"taxable_purchase",taxInvoiceStatus:"attached",receiptFileId:"sample",reviewStatus:"reviewed",gstRegistrationStatusAtCalculation:"registered",gstRegistrationEffectiveFromAtCalculation:"2026-01-01",financeMovementId:"software"};
const movement=(id:string,amountMinor:number,fields:Partial<Movement>={}):Movement=>({id,accountId:"bank",date:"2026-07-10",amountMinor,currency:"AUD",description:"Synthetic",fingerprint:id,occurrence:0,sourceRow:1,sourceHash:"sample",kind:"expense",revision:0,businessUseBps:10000,taxTreatment:"operating",...fields});
function fixture():ReportInput{return{period:{start:"2026-07-01",end:"2026-09-30",label:"Sample quarter"},receipts:[receipt("july","2026-07-05"),receipt("sept","2026-09-05")],invoices:[invoice,{...invoice,id:"unpaid",number:"UNPAID",amountPaidMinor:0,ledgerPaidMinor:0,balanceDueMinor:220000,status:"sent"}],creditNotes:[],movements:[movement("software",-11000,{expenseId:"software",businessUseBps:7500}),movement("refund",2200,{kind:"supplier_refund",date:"2026-08-10",refundOf:"software"}),movement("nondeductible",-1100,{taxTreatment:"non_deductible",category:"Business entertainment"}),movement("capital",-55000,{taxTreatment:"asset_review",category:"Equipment",allowanceMinor:3000,evidence:"Synthetic allowance",businessUseBps:7500}),movement("salary",999999,{kind:"salary"}),movement("transfer",999999,{kind:"transfer"}),movement("personal",-999999,{kind:"personal"})],expenses:[expense],accounts:[],imports:[],incompleteImports:0,categoryNames:{software:"Software"},registration:{status:"registered",effectiveFrom:"2026-01-01"},gstEvidence:{currentStatusEvidence:"Synthetic",obligationStatus:"reviewed",obligationEvidence:"Synthetic"}};}
test("cash P&L uses receipt dates, excludes recorded GST and includes business costs regardless of deductibility",()=>{
 const source=buildFinancialReport(fixture()),result=buildProfitLoss(source);
 assert.deepEqual(result.months,[{month:"2026-07",salesGstMinor:10000,purchaseGstMinor:750,incomeMinor:100000,expensesMinor:8600,profitMinor:91400},{month:"2026-08",salesGstMinor:0,purchaseGstMinor:-150,incomeMinor:0,expensesMinor:-1500,profitMinor:1500},{month:"2026-09",salesGstMinor:10000,purchaseGstMinor:0,incomeMinor:100000,expensesMinor:0,profitMinor:100000}]);
 assert.deepEqual(result.totals,{incomeMinor:200000,expensesMinor:7100,profitMinor:192900});
 assert.equal(result.categories.reduce((n,c)=>n+c.amountMinor,0),7100);assert.equal(result.details.salesGstMinor,20000);assert.equal(result.details.operatingPurchaseGstMinor,600);assert.equal(result.details.capitalPurchasesMinor,41250);assert.equal(result.months.reduce((n,m)=>n+m.salesGstMinor,0),result.details.salesGstMinor);assert.equal(result.months.reduce((n,m)=>n+m.purchaseGstMinor,0),result.details.operatingPurchaseGstMinor);assert.notEqual(result.totals.profitMinor,source.totals.indicativeProfitMinor);
});
test("unpaid invoices, transfers, salary, private costs and credit allocations cannot create P&L income",()=>{
 const input=fixture();input.receipts=[];input.creditNotes=[{id:"credit",status:"issued",issueDate:"2026-09-01",number:"CN",input:{currency:"AUD",saleDate:"",reference:"",reason:"Synthetic"},client:{name:"Synthetic"},issuedAmountMinor:10000,netMinor:10000,taxMinor:0,entries:[{id:"apply",kind:"allocation",amountMinor:10000,date:"2026-09-02",invoiceId:"unpaid"}]} as never];
 const report=buildProfitLoss(buildFinancialReport(input));assert.equal(report.totals.incomeMinor,0);assert.equal(report.months[2].incomeMinor,0);
});
test("empty periods retain zero months and operating losses remain signed",()=>{
 const input=fixture();input.period={start:"2026-02-10",end:"2026-04-02",label:"Empty"};input.receipts=[];input.expenses=[];input.movements=[];
 const empty=buildProfitLoss(buildFinancialReport(input));assert.deepEqual(empty.totals,{incomeMinor:0,expensesMinor:0,profitMinor:0});assert.deepEqual(empty.months.map(m=>m.month),["2026-02","2026-03","2026-04"]);
 input.period={start:"2026-07-01",end:"2026-07-31",label:"Loss"};input.movements=[movement("loss",-5000)];const loss=buildProfitLoss(buildFinancialReport(input));assert.equal(loss.totals.profitMinor,-5000);assert.equal(loss.months[0].profitMinor,-5000);
});
test("monthly totals reconcile over a year boundary and split GST rounding",()=>{
 const input=fixture();input.period={start:"2026-12-31",end:"2027-02-01",label:"Boundary"};input.expenses=[];input.movements=[];input.invoices=[{...invoice,totalMinor:11,taxMinor:1,amountPaidMinor:11,ledgerPaidMinor:11}];input.receipts=[3,3,5].map((n,i)=>({...receipt(`tiny${i}`,["2026-12-31","2027-01-01","2027-02-01"][i]),amountMinor:n,allocations:[{invoiceId:invoice.id,amountMinor:n}]}));
 const result=buildProfitLoss(buildFinancialReport(input));assert.equal(result.totals.incomeMinor,10);assert.equal(result.months.reduce((n,m)=>n+m.incomeMinor,0),10);assert.deepEqual(result.months.map(m=>m.incomeMinor),[3,2,5]);
});
test("unallocated/unknown/refund data stays explicit without inventing cash or tax",()=>{
 const input=fixture();input.receipts[0].allocations=[];input.registration={status:"unknown"};const result=buildProfitLoss(buildFinancialReport(input));assert.ok(result.details.notes.some(n=>n.includes("not matched")));assert.ok(result.details.notes.some(n=>n.includes("registration")));assert.equal(result.details.grossReceiptsMinor,220000);
});
test("invalid or stale GST metadata fails rather than silently inventing monthly tax",()=>{
 const source=buildFinancialReport(fixture());source.receipts[0].gstMinor=undefined as never;assert.throws(()=>buildProfitLoss(source),/integer cents/);source.receipts[0].gstMinor=10000;source.totals.receivedMinor++;assert.throws(()=>buildProfitLoss(source),/Receipt totals changed/);
});
