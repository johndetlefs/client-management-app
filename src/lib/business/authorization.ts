import { BusinessError, assertResourceId } from "./errors";

export const BUSINESS_CAPABILITIES = [
  "business.read", "business.prepare", "business.delete",
  "documents.issue", "documents.cancel", "documents.share",
  "payments.record", "email.send", "senders.manage",
] as const;
export type BusinessCapability = typeof BUSINESS_CAPABILITIES[number];
export type BusinessRole = "owner" | "staff";
export interface BusinessAccess {
  readonly tenantId: string;
  readonly userId: string;
  readonly role: BusinessRole;
  readonly capabilities: readonly BusinessCapability[];
}

export interface AccessRequest {
  tenantId: string;
  idToken: string;
  capability: BusinessCapability;
  claimedUserId?: string;
}

export interface AuthorizationDependencies {
  verifyToken: (token: string) => Promise<{ uid: string }>;
  readMembership: (tenantId: string, userId: string) => Promise<{
    role?: unknown; capabilities?: unknown; disabled?: unknown;
  } | null>;
}

const STAFF_DEFAULTS: readonly BusinessCapability[] = ["business.read", "business.prepare"];
const verifiedAccess = new WeakSet<BusinessAccess>();

export function assertVerifiedBusinessAccess(access: BusinessAccess): void {
  if (!verifiedAccess.has(access)) throw new BusinessError("ACCESS_DENIED", "Verified business access is required");
}

/** Identity is verified before any business record is read. Membership is re-read each call. */
export async function authorizeBusinessAccess(
  request: AccessRequest,
  dependencies: AuthorizationDependencies,
): Promise<BusinessAccess> {
  assertResourceId(request.tenantId, "tenantId");
  if (typeof request.idToken !== "string" || !request.idToken) {
    throw new BusinessError("AUTH_REQUIRED", "Authentication is required");
  }
  let userId: string;
  try {
    const identity = await dependencies.verifyToken(request.idToken);
    assertResourceId(identity.uid, "userId");
    userId = identity.uid;
  } catch {
    throw new BusinessError("AUTH_REQUIRED", "Authentication is invalid or expired");
  }
  if (request.claimedUserId !== undefined && request.claimedUserId !== userId) {
    throw new BusinessError("ACCESS_DENIED", "Business access denied");
  }
  const membership = await dependencies.readMembership(request.tenantId, userId);
  if (!membership || membership.disabled === true ||
      (membership.role !== "owner" && membership.role !== "staff")) {
    throw new BusinessError("ACCESS_DENIED", "Business access denied");
  }
  // Cancellation, financial corrections and sender administration stay owner-only.
  const delegatable: readonly BusinessCapability[] = ["documents.issue", "documents.share", "email.send"];
  const storedGrants = membership.capabilities;
  const grants = Array.isArray(storedGrants)
    ? delegatable.filter((grant) => storedGrants.includes(grant))
    : [];
  const capabilities = membership.role === "owner"
    ? [...BUSINESS_CAPABILITIES]
    : [...STAFF_DEFAULTS, ...grants];
  if (!capabilities.includes(request.capability)) {
    throw new BusinessError("ACCESS_DENIED", "This action requires a business permission");
  }
  const access = Object.freeze({
    tenantId: request.tenantId, userId, role: membership.role,
    capabilities: Object.freeze(capabilities),
  });
  verifiedAccess.add(access);
  return access;
}
