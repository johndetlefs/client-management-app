import {adminDb} from "@/lib/firebase-admin";
import {publicCreditDocument} from "./documents";
import {publicStandaloneCredit} from "@/lib/credits/documents";
import type {CreditNote} from "@/lib/credits/types";
import type {InvoiceCorrection} from "./types";
/** Posted-only exact-token discovery; customer fields only, never source/audit payloads. */
export async function loadPublicCredit(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))throw Error("Credit note not found");
 const [credits,old]=await Promise.all([adminDb.collectionGroup("creditNotes").where("publicToken","==",token).limit(2).get(),adminDb.collectionGroup("invoiceCorrections").where("publicToken","==",token).limit(2).get()]);
 if(credits.size+old.size!==1)throw Error("Credit note not found");
 if(credits.size){const d=credits.docs[0];if(!/^tenants\/[^/]+\/creditNotes\/[^/]+$/.test(d.ref.path))throw Error("Credit note not found");return publicStandaloneCredit(d.data() as CreditNote);}
 const d=old.docs[0];if(!/^tenants\/[^/]+\/invoiceCorrections\/[^/]+$/.test(d.ref.path))throw Error("Credit note not found");return publicCreditDocument(d.data() as InvoiceCorrection);
}
