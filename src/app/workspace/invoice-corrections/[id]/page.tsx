import { redirect } from "next/navigation";
export default async function OldCreditDocument({params}:{params:Promise<{id:string}>}){const {id}=await params;redirect(`/workspace/invoices/credits/${id}`);}
