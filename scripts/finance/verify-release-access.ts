/** Disposable release integration proof; no live project or customer data. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {syntheticPassword} from './synthetic-auth';
import {adminDb,adminAuth} from '../../src/lib/firebase-admin';
import {getClients,createClient} from '../../src/app/workspace/clients/actions';
import {createJob} from '../../src/app/workspace/jobs/actions';
import {createJobItem} from '../../src/app/workspace/jobs/itemActions';
import {createDraftInvoice,issueInvoice,voidInvoice} from '../../src/app/workspace/invoices/actions';
import {getQuoteForEdit} from '../../src/app/workspace/quotes/actions';
import {getInvoiceForPrint} from '../../src/app/workspace/invoices/[id]/print/actions';
import {getInvoiceByToken} from '../../src/app/public/invoice/[token]/actions';
import {getQuoteByToken} from '../../src/app/public/quote/[token]/actions';
async function main(){
 const password=syntheticPassword();if(process.env.FIREBASE_FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Disposable emulator only');
 const tenant=`credit-release-access-${Date.now()}`, other=`${tenant}-other`;
 async function identity(role:'owner'|'staff',business=tenant){const uid=randomUUID(),email=`${uid}@example.test`;await adminAuth.createUser({uid,email,password});await adminDb.doc(`users/${uid}`).set({tenantId:business,uid,email});await adminDb.doc(`tenants/${business}/users/${uid}`).set({role});const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});const d=await r.json();assert.ok(d.idToken);return {uid,token:d.idToken as string};}
 const owner=await identity('owner'),staff=await identity('staff'),outsider=await identity('owner',other);
 const code=(v:unknown)=>(v as {code?:string}).code;
 assert.equal(code(await getClients(tenant,'')),'AUTH_REQUIRED');assert.equal(code(await getClients(tenant,'forged')),'AUTH_REQUIRED');assert.equal(code(await getClients(tenant,outsider.token)),'ACCESS_DENIED');assert.equal((await getClients(tenant,staff.token)).success,true);
 assert.equal(code(await createClient(tenant,owner.uid,{name:'Forged actor',isActive:true},staff.token)),'ACCESS_DENIED');
 assert.equal(code(await issueInvoice(tenant,'missing',staff.uid,staff.token)),'ACCESS_DENIED');assert.equal(code(await voidInvoice(tenant,'missing','owner',staff.token)),'ACCESS_DENIED');
 const client=await createClient(tenant,owner.uid,{name:'Synthetic release client',isActive:true},owner.token);assert.ok(client.success);if(!client.success)return;
 const job=await createJob(tenant,owner.uid,{clientId:client.data,title:'Synthetic services',status:'active'},owner.token);assert.ok(job.success);if(!job.success)return;
 const item=await createJobItem(tenant,owner.uid,{clientId:client.data,jobId:job.data,title:'Development',quantity:1,unit:'unit',unitPriceMinor:100000,gstApplicable:false,status:'open'},owner.token);assert.ok(item.success);
 const invoice=await createDraftInvoice(tenant,owner.uid,{clientId:client.data},owner.token);assert.ok(invoice.success);
 assert.equal(code(await getInvoiceForPrint(tenant,'missing',outsider.token)),'ACCESS_DENIED');assert.equal(code(await getQuoteForEdit(tenant,owner.uid,'missing',outsider.token)),'ACCESS_DENIED');
 await adminDb.doc(`tenants/${tenant}/creditNotes/note`).set({status:'draft'});
 async function rest(path:string,token:string,method='GET'){return fetch(`http://127.0.0.1:8080/v1/projects/demo-cma-finance/databases/(default)/documents/${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(method==='PATCH'?{body:JSON.stringify({fields:{name:{stringValue:'forbidden'}}})}:{})});}
 assert.equal((await rest(`tenants/${tenant}/clients/${client.data}`,owner.token)).status,200);
 assert.equal((await rest(`tenants/${tenant}/clients/${client.data}`,outsider.token)).status,403);
 assert.equal((await rest(`tenants/${tenant}/clients/${client.data}`,owner.token,'PATCH')).status,403);
 assert.equal((await rest(`tenants/${tenant}/creditNotes/note`,owner.token)).status,200);
 assert.equal((await rest(`tenants/${tenant}/creditNotes/note`,staff.token)).status,403);
 assert.equal((await rest(`tenants/${tenant}/creditNotes/note`,owner.token,'PATCH')).status,403);
 assert.equal((await rest(`users/${owner.uid}`,owner.token,'PATCH')).status,403);
 await adminDb.doc(`tenants/${tenant}/users/${owner.uid}`).update({disabled:true});assert.equal(code(await getClients(tenant,owner.token)),'ACCESS_DENIED');assert.equal((await rest(`tenants/${tenant}/creditNotes/note`,owner.token)).status,403);
 await adminDb.doc(`tenants/${tenant}/users/${owner.uid}`).update({disabled:false});
 const line={title:'Development',quantity:1,unit:'unit',unitPriceMinor:100000,subtotalMinor:100000,taxMinor:0,totalMinor:100000,jobId:'private',jobItemId:'private',internal:'private'};
 for(const [collection,status,publicToken] of [['invoices','sent',`release-invoice-${tenant}`],['quotes','sent',`release-quote-${tenant}`]] as const){const ref=adminDb.doc(`tenants/${tenant}/${collection}/public`);await ref.set({tenantId:tenant,clientId:client.data,createdBy:owner.uid,status,publicToken,lines:[line],totalMinor:100000,amountPaidMinor:0,creditAppliedMinor:20000,balanceDueMinor:80000});const before=await ref.get();const result=collection==='invoices'?await getInvoiceByToken(publicToken):await getQuoteByToken(publicToken);assert.ok(result.success);if(result.success){const data=JSON.stringify(result.data);assert.ok(!data.includes('private'));assert.ok(!data.includes(owner.uid));if(collection==='invoices')assert.equal((result.data as {creditAppliedMinor:number}).creditAppliedMinor,20000);}assert.ok((await ref.get()).updateTime!.isEqual(before.updateTime!));await ref.update({status:'draft'});assert.equal((collection==='invoices'?await getInvoiceByToken(publicToken):await getQuoteByToken(publicToken)).success,false);}
 console.log(JSON.stringify({result:'passed',syntheticOnly:true,tenant,checks:['verified actor and tenant reads','normal authenticated client/job/item/invoice preparation','owner-only financial actions','disabled membership rejection','current strict Firestore reads/writes','public invoice/quote allowlist and pure reads','draft recipient denial']}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
