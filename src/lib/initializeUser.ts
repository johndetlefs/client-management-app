"use server";

import { adminDb } from "@/lib/firebase-admin";

/**
 * Initialize a new user's profile and tenant after signup
 * Creates:
 * 1. User profile document at /users/{userId}
 * 2. New tenant document at /tenants/{tenantId}
 * 3. Tenant user document at /tenants/{tenantId}/users/{userId}
 */
export async function initializeNewUser(
  userId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate a new tenant ID (using the user ID ensures uniqueness for first user)
    const tenantId = `tenant_${userId}`;

    const now = new Date();

    // 1. Create user profile document
    await adminDb.collection("users").doc(userId).set({
      uid: userId,
      email,
      tenantId,
      createdAt: now,
    });

    // 2. Create tenant document
    await adminDb
      .collection("tenants")
      .doc(tenantId)
      .set({
        id: tenantId,
        name: email.split("@")[0] + "'s Business", // Default tenant name
        createdAt: now,
        createdBy: userId,
      });

    // 3. Create tenant user document (owner role)
    await adminDb
      .collection("tenants")
      .doc(tenantId)
      .collection("users")
      .doc(userId)
      .set({
        uid: userId,
        email,
        role: "owner",
        displayName: email.split("@")[0],
        joinedAt: now,
      });

    return { success: true };
  } catch (error) {
    console.error("Error initializing new user:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to initialize user profile",
    };
  }
}
