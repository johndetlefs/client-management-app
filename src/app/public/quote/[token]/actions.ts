"use server";

import { adminDb } from "@/lib/firebase-admin";
import { Quote } from "@/types/quote";
import { FieldValue } from "firebase-admin/firestore";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function timestampToDate(timestamp: unknown): Date | undefined {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === "object" && "toDate" in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  return undefined;
}

export async function getQuoteByToken(
  token: string,
): Promise<ActionResult<Quote>> {
  try {
    const quotesRef = adminDb.collectionGroup("quotes");
    const querySnap = await quotesRef
      .where("publicToken", "==", token)
      .limit(1)
      .get();

    if (querySnap.empty) {
      return { success: false, error: "Quote not found" };
    }

    const quoteDoc = querySnap.docs[0];
    const quoteData = quoteDoc.data();

    const quote: Quote = {
      id: quoteDoc.id,
      tenantId: quoteData.tenantId,
      clientId: quoteData.clientId,
      jobId: quoteData.jobId,
      quoteNumber: quoteData.quoteNumber,
      quoteDisplayNumber: quoteData.quoteDisplayNumber,
      status: quoteData.status,
      lines: quoteData.lines || [],
      selectedJobItemIds: quoteData.selectedJobItemIds || [],
      subtotalMinor: quoteData.subtotalMinor || 0,
      taxMinor: quoteData.taxMinor || 0,
      clientName: quoteData.clientName,
      jobTitle: quoteData.jobTitle,
      notes: quoteData.notes,
      totalMinor: quoteData.totalMinor || 0,
      acceptedAt: timestampToDate(quoteData.acceptedAt),
      viewedAt: timestampToDate(quoteData.viewedAt),
      publicToken: quoteData.publicToken,
      createdAt: timestampToDate(quoteData.createdAt) || new Date(),
      updatedAt: timestampToDate(quoteData.updatedAt) || new Date(),
    };

    if (!quote.viewedAt) {
      await quoteDoc.ref.update({
        viewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      quote.viewedAt = new Date();
    }

    return { success: true, data: quote };
  } catch (error) {
    console.error("Error fetching quote by token:", error);

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
      error: error instanceof Error ? error.message : "Failed to fetch quote",
    };
  }
}

export async function getTenantSettingsForPublicQuote(
  tenantId: string,
): Promise<
  ActionResult<{
    businessName?: string;
    abn?: string;
    address?: string;
    phone?: string;
    email?: string;
    taxLabel?: string;
    logoUrl?: string;
    quoteTerms?: string;
    quoteFooter?: string;
  }>
> {
  try {
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
        quoteTerms: data?.quoteTerms || data?.invoiceTerms,
        quoteFooter: data?.quoteFooter || data?.invoiceFooter,
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
