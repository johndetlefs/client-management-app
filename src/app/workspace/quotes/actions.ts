"use server";

import { adminDb } from "@/lib/firebase-admin";
import { formatInvoiceNumber } from "@/lib/invoice-utils";
import { FieldValue } from "firebase-admin/firestore";
import { JobItem } from "@/types/jobItem";
import { Job } from "@/types/job";
import { Client } from "@/types/client";
import { CreateQuoteFromJobData, QuoteCounter, QuoteLine } from "@/types/quote";
import { TenantSettings } from "@/types/tenant";

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

function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry));
  }

  if (value instanceof Date) {
    return value;
  }

  if (value !== null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    const isPlainObject = prototype === Object.prototype || prototype === null;

    if (!isPlainObject) {
      return value;
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        sanitized[key] = stripUndefinedDeep(entry);
      }
    }

    return sanitized;
  }

  return value;
}

function createQuoteLineFromJobItem(
  item: JobItem,
  jobTitle: string,
  taxRate: number,
): QuoteLine {
  const subtotalMinor = Math.round(item.quantity * item.unitPriceMinor);
  const gstApplicable = item.gstApplicable ?? true;
  const taxMinor = gstApplicable ? Math.round(subtotalMinor * taxRate) : 0;

  const line: QuoteLine = {
    jobItemId: item.id,
    jobId: item.jobId,
    jobTitle,
    title: item.title,
    unit: item.unit,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
    gstApplicable,
    subtotalMinor,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
  };

  if (item.description && item.description.trim() !== "") {
    line.description = item.description;
  }

  return line;
}

function computeQuoteTotals(lines: QuoteLine[]): {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
} {
  return lines.reduce(
    (accumulator, line) => ({
      subtotalMinor: accumulator.subtotalMinor + line.subtotalMinor,
      taxMinor: accumulator.taxMinor + line.taxMinor,
      totalMinor: accumulator.totalMinor + line.totalMinor,
    }),
    {
      subtotalMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
    },
  );
}

async function getNextQuoteNumber(
  tenantId: string,
  year: number,
  transaction: FirebaseFirestore.Transaction,
): Promise<number> {
  const counterRef = adminDb
    .collection(`tenants/${tenantId}/counters`)
    .doc(`quotes-${year}`);
  const counterSnap = await transaction.get(counterRef);

  if (counterSnap.exists) {
    const counter = counterSnap.data() as QuoteCounter;
    const nextNumber = counter.lastNumber + 1;

    transaction.update(counterRef, {
      lastNumber: nextNumber,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return nextNumber;
  }

  const firstNumber = 1;
  transaction.set(counterRef, {
    year,
    lastNumber: firstNumber,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return firstNumber;
}

async function ensureUserCanManageQuotes(
  tenantId: string,
  userId: string,
): Promise<ActionResult<void>> {
  const userDoc = await adminDb
    .doc(`tenants/${tenantId}/users/${userId}`)
    .get();

  if (!userDoc.exists) {
    return { success: false, error: "User is not assigned to this tenant" };
  }

  const role = userDoc.data()?.role;
  if (role !== "owner" && role !== "staff") {
    return {
      success: false,
      error: "You do not have permission to manage quotes",
    };
  }

  return { success: true, data: undefined };
}

export async function getOpenJobItemsForQuote(
  tenantId: string,
  userId: string,
  jobId: string,
): Promise<ActionResult<JobItem[]>> {
  try {
    const permission = await ensureUserCanManageQuotes(tenantId, userId);
    if (!permission.success) {
      return permission;
    }

    const jobDoc = await adminDb.doc(`tenants/${tenantId}/jobs/${jobId}`).get();
    if (!jobDoc.exists) {
      return { success: false, error: "Job not found" };
    }

    const itemsSnap = await adminDb
      .collection(`tenants/${tenantId}/jobItems`)
      .where("jobId", "==", jobId)
      .where("status", "==", "open")
      .orderBy("createdAt", "desc")
      .get();

    const items = itemsSnap.docs.map((doc) => {
      const data = doc.data() as JobItem;
      const item: JobItem = {
        id: doc.id,
        tenantId: data.tenantId,
        jobId: data.jobId,
        clientId: data.clientId,
        title: data.title,
        unit: data.unit,
        quantity: data.quantity,
        unitPriceMinor: data.unitPriceMinor,
        gstApplicable: data.gstApplicable,
        status: data.status,
        createdBy: data.createdBy,
        createdAt: timestampToDate(data.createdAt) || new Date(),
        updatedAt: timestampToDate(data.updatedAt) || new Date(),
      };

      if (data.description && data.description.trim() !== "") {
        item.description = data.description;
      }

      return item;
    });

    return { success: true, data: items };
  } catch (error) {
    console.error("Error fetching open job items for quote:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch job items for quote",
    };
  }
}

export async function createQuoteFromJob(
  tenantId: string,
  userId: string,
  data: CreateQuoteFromJobData,
): Promise<ActionResult<{ quoteId: string; quoteNumber: string }>> {
  try {
    const permission = await ensureUserCanManageQuotes(tenantId, userId);
    if (!permission.success) {
      return permission;
    }

    if (!data.jobId) {
      return { success: false, error: "Job is required" };
    }

    if (data.jobItemIds.length === 0) {
      return { success: false, error: "Select at least one job item" };
    }

    const uniqueItemIds = Array.from(
      new Set(data.jobItemIds.filter((itemId) => itemId.trim() !== "")),
    );
    if (uniqueItemIds.length === 0) {
      return { success: false, error: "Select at least one valid job item" };
    }

    const quoteRef = adminDb.collection(`tenants/${tenantId}/quotes`).doc();

    await adminDb.runTransaction(async (transaction) => {
      const jobRef = adminDb.doc(`tenants/${tenantId}/jobs/${data.jobId}`);
      const jobSnap = await transaction.get(jobRef);

      if (!jobSnap.exists) {
        throw new Error("Job not found");
      }

      const job = { id: jobSnap.id, ...jobSnap.data() } as Job;

      const clientRef = adminDb.doc(
        `tenants/${tenantId}/clients/${job.clientId}`,
      );
      const clientSnap = await transaction.get(clientRef);

      if (!clientSnap.exists) {
        throw new Error("Client not found");
      }

      const client = { id: clientSnap.id, ...clientSnap.data() } as Client;

      const settingsRef = adminDb.doc(`tenants/${tenantId}`);
      const settingsSnap = await transaction.get(settingsRef);
      const settings = settingsSnap.exists
        ? (settingsSnap.data() as TenantSettings)
        : null;
      const taxRate = settings?.tax?.defaultRate || 0;

      const itemRefs = uniqueItemIds.map((itemId) =>
        adminDb.doc(`tenants/${tenantId}/jobItems/${itemId}`),
      );
      const itemSnaps = await Promise.all(
        itemRefs.map((itemRef) => transaction.get(itemRef)),
      );

      const selectedItems: JobItem[] = [];
      for (const itemSnap of itemSnaps) {
        if (!itemSnap.exists) {
          throw new Error(`Job item ${itemSnap.id} not found`);
        }

        const item = { id: itemSnap.id, ...itemSnap.data() } as JobItem;

        if (item.jobId !== data.jobId) {
          throw new Error(`Job item \"${item.title}\" is not part of this job`);
        }

        if (item.clientId !== job.clientId) {
          throw new Error(
            `Job item \"${item.title}\" does not match job client`,
          );
        }

        if (item.status !== "open") {
          throw new Error(`Job item \"${item.title}\" is not open for quoting`);
        }

        selectedItems.push(item);
      }

      const quoteLines = selectedItems.map((item) =>
        createQuoteLineFromJobItem(item, job.title, taxRate),
      );
      const totals = computeQuoteTotals(quoteLines);

      const now = new Date();
      const year = now.getFullYear();
      const nextQuoteNumber = await getNextQuoteNumber(
        tenantId,
        year,
        transaction,
      );
      const quoteNumber = formatInvoiceNumber(year, nextQuoteNumber);

      const quotePayload: Record<string, unknown> = {
        tenantId,
        clientId: client.id,
        jobId: job.id,
        quoteNumber,
        quoteDisplayNumber: quoteNumber,
        status: "draft",
        lines: quoteLines,
        selectedJobItemIds: uniqueItemIds,
        subtotalMinor: totals.subtotalMinor,
        taxMinor: totals.taxMinor,
        totalMinor: totals.totalMinor,
        clientName: client.name,
        jobTitle: job.title,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      transaction.set(
        quoteRef,
        stripUndefinedDeep({
          ...quotePayload,
          createdBy: userId,
        }) as FirebaseFirestore.DocumentData,
      );
    });

    const quoteSnap = await quoteRef.get();
    const quoteNumber =
      (quoteSnap.data()?.quoteNumber as string | undefined) || "";

    return {
      success: true,
      data: {
        quoteId: quoteRef.id,
        quoteNumber,
      },
    };
  } catch (error) {
    console.error("Error creating quote from job:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create quote from job",
    };
  }
}
