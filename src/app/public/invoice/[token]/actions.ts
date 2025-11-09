"use server";

import { adminDb } from "@/lib/firebase-admin";
import { Invoice } from "@/types/invoice";
import { FieldValue } from "firebase-admin/firestore";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Helper to convert admin Timestamp to Date
function timestampToDate(timestamp: unknown): Date | undefined {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "object" && "toDate" in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  return undefined;
}

/**
 * Get invoice by public token (no authentication required)
 * Also marks the invoice as viewed if it hasn't been viewed yet
 */
export async function getInvoiceByToken(
  token: string
): Promise<ActionResult<Invoice>> {
  try {
    // Query all invoices by public token using collection group
    const invoicesRef = adminDb.collectionGroup("invoices");
    const querySnap = await invoicesRef
      .where("publicToken", "==", token)
      .limit(1)
      .get();

    if (querySnap.empty) {
      return { success: false, error: "Invoice not found" };
    }

    const invoiceDoc = querySnap.docs[0];
    const invoiceData = invoiceDoc.data();

    // Convert Firestore Timestamps to Dates for serialization
    const invoice: Invoice = {
      id: invoiceDoc.id,
      tenantId: invoiceData.tenantId,
      clientId: invoiceData.clientId,
      invoiceNumber: invoiceData.invoiceNumber,
      invoiceDisplayNumber: invoiceData.invoiceDisplayNumber,
      status: invoiceData.status,
      issueDate: timestampToDate(invoiceData.issueDate),
      dueDate: timestampToDate(invoiceData.dueDate),
      viewedAt: timestampToDate(invoiceData.viewedAt),
      lines: invoiceData.lines || [],
      lockedJobItemIds: invoiceData.lockedJobItemIds || [],
      subtotalMinor: invoiceData.subtotalMinor || 0,
      taxMinor: invoiceData.taxMinor || 0,
      totalMinor: invoiceData.totalMinor || 0,
      taxBreakdown: invoiceData.taxBreakdown || [],
      amountPaidMinor: invoiceData.amountPaidMinor || 0,
      balanceDueMinor: invoiceData.balanceDueMinor || 0,
      clientName: invoiceData.clientName,
      clientEmail: invoiceData.clientEmail,
      clientAbn: invoiceData.clientAbn,
      clientAddress: invoiceData.clientAddress,
      publicToken: invoiceData.publicToken,
      notes: invoiceData.notes,
      paymentInstructions: invoiceData.paymentInstructions,
      createdAt: timestampToDate(invoiceData.createdAt) || new Date(),
      updatedAt: timestampToDate(invoiceData.updatedAt) || new Date(),
      createdBy: invoiceData.createdBy,
      issuedBy: invoiceData.issuedBy,
    };

    // Mark as viewed if status is 'sent' and not already viewed
    if (invoice.status === "sent" && !invoice.viewedAt) {
      await invoiceDoc.ref.update({
        status: "viewed",
        viewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update the returned invoice object
      invoice.status = "viewed";
      invoice.viewedAt = new Date();
    }

    return { success: true, data: invoice };
  } catch (error) {
    console.error("Error fetching invoice by token:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch invoice",
    };
  }
}

/**
 * Get tenant settings for displaying invoice branding
 * (read-only, no authentication required for public invoices)
 */
export async function getTenantSettingsForPublicInvoice(
  tenantId: string
): Promise<
  ActionResult<{
    businessName?: string;
    abn?: string;
    address?: string;
    phone?: string;
    email?: string;
    taxLabel?: string;
    logoUrl?: string;
    bankAccount?: {
      accountName?: string;
      bsb?: string;
      accountNumber?: string;
    };
    invoiceTerms?: string;
    invoiceFooter?: string;
  }>
> {
  try {
    // Settings are stored in a subcollection: tenants/{tenantId}/settings/business
    const businessRef = adminDb.doc(`tenants/${tenantId}/settings/business`);
    const businessSnap = await businessRef.get();

    if (!businessSnap.exists) {
      return { success: false, error: "Company information not found" };
    }

    const data = businessSnap.data();

    return {
      success: true,
      data: {
        businessName: data?.businessName,
        abn: data?.abn,
        address: data?.address,
        phone: data?.phone,
        email: data?.email,
        taxLabel: data?.tax?.taxType,
        logoUrl: data?.logoUrl,
        bankAccount: data?.bankAccount,
        invoiceTerms: data?.invoiceTerms,
        invoiceFooter: data?.invoiceFooter,
      },
    };
  } catch (error) {
    console.error("Error fetching tenant settings:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch company information",
    };
  }
}
