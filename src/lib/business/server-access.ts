import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { authorizeBusinessAccess, type AccessRequest } from "./authorization";

/** Server-only adapter. Future MCP tools call this same verified-principal boundary. */
export async function requireBusinessAccess(request: AccessRequest) {
  return authorizeBusinessAccess(request, {
    verifyToken: (token) => adminAuth.verifyIdToken(token, true),
    readMembership: async (tenantId, userId) => {
      const membership = await adminDb.doc(`tenants/${tenantId}/users/${userId}`).get();
      return membership.exists ? membership.data()! : null;
    },
  });
}
