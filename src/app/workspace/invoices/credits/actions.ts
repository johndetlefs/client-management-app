"use server";
import { loadCreditWorkspace, saveCredit, issueCredit, disposeCredit } from "@/lib/credits/firestore";
import type { CreditInput, CreditRequest } from "@/lib/credits/types";
export async function getCredits(tenantId: string, token: string) { return loadCreditWorkspace(tenantId, token); }
export async function saveCreditNote(tenantId: string, token: string, input: CreditInput, revision: number) { return saveCredit(tenantId, token, input, revision); }
export async function issueCreditNote(tenantId: string, token: string, id: string, revision: number) { return issueCredit(tenantId, token, id, revision); }
export async function recordCreditAction(tenantId: string, token: string, id: string, request: CreditRequest) { return disposeCredit(tenantId, token, id, request); }
