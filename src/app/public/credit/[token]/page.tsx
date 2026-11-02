import { notFound } from "next/navigation";
import { loadPublicCredit } from "@/lib/invoice-corrections/public-firestore";
import { PublicCreditView } from "./view";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function PublicCreditPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 let data;
 try{data=await loadPublicCredit(token);}catch{notFound();}
 return <PublicCreditView {...data}/>;
}
