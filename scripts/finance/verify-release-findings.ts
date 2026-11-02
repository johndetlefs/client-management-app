/** One affected proof for independent release findings; disposable emulator only. */
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {syntheticPassword} from './synthetic-auth';
import {adminDb} from '../../src/lib/firebase-admin';
import {recordReceipt} from '../../src/lib/finance/firestore';
import {getBasPreparationSummary} from '../../src/app/workspace/expenses/bas-actions';
async function main(){
 const password=syntheticPassword();if(process.env.FIREBASE_FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Disposable emulator only');
 const auth=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'credit-owner@example.test',password,returnSecureToken:true})});const token=(await auth.json()).idToken;if(!token)throw Error('Existing synthetic owner required');
 const tenant=`credit-release-findings-${Date.now()}`,base=adminDb.doc(`tenants/${tenant}`),batch=adminDb.batch();batch.set(base,{syntheticOnly:true});batch.set(base.collection('users').doc('credit-owner'),{role:'owner'});
 batch.set(base.collection('settings').doc('business'),{businessName:'Synthetic release proof',tax:{gstRegistration:{status:'registered',effectiveFrom:'2026-07-01'},basPreparation:{accountingBasis:'non_cash',cadence:'quarterly',reportingMethod:'simpler_bas'}}});
 for(const [id,currency]of [['bank','AUD'],['foreign-bank','NZD'],['legacy-bank',null]] as const)batch.set(base.collection('financialAccounts').doc(id),{id,label:id,type:'bank',...(currency?{currency}:{})});
 for(const [id,currency]of [['aud','AUD'],['foreign','NZD'],['legacy',null]] as const)batch.set(base.collection('invoices').doc(id),{clientId:'client',invoiceNumber:id,status:'sent',issueDate:Timestamp.fromDate(new Date('2026-09-15T02:00:00Z')),totalMinor:100000,taxMinor:0,amountPaidMinor:0,ledgerPaidMinor:0,legacyUndatedMinor:0,creditAppliedMinor:0,balanceDueMinor:100000,...(currency?{currency}:{})});
 await batch.commit();
 const snapshot=async()=>JSON.stringify({invoices:(await base.collection('invoices').get()).docs.map(d=>[d.id,d.data()]),receipts:(await base.collection('invoiceReceipts').get()).docs.map(d=>d.data()),audit:(await base.collection('financialAudit').get()).docs.map(d=>d.data())});const before=await snapshot();
 const receipt=(id:string,accountId:string,invoiceId:string)=>({id,date:'2026-09-20',accountId,amountMinor:100000,evidence:'Synthetic remittance',allocations:[{invoiceId,amountMinor:100000}]});
 await assert.rejects(()=>recordReceipt(tenant,token,receipt('reject-invoice','bank','foreign')),/different invoice currency/);assert.equal(await snapshot(),before);
 await assert.rejects(()=>recordReceipt(tenant,token,receipt('reject-account','foreign-bank','aud')),/AUD accounts/);assert.equal(await snapshot(),before);
 await recordReceipt(tenant,token,{...receipt('legacy-valid','legacy-bank','legacy'),amountMinor:10000,allocations:[{invoiceId:'legacy',amountMinor:10000}]});assert.equal((await base.collection('invoices').doc('legacy').get()).get('balanceDueMinor'),90000);
 await base.collection('invoices').doc('foreign').update({currency:'AUD'});
 const plain=await getBasPreparationSummary(tenant,token,'2026-07-01');assert.ok(plain.success);assert.equal(plain.data.status,'ready');assert.ok(plain.data.g1TotalSalesMinor!==null);
 await base.collection('invoices').doc('foreign').update({currency:'NZD'});const foreignBas=await getBasPreparationSummary(tenant,token,'2026-07-01');assert.ok(foreignBas.success);assert.equal(foreignBas.data.status,'needs_review');assert.equal(foreignBas.data.g1TotalSalesMinor,null);assert.ok(foreignBas.data.reviewReasons.some(s=>s.includes('Foreign-currency invoices')));await base.collection('invoices').doc('foreign').update({currency:'AUD'});
 await base.collection('creditNotes').doc('draft').set({status:'draft'});const draft=await getBasPreparationSummary(tenant,token,'2026-07-01');assert.ok(draft.success);if(draft.success)assert.equal(draft.data.status,'ready');
 await base.collection('creditNotes').doc('draft').update({status:'issued'});assert.equal((await base.collection('invoiceCorrections').get()).size,0);
 const issued=await getBasPreparationSummary(tenant,token,'2026-07-01');assert.ok(issued.success);assert.equal(issued.data.status,'needs_review');assert.equal(issued.data.g1TotalSalesMinor,null);assert.equal(issued.data.oneAGstOnSalesMinor,null);assert.equal(issued.data.netGstMinor,null);assert.ok(issued.data.reviewReasons.some(s=>s.includes('Credit note adjustments')));assert.ok(!issued.data.reviewReasons.some(s=>s.includes('Cash-basis')));
 console.log(JSON.stringify({syntheticOnly:true,tenant,result:'passed',checks:['AUD receipt to foreign invoice rejected with unchanged invoice/receipt/audit','foreign account rejected with unchanged records','legacy missing currency remains AUD-compatible','authenticated non-cash BAS baseline ready and drafts ignored','issued general credit without legacy correction qualifies BAS and withholds G1/1A/net without invented attribution']}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
