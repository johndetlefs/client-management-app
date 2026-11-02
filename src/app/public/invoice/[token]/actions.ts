"use server";

import { assertRecipientDocumentAccess, assertRecipientToken, recipientStatusAllowed, recordRecipientView } from "@/lib/business/public-access";

import { adminDb } from "@/lib/firebase-admin";
import type { RecipientInvoice } from "@/types/recipient-document";
import { recipientLines } from "@/lib/business/recipient-projection";

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
 * Retrieval is read-only; the recipient page records an explicit view separately.
 */
export async function getInvoiceByToken(
  token: string
): Promise<ActionResult<RecipientInvoice>> {
  try {
    assertRecipientToken(token);
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
    if (!recipientStatusAllowed(invoiceData.status, "invoices")) return { success: false, error: "Document not available" };
    if (invoiceData.creditedBy) return { success: false, error: "This invoice has been credited and replaced. Please refer to the replacement invoice supplied by the business." };

    // Normalize legacy "viewed" status to "sent" for backwards compatibility
    const normalizedStatus =
      invoiceData.status === "viewed" ? "sent" : invoiceData.status;

    // Convert Firestore Timestamps to Dates for serialization
    const invoice: RecipientInvoice = {
      id: invoiceDoc.id,
      tenantId: invoiceData.tenantId,
      invoiceNumber: invoiceData.invoiceNumber,
      invoiceDisplayNumber: invoiceData.invoiceDisplayNumber,
      status: normalizedStatus,
      issueDate: timestampToDate(invoiceData.issueDate),
      dueDate: timestampToDate(invoiceData.dueDate),
      viewedAt: timestampToDate(invoiceData.viewedAt),
      lines: recipientLines(invoiceData.lines),
      subtotalMinor: invoiceData.subtotalMinor || 0,
      taxMinor: invoiceData.taxMinor || 0,
      totalMinor: invoiceData.totalMinor || 0,
      taxBreakdown: invoiceData.taxBreakdown || [],
      amountPaidMinor: invoiceData.amountPaidMinor || 0,
      creditAppliedMinor: invoiceData.creditAppliedMinor || 0,
      balanceDueMinor: invoiceData.balanceDueMinor || 0,
      clientName: invoiceData.clientName,
      clientEmail: invoiceData.clientEmail,
      clientAbn: invoiceData.clientAbn,
      clientAddress: invoiceData.clientAddress,
      notes: invoiceData.notes,
      paymentInstructions: invoiceData.paymentInstructions,
      createdAt: timestampToDate(invoiceData.createdAt) || new Date(),
      updatedAt: timestampToDate(invoiceData.updatedAt) || new Date(),
    };

    return { success: true, data: invoice };
  } catch (error) {
    console.error("Error fetching invoice by token:", error);

    // Check if it's an index error
    if (
      error instanceof Error &&
      (error.message.includes("index") ||
        error.message.includes("FAILED_PRECONDITION"))
    ) {
      return {
        success: false,
        error:
          "Database index required. Please deploy Firestore indexes using 'npm run deploy:indexes' or contact support.",
      };
    }

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
  tenantId: string,
  token: string
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
    await assertRecipientDocumentAccess(tenantId, token, "invoices");
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

export async function recordInvoiceView(token: string): Promise<ActionResult> {
  try {
    await recordRecipientView(token, "invoices");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Document access denied" };
  }
}
