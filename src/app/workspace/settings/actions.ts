"use server";

import { FieldValue } from "firebase-admin/firestore";

import { normalizeGstRegistration } from "@/lib/expenses/calculations";
import { assertExpenseTenantAccess } from "@/lib/expenses/firestore";
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
  tenantId: string,
  idToken: string,
): Promise<ActionResult<TenantSettings | null>> {
  try {
    await assertExpenseTenantAccess(tenantId, idToken);

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
  idToken: string,
  settings: Partial<TenantSettings>,
): Promise<ActionResult> {
  try {
    const { userId, role } = await assertExpenseTenantAccess(tenantId, idToken);
    if (role !== "owner") {
      return { success: false, error: "Only owners can update business settings" };
    }

    const { updatedAt: _updatedAt, updatedBy: _updatedBy, ...safeSettings } =
      settings;
    void _updatedAt;
    void _updatedBy;

    if (safeSettings.tax?.gstRegistration) {
      safeSettings.tax = {
        ...safeSettings.tax,
        gstRegistration: normalizeGstRegistration(
          safeSettings.tax.gstRegistration,
        ),
      };
    }

    const updateData = {
      ...safeSettings,
      updatedAt: FieldValue.serverTimestamp(),
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
