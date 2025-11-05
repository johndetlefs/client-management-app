"use server";

import { adminDb } from "@/lib/firebase-admin";
import { TenantSettings } from "@/types/tenant";

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get tenant settings
 */
export async function getTenantSettings(
  tenantId: string
): Promise<ActionResult<TenantSettings | null>> {
  try {
    if (!tenantId) {
      return { success: false, error: "No tenant ID provided" };
    }

    const settingsDoc = await adminDb
      .collection("tenants")
      .doc(tenantId)
      .collection("settings")
      .doc("business")
      .get();

    if (!settingsDoc.exists) {
      return { success: true, data: null };
    }

    const data = settingsDoc.data();
    const settings: TenantSettings = {
      ...data,
      updatedAt: data?.updatedAt?.toDate(),
    } as TenantSettings;

    return { success: true, data: settings };
  } catch (error) {
    console.error("Error fetching tenant settings:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch settings",
    };
  }
}

/**
 * Update tenant settings
 */
export async function updateTenantSettings(
  tenantId: string,
  userId: string,
  settings: Partial<TenantSettings>
): Promise<ActionResult> {
  try {
    if (!tenantId) {
      return { success: false, error: "No tenant ID provided" };
    }

    if (!userId) {
      return { success: false, error: "No user ID provided" };
    }

    // Add metadata
    const updateData = {
      ...settings,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    await adminDb
      .collection("tenants")
      .doc(tenantId)
      .collection("settings")
      .doc("business")
      .set(updateData, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error updating tenant settings:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}
