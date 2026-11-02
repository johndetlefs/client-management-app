import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { assertResourceId, BusinessError } from "./errors";

/** Idempotent account setup; existing profiles and roles are never reassigned. */
export async function initializeVerifiedAccount(userId: string, email: string, idToken: string) {
  if (!idToken) throw new BusinessError("AUTH_REQUIRED", "Authentication is required");
  let identity;
  try {
    identity = await adminAuth.verifyIdToken(idToken, true);
    assertResourceId(identity.uid, "userId");
  } catch {
    throw new BusinessError("AUTH_REQUIRED", "Authentication is invalid or expired");
  }
  if (userId !== identity.uid || !identity.email || email !== identity.email) {
    throw new BusinessError("ACCESS_DENIED", "Signup identity does not match authentication");
  }
    const tenantId = `tenant_${userId}`;
    const now = new Date();
    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.doc(`users/${userId}`);
      const tenantRef = adminDb.doc(`tenants/${tenantId}`);
      const membershipRef = adminDb.doc(`tenants/${tenantId}/users/${userId}`);
      const [profile, tenant, membership] = await Promise.all([
        transaction.get(userRef), transaction.get(tenantRef), transaction.get(membershipRef),
      ]);
      // Existing accounts may be staff/revoked or belong elsewhere. Never reassign them.
      if (profile.exists) return;
      if (tenant.exists || membership.exists) throw new BusinessError("ACCESS_DENIED", "Account setup requires support");
      transaction.create(userRef, { uid: userId, email, tenantId, createdAt: now });
      transaction.create(tenantRef, { id: tenantId, name: `${email.split("@")[0]}'s Business`, createdAt: now, createdBy: userId });
      transaction.create(membershipRef, { uid: userId, email, role: "owner", displayName: email.split("@")[0], joinedAt: now });
    });
}
