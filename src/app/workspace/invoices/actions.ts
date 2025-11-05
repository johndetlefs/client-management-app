"use server";

import { adminDb } from "@/lib/firebase-admin";
import { Invoice, InvoiceFormData, InvoiceCounter } from "@/types/invoice";
import { JobItem, ItemStatus } from "@/types/jobItem";
import { Client } from "@/types/client";
import { Job } from "@/types/job";
import {
  generatePublicToken,
  createInvoiceLineFromJobItem,
  computeInvoiceTotals,
  computeBalanceDue,
  determineInvoiceStatus,
  formatInvoiceNumber,
} from "@/lib/invoice-utils";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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
 * Create a draft invoice for a client
 */
export async function createDraftInvoice(
  tenantId: string,
  userId: string,
  data: InvoiceFormData
): Promise<ActionResult<string>> {
  try {
    // Fetch client data
    const clientRef = adminDb
      .collection(`tenants/${tenantId}/clients`)
      .doc(data.clientId);
    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      return { success: false, error: "Client not found" };
    }

    const client = { id: clientSnap.id, ...clientSnap.data() } as Client;

    // Create draft invoice
    const invoiceRef = adminDb.collection(`tenants/${tenantId}/invoices`).doc();
    const now = Timestamp.now();

    const invoiceData: Record<string, unknown> = {
      tenantId,
      clientId: data.clientId,
      status: "draft",
      lines: [],
      lockedJobItemIds: [],
      subtotalMinor: 0,
      taxMinor: 0,
      totalMinor: 0,
      taxBreakdown: [],
      amountPaidMinor: 0,
      balanceDueMinor: 0,
      clientName: client.name,
      publicToken: generatePublicToken(),
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    // Only add optional fields if they have values
    if (client.email) {
      invoiceData.clientEmail = client.email;
    }
    if (client.abn) {
      invoiceData.clientAbn = client.abn;
    }
    if (client.address) {
      invoiceData.clientAddress = client.address;
    }
    if (data.notes) {
      invoiceData.notes = data.notes;
    }
    if (data.paymentInstructions) {
      invoiceData.paymentInstructions = data.paymentInstructions;
    }
    if (data.dueDate) {
      invoiceData.dueDate = Timestamp.fromDate(data.dueDate);
    }

    await invoiceRef.set(invoiceData);

    return { success: true, data: invoiceRef.id };
  } catch (error) {
    console.error("Error creating draft invoice:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create invoice",
    };
  }
}

/**
 * Get all open job items for a client
 */
export async function getOpenJobItemsForClient(
  tenantId: string,
  clientId: string
): Promise<ActionResult<Array<JobItem & { jobTitle: string }>>> {
  try {
    const itemsRef = adminDb.collection(`tenants/${tenantId}/jobItems`);
    const itemsSnap = await itemsRef
      .where("clientId", "==", clientId)
      .where("status", "==", "open")
      .get();

    // Fetch job titles
    const jobIds = new Set<string>();
    const items: JobItem[] = [];

    itemsSnap.forEach((doc) => {
      const item = { id: doc.id, ...doc.data() } as JobItem;
      items.push(item);
      jobIds.add(item.jobId);
    });

    // Fetch jobs to get titles
    const jobTitles = new Map<string, string>();
    const jobPromises = Array.from(jobIds).map(async (jobId) => {
      const jobSnap = await adminDb
        .collection(`tenants/${tenantId}/jobs`)
        .doc(jobId)
        .get();
      if (jobSnap.exists) {
        const job = jobSnap.data() as Job;
        jobTitles.set(jobId, job.title);
      }
    });
    await Promise.all(jobPromises);

    // Combine items with job titles and convert Timestamps to Dates
    const itemsWithJobTitles = items.map((item) => {
      const createdAt =
        item.createdAt instanceof Date
          ? item.createdAt
          : timestampToDate(item.createdAt) || new Date();
      const updatedAt =
        item.updatedAt instanceof Date
          ? item.updatedAt
          : timestampToDate(item.updatedAt) || new Date();

      return {
        ...item,
        jobTitle: jobTitles.get(item.jobId) || "Unknown Job",
        createdAt,
        updatedAt,
      };
    });

    return { success: true, data: itemsWithJobTitles };
  } catch (error) {
    console.error("Error fetching open job items:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch job items",
    };
  }
}

/**
 * Add job items to a draft invoice (with locking)
 */
export async function addItemsToInvoice(
  tenantId: string,
  invoiceId: string,
  jobItemIds: string[]
): Promise<ActionResult<void>> {
  try {
    await adminDb.runTransaction(async (transaction) => {
      const invoiceRef = adminDb
        .collection(`tenants/${tenantId}/invoices`)
        .doc(invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists) {
        throw new Error("Invoice not found");
      }

      const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

      if (invoice.status !== "draft") {
        throw new Error("Can only add items to draft invoices");
      }

      // Fetch and validate job items
      const itemRefs = jobItemIds.map((id) =>
        adminDb.collection(`tenants/${tenantId}/jobItems`).doc(id)
      );
      const itemSnaps = await Promise.all(
        itemRefs.map((ref) => transaction.get(ref))
      );

      const jobIds = new Set<string>();
      const validItems: JobItem[] = [];

      for (const itemSnap of itemSnaps) {
        if (!itemSnap.exists) {
          throw new Error(`Job item ${itemSnap.id} not found`);
        }

        const item = { id: itemSnap.id, ...itemSnap.data() } as JobItem;

        // Validate item is open and not locked
        if (item.status !== "open") {
          throw new Error(
            `Job item "${item.title}" is not available (status: ${item.status})`
          );
        }

        if (item.lock) {
          throw new Error(
            `Job item "${item.title}" is already locked to another invoice`
          );
        }

        validItems.push(item);
        jobIds.add(item.jobId);
      }

      // Fetch job titles
      const jobTitles = new Map<string, string>();
      const jobRefs = Array.from(jobIds).map((jobId) =>
        adminDb.collection(`tenants/${tenantId}/jobs`).doc(jobId)
      );
      const jobSnaps = await Promise.all(
        jobRefs.map((ref) => transaction.get(ref))
      );

      jobSnaps.forEach((jobSnap) => {
        if (jobSnap.exists) {
          const job = jobSnap.data() as Job;
          jobTitles.set(jobSnap.id, job.title);
        }
      });

      // Create invoice lines
      const newLines = validItems.map((item) =>
        createInvoiceLineFromJobItem(
          item,
          jobTitles.get(item.jobId) || "Unknown Job"
        )
      );

      // Combine with existing lines
      const allLines = [...invoice.lines, ...newLines];

      // Compute new totals
      const totals = computeInvoiceTotals(allLines);
      const balanceDueMinor = computeBalanceDue(
        totals.totalMinor,
        invoice.amountPaidMinor
      );

      // Update invoice
      transaction.update(invoiceRef, {
        lines: allLines,
        lockedJobItemIds: [...invoice.lockedJobItemIds, ...jobItemIds],
        ...totals,
        balanceDueMinor,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Lock job items
      const now = Timestamp.now();
      for (const item of validItems) {
        const itemRef = adminDb
          .collection(`tenants/${tenantId}/jobItems`)
          .doc(item.id);
        transaction.update(itemRef, {
          status: "selected" as ItemStatus,
          lock: {
            invoiceId,
            at: now,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error adding items to invoice:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to add items to invoice",
    };
  }
}

/**
 * Remove a job item from a draft invoice (unlocking it)
 */
export async function removeItemFromInvoice(
  tenantId: string,
  invoiceId: string,
  jobItemId: string
): Promise<ActionResult<void>> {
  try {
    await adminDb.runTransaction(async (transaction) => {
      const invoiceRef = adminDb
        .collection(`tenants/${tenantId}/invoices`)
        .doc(invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists) {
        throw new Error("Invoice not found");
      }

      const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

      if (invoice.status !== "draft") {
        throw new Error("Can only remove items from draft invoices");
      }

      // Remove line from invoice
      const updatedLines = invoice.lines.filter(
        (line) => line.jobItemId !== jobItemId
      );
      const updatedLockedIds = invoice.lockedJobItemIds.filter(
        (id) => id !== jobItemId
      );

      // Compute new totals
      const totals = computeInvoiceTotals(updatedLines);
      const balanceDueMinor = computeBalanceDue(
        totals.totalMinor,
        invoice.amountPaidMinor
      );

      // Update invoice
      transaction.update(invoiceRef, {
        lines: updatedLines,
        lockedJobItemIds: updatedLockedIds,
        ...totals,
        balanceDueMinor,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Unlock job item
      const itemRef = adminDb
        .collection(`tenants/${tenantId}/jobItems`)
        .doc(jobItemId);
      transaction.update(itemRef, {
        status: "open" as ItemStatus,
        lock: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error removing item from invoice:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to remove item from invoice",
    };
  }
}

/**
 * Get or create invoice counter for a year
 */
async function getNextInvoiceNumber(
  tenantId: string,
  year: number,
  transaction: FirebaseFirestore.Transaction
): Promise<number> {
  const counterRef = adminDb
    .collection(`tenants/${tenantId}/counters`)
    .doc(`invoices-${year}`);
  const counterSnap = await transaction.get(counterRef);

  let nextNumber: number;

  if (counterSnap.exists) {
    const counter = counterSnap.data() as InvoiceCounter;
    nextNumber = counter.lastNumber + 1;
    transaction.update(counterRef, {
      lastNumber: nextNumber,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    nextNumber = 1;
    const newCounter: Omit<InvoiceCounter, "updatedAt"> & {
      updatedAt: FieldValue;
    } = {
      year,
      lastNumber: nextNumber,
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(counterRef, newCounter);
  }

  return nextNumber;
}

/**
 * Issue/send a draft invoice
 */
export async function issueInvoice(
  tenantId: string,
  invoiceId: string,
  userId: string
): Promise<ActionResult<void>> {
  try {
    await adminDb.runTransaction(async (transaction) => {
      const invoiceRef = adminDb
        .collection(`tenants/${tenantId}/invoices`)
        .doc(invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists) {
        throw new Error("Invoice not found");
      }

      const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

      if (invoice.status !== "draft") {
        throw new Error("Only draft invoices can be issued");
      }

      if (invoice.lines.length === 0) {
        throw new Error("Cannot issue an invoice with no line items");
      }

      // Get sequential invoice number
      const now = new Date();
      const year = now.getFullYear();
      const invoiceNumber = await getNextInvoiceNumber(
        tenantId,
        year,
        transaction
      );
      const formattedNumber = formatInvoiceNumber(year, invoiceNumber);

      // Update invoice status
      const issueDate = Timestamp.now();
      transaction.update(invoiceRef, {
        status: "sent",
        invoiceNumber: formattedNumber,
        issueDate,
        issuedBy: userId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update all locked job items to 'invoiced' status
      for (const jobItemId of invoice.lockedJobItemIds) {
        const itemRef = adminDb
          .collection(`tenants/${tenantId}/jobItems`)
          .doc(jobItemId);
        transaction.update(itemRef, {
          status: "invoiced" as ItemStatus,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error issuing invoice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to issue invoice",
    };
  }
}

/**
 * Update payment amount on an invoice
 */
export async function updateInvoicePayment(
  tenantId: string,
  invoiceId: string,
  amountPaidMinor: number
): Promise<ActionResult<void>> {
  try {
    const invoiceRef = adminDb
      .collection(`tenants/${tenantId}/invoices`)
      .doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();

    if (!invoiceSnap.exists) {
      return { success: false, error: "Invoice not found" };
    }

    const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

    if (invoice.status === "draft" || invoice.status === "void") {
      return {
        success: false,
        error: "Cannot update payment for draft or void invoices",
      };
    }

    if (amountPaidMinor < 0 || amountPaidMinor > invoice.totalMinor) {
      return {
        success: false,
        error: "Invalid payment amount",
      };
    }

    const balanceDueMinor = computeBalanceDue(
      invoice.totalMinor,
      amountPaidMinor
    );
    const dueDate = timestampToDate(invoice.dueDate);

    const newStatus = determineInvoiceStatus(
      invoice.status,
      invoice.totalMinor,
      amountPaidMinor,
      dueDate
    );

    await invoiceRef.update({
      amountPaidMinor,
      balanceDueMinor,
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating invoice payment:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update payment",
    };
  }
}

/**
 * Mark invoice as viewed (for public link tracking)
 */
export async function markInvoiceViewed(
  invoiceId: string,
  publicToken: string
): Promise<ActionResult<void>> {
  try {
    // Find invoice by public token
    const invoicesRef = adminDb.collectionGroup("invoices");
    const querySnap = await invoicesRef
      .where("publicToken", "==", publicToken)
      .limit(1)
      .get();

    if (querySnap.empty) {
      return { success: false, error: "Invoice not found" };
    }

    const invoiceDoc = querySnap.docs[0];
    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;

    // Only update if not already viewed and status is sent
    if (invoice.status === "sent" && !invoice.viewedAt) {
      await invoiceDoc.ref.update({
        status: "viewed",
        viewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error marking invoice as viewed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark invoice as viewed",
    };
  }
}

/**
 * Void an invoice (owner only)
 */
export async function voidInvoice(
  tenantId: string,
  invoiceId: string,
  userRole: string
): Promise<ActionResult<void>> {
  try {
    if (userRole !== "owner") {
      return { success: false, error: "Only owners can void invoices" };
    }

    await adminDb.runTransaction(async (transaction) => {
      const invoiceRef = adminDb
        .collection(`tenants/${tenantId}/invoices`)
        .doc(invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists) {
        throw new Error("Invoice not found");
      }

      const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

      if (invoice.status === "void") {
        throw new Error("Invoice is already void");
      }

      // Update invoice status to void
      transaction.update(invoiceRef, {
        status: "void",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // If invoice was draft, unlock all items
      if (invoice.status === "draft") {
        for (const jobItemId of invoice.lockedJobItemIds) {
          const itemRef = adminDb
            .collection(`tenants/${tenantId}/jobItems`)
            .doc(jobItemId);
          transaction.update(itemRef, {
            status: "open" as ItemStatus,
            lock: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error voiding invoice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to void invoice",
    };
  }
}

/**
 * Delete a draft invoice
 */
export async function deleteDraftInvoice(
  tenantId: string,
  invoiceId: string
): Promise<ActionResult<void>> {
  try {
    await adminDb.runTransaction(async (transaction) => {
      const invoiceRef = adminDb
        .collection(`tenants/${tenantId}/invoices`)
        .doc(invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists) {
        throw new Error("Invoice not found");
      }

      const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

      if (invoice.status !== "draft") {
        throw new Error("Only draft invoices can be deleted");
      }

      // Unlock all items
      for (const jobItemId of invoice.lockedJobItemIds) {
        const itemRef = adminDb
          .collection(`tenants/${tenantId}/jobItems`)
          .doc(jobItemId);
        transaction.update(itemRef, {
          status: "open" as ItemStatus,
          lock: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Delete invoice
      transaction.delete(invoiceRef);
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting draft invoice:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete invoice",
    };
  }
}
