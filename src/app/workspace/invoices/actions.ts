"use server";

import { requireBusinessAccess } from "@/lib/business/server-access";
import { BusinessError, businessActionFailure, assertResourceId } from "@/lib/business/errors";
import { assertBusinessInput, assertIdList } from "@/lib/business/validation";

import { adminDb } from "@/lib/firebase-admin";
import { Invoice, InvoiceFormData, InvoiceCounter } from "@/types/invoice";
import { JobItem, ItemStatus } from "@/types/jobItem";
import { sortJobItems } from "@/types/jobItem";
import { Client } from "@/types/client";
import { Job } from "@/types/job";
import { TenantSettings } from "@/types/tenant";
import {
  generatePublicToken,
  createInvoiceLineFromJobItem,
  computeInvoiceTotals,
  computeBalanceDue,
  formatInvoiceNumber,
} from "@/lib/invoice-utils";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { assertDraftTaxCurrent, draftTaxContext, refreshDraftTaxLines, invoiceGstRate } from "@/lib/finance/gst";
import { sydneyDate } from "@/lib/finance/period";

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
  data: InvoiceFormData,
  idToken: string,
): Promise<ActionResult<string>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.prepare", claimedUserId: userId });
    assertBusinessInput("invoiceDraft", data);

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
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
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
  clientId: string,
  idToken: string,
): Promise<ActionResult<Array<JobItem & { jobTitle: string }>>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.read" });
    assertResourceId(clientId, "clientId");

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
    const sortedItems = sortJobItems(items);

    const itemsWithJobTitles = sortedItems.map((item) => {
      const createdAt =
        item.createdAt instanceof Date
          ? item.createdAt
          : timestampToDate(item.createdAt) || new Date();
      const updatedAt =
        item.updatedAt instanceof Date
          ? item.updatedAt
          : timestampToDate(item.updatedAt) || new Date();

      // Omit lock field for open items (they shouldn't have locks)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { lock: _lock, ...itemWithoutLock } = item;

      return {
        ...itemWithoutLock,
        jobTitle: jobTitles.get(item.jobId) || "Unknown Job",
        createdAt,
        updatedAt,
      };
    });

    return { success: true, data: itemsWithJobTitles };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
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
  jobItemIds: string[],
  idToken: string,
): Promise<ActionResult<void>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.prepare" });
    assertResourceId(invoiceId, "invoiceId");
    assertIdList(jobItemIds, "jobItemIds");

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

      // Load tenant settings to get tax rate
      const settingsRef = adminDb.doc(`tenants/${tenantId}/settings/business`);
      const settingsSnap = await transaction.get(settingsRef);
      const settings = settingsSnap.exists
        ? (settingsSnap.data() as TenantSettings)
        : null;
      const taxRate = invoiceGstRate(settings, sydneyDate());

      // Fetch and validate job items
      const itemRefs = jobItemIds.map((id) =>
        adminDb.collection(`tenants/${tenantId}/jobItems`).doc(id),
      );
      const itemSnaps = await Promise.all(
        itemRefs.map((ref) => transaction.get(ref)),
      );

      const jobIds = new Set<string>();
      const validItems: JobItem[] = [];

      for (const itemSnap of itemSnaps) {
        if (!itemSnap.exists) {
          throw new Error(`Job item ${itemSnap.id} not found`);
        }

        const item = { id: itemSnap.id, ...itemSnap.data() } as JobItem;

        if (item.clientId !== invoice.clientId) throw new Error("Job item belongs to another client");

        // Validate item is open and not locked
        if (item.status !== "open") {
          throw new Error(
            `Job item "${item.title}" is not available (status: ${item.status})`,
          );
        }

        // Check if item has a valid lock (lock exists and has required fields)
        if (item.lock && item.lock.invoiceId && item.lock.at) {
          throw new Error(
            `Job item "${item.title}" is already locked to another invoice`,
          );
        }

        validItems.push(item);
        jobIds.add(item.jobId);
      }

      // Fetch job titles
      const jobTitles = new Map<string, string>();
      const jobRefs = Array.from(jobIds).map((jobId) =>
        adminDb.collection(`tenants/${tenantId}/jobs`).doc(jobId),
      );
      const jobSnaps = await Promise.all(
        jobRefs.map((ref) => transaction.get(ref)),
      );

      jobSnaps.forEach((jobSnap) => {
        if (!jobSnap.exists || jobSnap.get("clientId") !== invoice.clientId) throw new Error("Job belongs to another client or is unavailable");
        jobTitles.set(jobSnap.id, String(jobSnap.get("title")));
      });

      // Create invoice lines
      const newLines = validItems.map((item) =>
        createInvoiceLineFromJobItem(
          item,
          jobTitles.get(item.jobId) || "Unknown Job",
          taxRate,
        ),
      );

      // Combine with existing lines
      const allLines = refreshDraftTaxLines([...invoice.lines, ...newLines], settings || undefined, sydneyDate());

      // Compute new totals
      const totals = computeInvoiceTotals(allLines, taxRate);
      const balanceDueMinor = computeBalanceDue(
        totals.totalMinor,
        invoice.amountPaidMinor,
      );

      // Update invoice
      transaction.update(invoiceRef, {
        lines: allLines,
        taxCalculation: draftTaxContext(settings || undefined, sydneyDate()),
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
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
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
  jobItemId: string,
  idToken: string,
): Promise<ActionResult<void>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.prepare" });
    assertResourceId(invoiceId, "invoiceId");
    assertResourceId(jobItemId, "jobItemId");

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

      // Load tenant settings to get tax rate
      const settingsRef = adminDb.doc(`tenants/${tenantId}/settings/business`);
      const settingsSnap = await transaction.get(settingsRef);
      const settings = settingsSnap.exists
        ? (settingsSnap.data() as TenantSettings)
        : null;
      const taxRate = invoiceGstRate(settings, sydneyDate());

      // Remove line from invoice
      const updatedLines = refreshDraftTaxLines(invoice.lines.filter(
        (line) => line.jobItemId !== jobItemId,
      ), settings || undefined, sydneyDate());
      const updatedLockedIds = invoice.lockedJobItemIds.filter(
        (id) => id !== jobItemId,
      );

      // Compute new totals
      const totals = computeInvoiceTotals(updatedLines, taxRate);
      const balanceDueMinor = computeBalanceDue(
        totals.totalMinor,
        invoice.amountPaidMinor,
      );

      const itemRef = adminDb.doc(`tenants/${tenantId}/jobItems/${jobItemId}`);
      const itemSnap = await transaction.get(itemRef);
      // Update invoice
      transaction.update(invoiceRef, {
        lines: updatedLines,
        taxCalculation: draftTaxContext(settings || undefined, sydneyDate()),
        lockedJobItemIds: updatedLockedIds,
        ...totals,
        balanceDueMinor,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Unlock job item
      // Only update if item exists
      if (itemSnap.exists) {
        transaction.update(itemRef, {
          status: "open" as ItemStatus,
          lock: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
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
  transaction: FirebaseFirestore.Transaction,
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

/** Explicitly refresh a draft only; the owner reviews changed totals before issue. */
export async function refreshDraftInvoiceTotals(tenantId: string, invoiceId: string, idToken: string): Promise<ActionResult<void>> {
  try {
    const access = await requireBusinessAccess({ tenantId, idToken, capability: "business.prepare" });
    assertResourceId(invoiceId, "invoiceId");
    await adminDb.runTransaction(async transaction => {
      const ref = adminDb.doc(`tenants/${tenantId}/invoices/${invoiceId}`);
      const [snapshot, settingsDoc] = await transaction.getAll(ref, adminDb.doc(`tenants/${tenantId}/settings/business`));
      if (!snapshot.exists) throw new Error("Invoice not found");
      const old = snapshot.data() as Invoice;
      if (old.status !== "draft" || old.amountPaidMinor || old.creditAppliedMinor) throw new Error("Only unpaid draft invoices can be recalculated");
      const settings = settingsDoc.data() as TenantSettings | undefined, date = sydneyDate();
      const lines = refreshDraftTaxLines(old.lines, settings, date), totals = computeInvoiceTotals(lines, invoiceGstRate(settings, date));
      transaction.update(ref, { lines, ...totals, balanceDueMinor: totals.totalMinor, taxCalculation: draftTaxContext(settings, date), updatedAt: FieldValue.serverTimestamp() });
      transaction.create(adminDb.collection(`tenants/${tenantId}/financialAudit`).doc(), { action: "invoice-draft-tax-refresh", recordId: invoiceId, actor: access.userId, at: new Date().toISOString(), before: { taxMinor: old.taxMinor, totalMinor: old.totalMinor }, after: { ...totals, taxCalculation: draftTaxContext(settings, date) }, reason: "Explicit draft totals refresh" });
    });
    return { success: true, data: undefined };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Failed to refresh draft totals" }; }
}

/**
 * Issue/send a draft invoice
 */
export async function issueInvoice(
  tenantId: string,
  invoiceId: string,
  userId: string,
  idToken: string,
): Promise<ActionResult<void>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "documents.issue", claimedUserId: userId });
    assertResourceId(invoiceId, "invoiceId");

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

      const gstSettings = await transaction.get(adminDb.doc(`tenants/${tenantId}/settings/business`));
      const currentSettings = gstSettings.data() as TenantSettings | undefined;
      assertDraftTaxCurrent(invoice, currentSettings, sydneyDate());
      if (invoice.taxMinor > 0 && (!currentSettings?.businessName?.trim() || !currentSettings.abn?.trim() || !invoice.clientName?.trim())) throw new Error("Enter supplier business name and ABN and customer identity before issuing a tax invoice");

      // Get client to check for shortcode
      const clientRef = adminDb
        .collection(`tenants/${tenantId}/clients`)
        .doc(invoice.clientId);
      const clientSnap = await transaction.get(clientRef);

      if (!clientSnap.exists) {
        throw new Error("Client not found");
      }

      const client = { id: clientSnap.id, ...clientSnap.data() } as Client;

      // Get sequential invoice number (internal)
      const now = new Date();
      const year = now.getFullYear();
      const invoiceNumber = await getNextInvoiceNumber(
        tenantId,
        year,
        transaction,
      );
      const formattedNumber = formatInvoiceNumber(year, invoiceNumber);

      // Generate display number if client has shortcode
      let invoiceDisplayNumber: string | undefined;
      if (client.shortcode) {
        const { generateInvoiceCode, formatInvoiceDisplayNumber } =
          await import("@/lib/invoice-utils");
        const code = generateInvoiceCode();
        invoiceDisplayNumber = formatInvoiceDisplayNumber(
          client.shortcode,
          code,
        );
      } else {
        // Fallback to sequential number if no shortcode
        invoiceDisplayNumber = formattedNumber;
      }

      // Update invoice status
      const issueDate = Timestamp.now();
      transaction.update(invoiceRef, {
        status: "sent",
        invoiceNumber: formattedNumber,
        invoiceDisplayNumber,
        issueDate,
        issuedBy: userId,
        taxCalculation: draftTaxContext(currentSettings, sydneyDate()),
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
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
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
/** @deprecated Undated cumulative edits would invalidate receipt-period reporting. */
export async function updateInvoicePayment(
  tenantId: string,
  invoiceId: string,
  amountPaidMinor: number,
  idToken: string,
): Promise<ActionResult<void>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "payments.record" });
    assertResourceId(invoiceId, "invoiceId");
    if (!Number.isSafeInteger(amountPaidMinor) || amountPaidMinor < 0) throw new BusinessError("VALIDATION_ERROR", "Payment amount must be non-negative integer minor units");
    return { success: false, error: "Record a dated receipt in Finances. Undated cumulative payment edits cannot establish accurate reporting periods." };
  } catch (error) {
    return businessActionFailure(error, "Payment update denied");
  }
}

/**
 * Mark invoice as viewed (for public link tracking)
 */
export async function markInvoiceViewed(
  invoiceId: string,
  publicToken: string,
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
    if (invoiceDoc.id !== invoiceId || invoice.status === "draft") {
      return { success: false, error: "Document not available" };
    }

    // Only update if not already viewed (just timestamp, don't change status)
    if (!invoice.viewedAt) {
      await invoiceDoc.ref.update({
        viewedAt: FieldValue.serverTimestamp(),
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
  userRole: string,
  idToken: string,
): Promise<ActionResult<void>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "documents.cancel" });
    assertResourceId(invoiceId, "invoiceId");


    await adminDb.runTransaction(async (transaction) => {
      const invoiceRef = adminDb
        .collection(`tenants/${tenantId}/invoices`)
        .doc(invoiceId);
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists) {
        throw new Error("Invoice not found");
      }

      const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

      if (invoice.creditAppliedMinor || invoice.creditNoteIssuedMinor) throw new Error("This invoice has credit history and cannot be voided independently.");
      if (invoice.creditedBy || invoice.correctionId) throw new Error("Linked correction documents cannot be voided independently; preserve the correction chain");
      if (invoice.status === "void") {
        throw new Error("Invoice is already void");
      }

      if (invoice.status === "draft") {
        throw new Error("Cannot void a draft invoice. Delete it instead.");
      }

      const itemRefs = invoice.lockedJobItemIds.map((jobItemId) =>
        adminDb.collection(`tenants/${tenantId}/jobItems`).doc(jobItemId),
      );
      const itemSnaps = await Promise.all(
        itemRefs.map((itemRef) => transaction.get(itemRef)),
      );

      // Update invoice status to void
      transaction.update(invoiceRef, {
        status: "void",
        updatedAt: FieldValue.serverTimestamp(),
      });
      for (let index = 0; index < invoice.lockedJobItemIds.length; index += 1) {
        const jobItemId = invoice.lockedJobItemIds[index];
        const itemRef = itemRefs[index];
        const itemSnap = itemSnaps[index];

        // Only update if item exists
        if (itemSnap.exists) {
          transaction.update(itemRef, {
            status: "open" as ItemStatus,
            lock: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          console.warn(`[voidInvoice] Item ${jobItemId} not found, skipping`);
        }
      }
    });

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
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
  invoiceId: string,
  idToken: string,
): Promise<ActionResult<void>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.delete" });
    assertResourceId(invoiceId, "invoiceId");

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

      const itemRefs = invoice.lockedJobItemIds.map((jobItemId) =>
        adminDb.collection(`tenants/${tenantId}/jobItems`).doc(jobItemId),
      );
      const itemSnaps = await Promise.all(
        itemRefs.map((itemRef) => transaction.get(itemRef)),
      );

      // Unlock all items
      for (let index = 0; index < invoice.lockedJobItemIds.length; index += 1) {
        const itemRef = itemRefs[index];
        const itemSnap = itemSnaps[index];

        // Only update if item exists
        if (itemSnap.exists) {
          transaction.update(itemRef, {
            status: "open" as ItemStatus,
            lock: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // Delete invoice
      transaction.delete(invoiceRef);
    });

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
    console.error("Error deleting draft invoice:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete invoice",
    };
  }
}
