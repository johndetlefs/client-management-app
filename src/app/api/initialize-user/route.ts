import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs"; // Required for Firestore

/**
 * API route to initialize a new user's profile and tenant after signup
 * Called immediately after Firebase Auth account creation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      console.error("Initialize user failed: Missing userId or email");
      return NextResponse.json(
        { error: "Missing userId or email" },
        { status: 400 }
      );
    }

    console.log(`Initializing user ${userId} with email ${email}`);

    // Generate a new tenant ID (using the user ID ensures uniqueness for first user)
    const tenantId = `tenant_${userId}`;
    const now = new Date();

    // Use a batch write to ensure all documents are created together
    const batch = adminDb.batch();

    // 1. Create user profile document
    const userRef = adminDb.collection("users").doc(userId);
    batch.set(userRef, {
      uid: userId,
      email,
      tenantId,
      createdAt: now,
    });

    // 2. Create tenant document
    const tenantRef = adminDb.collection("tenants").doc(tenantId);
    batch.set(tenantRef, {
      id: tenantId,
      name: email.split("@")[0] + "'s Business", // Default tenant name
      createdAt: now,
      createdBy: userId,
    });

    // 3. Create tenant user document (owner role)
    const tenantUserRef = adminDb
      .collection("tenants")
      .doc(tenantId)
      .collection("users")
      .doc(userId);
    batch.set(tenantUserRef, {
      uid: userId,
      email,
      role: "owner",
      displayName: email.split("@")[0],
      joinedAt: now,
    });

    // Commit all writes together
    await batch.commit();

    console.log(
      `Successfully initialized user ${userId} with tenant ${tenantId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error initializing new user:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize user profile",
      },
      { status: 500 }
    );
  }
}
