import { adminDb } from "@/lib/firebase-admin";
import { BusinessError, assertResourceId } from "./errors";
import { FieldValue } from "firebase-admin/firestore";

export function assertRecipientToken(token: unknown): asserts token is string {
  if (typeof token !== "string" || !token || token.length > 512) {
    throw new BusinessError("ACCESS_DENIED", "Document access denied");
  }
}

export function recipientStatusAllowed(status: unknown, kind: "invoices" | "quotes"): boolean {
  return (kind === "invoices"
    ? ["sent", "viewed", "partially_paid", "paid", "overdue", "void"]
    : ["sent", "accepted", "cancelled"]).includes(status as string);
}

/** Narrow token exception for recipient branding; not arbitrary tenant settings access. */
export async function assertRecipientDocumentAccess(tenantId: string, token: string, kind: "invoices" | "quotes") {
  assertResourceId(tenantId, "tenantId");
  assertRecipientToken(token);
  const documents = await adminDb.collection(`tenants/${tenantId}/${kind}`)
    .where("publicToken", "==", token).limit(1).get();
  if (documents.empty || !recipientStatusAllowed(documents.docs[0].get("status"), kind)) {
    throw new BusinessError("ACCESS_DENIED", "Document access denied");
  }
}

export async function recordRecipientView(token: string, kind: "invoices" | "quotes"): Promise<void> {
  assertRecipientToken(token);
  const matches = await adminDb.collectionGroup(kind).where("publicToken", "==", token).limit(1).get();
  if (matches.empty) throw new BusinessError("ACCESS_DENIED", "Document access denied");
  const ref = matches.docs[0].ref;
  await adminDb.runTransaction(async (transaction) => {
    const document = await transaction.get(ref);
    if (!document.exists || document.get("publicToken") !== token || !recipientStatusAllowed(document.get("status"), kind)) throw new BusinessError("ACCESS_DENIED", "Document access denied");
    if (!document.get("viewedAt")) transaction.update(ref, { viewedAt: FieldValue.serverTimestamp() });
  });
}
