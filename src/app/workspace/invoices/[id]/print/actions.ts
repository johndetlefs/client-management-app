"use server";

import { requireBusinessAccess } from "@/lib/business/server-access";
import { BusinessError, businessActionFailure, assertResourceId } from "@/lib/business/errors";

import { adminDb } from "@/lib/firebase-admin";
import { Invoice } from "@/types/invoice";
import { TenantSettings } from "@/types/tenant";

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Get invoice data for print/preview
 */
export async function getInvoiceForPrint(
  tenantId: string,
  invoiceId: string,
  idToken: string
): Promise<
  ActionResult<{ invoice: Invoice; settings: TenantSettings | null }>
> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.read" });
    assertResourceId(invoiceId, "invoiceId");

    if (!tenantId || !invoiceId) {
      return { success: false, error: "Missing tenant ID or invoice ID" };
    }

    // Get invoice
    const invoiceDoc = await adminDb
      .collection("tenants")
      .doc(tenantId)
      .collection("invoices")
      .doc(invoiceId)
      .get();

    if (!invoiceDoc.exists) {
      return { success: false, error: "Invoice not found" };
    }

    const invoiceData = invoiceDoc.data();
    if (invoiceData?.creditedBy) return { success: false, error: "Original credited and replaced. Use the correction record to review retained documents; do not demand payment against this original." };
    const invoice: Invoice = {
      id: invoiceDoc.id,
      ...invoiceData,
      // Normalize legacy "viewed" status to "sent" for backwards compatibility
      status: invoiceData?.status === "viewed" ? "sent" : invoiceData?.status,
      issueDate: invoiceData?.issueDate?.toDate(),
      dueDate: invoiceData?.dueDate?.toDate(),
      viewedAt: invoiceData?.viewedAt?.toDate(),
      createdAt: invoiceData?.createdAt?.toDate(),
      updatedAt: invoiceData?.updatedAt?.toDate(),
    } as Invoice;

    // Get tenant settings
    const settingsDoc = await adminDb
      .collection("tenants")
      .doc(tenantId)
      .collection("settings")
      .doc("business")
      .get();

    let settings: TenantSettings | null = null;
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      settings = {
        ...data,
        updatedAt: data?.updatedAt?.toDate(),
      } as TenantSettings;
    }

    return { success: true, data: { invoice, settings } };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
    console.error("Error fetching invoice for print:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch invoice",
    };
  }
}
