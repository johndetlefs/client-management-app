"use server";
import {loadCorrection} from "@/lib/invoice-corrections/firestore";
/** Read compatibility for existing related correction records. Generic credits have separate actions. */
export async function getCorrection(tenantId:string,idToken:string,id:string){return loadCorrection(tenantId,idToken,id);}
