import { syntheticPassword } from "./synthetic-auth";
/** Aged synthetic notes prove historical settlement; refuses any live project. */
import assert from "node:assert/strict";
import {Timestamp} from "firebase-admin/firestore";
import {adminDb} from "../../src/lib/firebase-admin";
import {disposeCredit} from "../../src/lib/credits/firestore";
import {recordReceipt} from "../../src/lib/finance/firestore";
import {loadFinancialReport} from "../../src/lib/finance/report-firestore";
import {sydneyDate} from "../../src/lib/finance/period";
import type {CreditNote,CreditRequest} from "../../src/lib/credits/types";
async function main(){
 if(process.env.NEXT_PUBLIC_FIREBASE_MODE!=="emulator"||process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!=="demo-cma-finance"||process.env.FIREBASE_FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099")throw Error("Synthetic emulator guard");
 const tenant=`credit-timeline-proof-${Date.now()}`,base=adminDb.doc(`tenants/${tenant}`),today=sydneyDate();if(today<"2026-10-27")throw Error("Aged fixture requires date on/after27October2026");
 const auth=await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"credit-owner@example.test",password:syntheticPassword(),returnSecureToken:true})});const token=(await auth.json()).idToken;if(!token)throw Error("Existing synthetic owner required");
 const note=(id:string):CreditNote=>({id,revision:2,status:"issued",input:{id,clientId:"client",currency:"AUD",reason:"Agreed credit",reference:"Sale",saleDate:"2026-09-01",lines:[{description:"Service reduction",netMinor:100000,taxMinor:0}]},client:{name:"Synthetic client",email:"",abn:"",address:[]},supplier:{businessName:"Synthetic studio",email:"",abn:"",address:"",phone:"",invoiceFooter:""},netMinor:100000,taxMinor:0,totalMinor:100000,issuedAmountMinor:100000,appliedMinor:0,refundedMinor:0,availableMinor:100000,entries:[],createdAt:"2026-10-01",updatedAt:"2026-10-01",createdBy:"credit-owner",issueDate:"2026-10-01",number:`CN-${id}`});
 const batch=adminDb.batch();batch.set(base,{syntheticOnly:true});batch.set(base.collection("users").doc("credit-owner"),{role:"owner"});batch.set(base.collection("invoices").doc("invoice"),{clientId:"client",currency:"AUD",invoiceNumber:"INV-1",status:"sent",issueDate:Timestamp.fromDate(new Date("2026-09-01T02:00:00Z")),totalMinor:100000,taxMinor:0,amountPaidMinor:0,ledgerPaidMinor:0,legacyUndatedMinor:0,creditAppliedMinor:0,balanceDueMinor:100000});for(const id of ["a","b"])batch.set(base.collection("creditNotes").doc(id),note(id));batch.set(base.collection("financialAccounts").doc("bank"),{id:"bank",label:"Synthetic bank",currency:"AUD",type:"bank"});await batch.commit();
 const req=(id:string,date:string,fields:Partial<CreditRequest>={}):CreditRequest=>({id,date,kind:"allocation",invoiceId:"invoice",amountMinor:100000,reason:"Synthetic dated credit",reference:"",...fields});
 await disposeCredit(tenant,token,"a",req("a-apply","2026-10-10"));await disposeCredit(tenant,token,"a",req("a-reverse","2026-10-20",{kind:"reversal",entryId:"a-apply",amountMinor:0}));
 const auditBefore=(await base.collection("financialAudit").get()).size;
 await assert.rejects(()=>disposeCredit(tenant,token,"b",req("b-overlap","2026-10-15")),/overpaid on 2026-10-15/);
 assert.equal((await base.collection("creditNotes").doc("b").get()).get("entries").length,0);assert.equal((await base.collection("invoices").doc("invoice").get()).get("creditAppliedMinor"),0);assert.equal((await base.collection("financialAudit").get()).size,auditBefore);
 const report=async(end:string)=>loadFinancialReport(tenant,token,{start:"2026-10-01",end,label:"Historical proof"});const mid=await report("2026-10-15");assert.equal(mid.invoices[0].creditsAppliedThroughEndMinor,100000);assert.equal(mid.invoices[0].datedLedgerRemainingMinor,0);assert.equal(mid.totals.receivedMinor,0);
 await disposeCredit(tenant,token,"b",req("b-valid","2026-10-21"));assert.equal((await report("2026-10-22")).invoices[0].datedLedgerRemainingMinor,0);await disposeCredit(tenant,token,"b",req("b-reverse","2026-10-25",{kind:"reversal",entryId:"b-valid",amountMinor:0}));
 const receipt=(id:string,date:string)=>({id,date,accountId:"bank",amountMinor:100000,evidence:"Synthetic bank receipt",allocations:[{invoiceId:"invoice",amountMinor:100000}]});
 await assert.rejects(()=>recordReceipt(tenant,token,receipt("cash-overlap","2026-10-15")),/overpaid on 2026-10-15/);assert.equal((await base.collection("invoiceReceipts").get()).size,0);assert.equal((await base.collection("invoices").doc("invoice").get()).get("amountPaidMinor"),0);
 await recordReceipt(tenant,token,receipt("cash-valid","2026-10-26"));assert.equal((await report("2026-10-15")).invoices[0].datedLedgerRemainingMinor,0);const current=await report(today);assert.equal(current.totals.receivedMinor,100000);assert.equal(current.invoices[0].creditsAppliedThroughEndMinor,0);assert.equal(current.invoices[0].datedLedgerRemainingMinor,0);
 console.log(JSON.stringify({syntheticOnly:true,tenant,result:"passed",checks:["cross-note backdated overlap rejected atomically","valid allocation after restoration accepted","overlap report remains callable and balanced","later backdated cash rejected without receipt/invoice changes","later valid cash accepted; historical/current reports reconcile","no real financial records or browser fixture modified"]}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
