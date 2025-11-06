"use server";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  JobItem,
  JobItemFormData,
  JobItemUpdateData,
} from "@/types/jobItem";

/**
 * Server action result type
 */
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Helper function to convert Firestore document to JobItem
 */
function docToJobItem(
  doc:
    | FirebaseFirestore.QueryDocumentSnapshot
    | FirebaseFirestore.DocumentSnapshot
): JobItem {
  const data = doc.data();
  if (!data) throw new Error("Document has no data");

  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    lock: data.lock
      ? {
          invoiceId: data.lock.invoiceId,
          at: data.lock.at?.toDate() || new Date(),
        }
      : undefined,
  } as JobItem;
}

/**
 * Get all job items for a specific job
 */
export async function getJobItems(
  tenantId: string,
  jobId: string
): Promise<ActionResult<JobItem[]>> {
  try {
    console.log(
      "[getJobItems] Starting - tenantId:",
      tenantId,
      "jobId:",
      jobId
    );
    const jobItemsRef = adminDb.collection(`tenants/${tenantId}/jobItems`);
    const snapshot = await jobItemsRef
      .where("jobId", "==", jobId)
      .orderBy("createdAt", "desc")
      .get();
    console.log("[getJobItems] Docs fetched, count:", snapshot.docs.length);

    const jobItems: JobItem[] = snapshot.docs.map((doc) => docToJobItem(doc));

    console.log("[getJobItems] Success - returning", jobItems.length, "items");
    return { success: true, data: jobItems };
  } catch (error) {
    console.error("Error fetching job items:", error);
    return { success: false, error: "Failed to fetch job items" };
  }
}

/**
 * Get all open job items for a specific client (for invoice creation)
 */
export async function getOpenJobItemsByClient(
  tenantId: string,
  clientId: string
): Promise<ActionResult<JobItem[]>> {
  try {
    const jobItemsRef = adminDb.collection(`tenants/${tenantId}/jobItems`);
    const snapshot = await jobItemsRef
      .where("clientId", "==", clientId)
      .where("status", "==", "open")
      .orderBy("createdAt", "desc")
      .get();

    const jobItems: JobItem[] = snapshot.docs.map((doc) => docToJobItem(doc));

    return { success: true, data: jobItems };
  } catch (error) {
    console.error("Error fetching open job items:", error);
    return { success: false, error: "Failed to fetch open job items" };
  }
}

/**
 * Get a single job item by ID
 */
export async function getJobItem(
  tenantId: string,
  jobItemId: string
): Promise<ActionResult<JobItem>> {
  try {
    const jobItemRef = adminDb.doc(`tenants/${tenantId}/jobItems/${jobItemId}`);
    const jobItemDoc = await jobItemRef.get();

    if (!jobItemDoc.exists) {
      return { success: false, error: "Job item not found" };
    }

    const jobItem = docToJobItem(jobItemDoc);

    return { success: true, data: jobItem };
  } catch (error) {
    console.error("Error fetching job item:", error);
    return { success: false, error: "Failed to fetch job item" };
  }
}

/**
 * Create a new job item
 */
export async function createJobItem(
  tenantId: string,
  userId: string,
  data: JobItemFormData
): Promise<ActionResult<string>> {
  try {
    console.log(
      "[createJobItem] Starting - tenantId:",
      tenantId,
      "userId:",
      userId
    );
    console.log("[createJobItem] Data:", JSON.stringify(data, null, 2));

    // Validate that the job exists
    const jobRef = adminDb.doc(`tenants/${tenantId}/jobs/${data.jobId}`);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      console.error("[createJobItem] Job not found:", data.jobId);
      return { success: false, error: "Job not found" };
    }

    // Validate numeric fields
    if (data.quantity <= 0) {
      return { success: false, error: "Quantity must be greater than 0" };
    }

    if (data.unitPriceMinor < 0) {
      return { success: false, error: "Unit price cannot be negative" };
    }

    const jobItemsRef = adminDb.collection(`tenants/${tenantId}/jobItems`);

    const jobItemData = {
      ...data,
      tenantId,
      status: "open" as const,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    console.log("[createJobItem] About to add document...");
    const docRef = await jobItemsRef.add(jobItemData);
    console.log("[createJobItem] Success - docId:", docRef.id);

    return { success: true, data: docRef.id };
  } catch (error) {
    console.error("Error creating job item:", error);
    return { success: false, error: "Failed to create job item" };
  }
}

/**
 * Update an existing job item
 */
export async function updateJobItem(
  tenantId: string,
  jobItemId: string,
  data: JobItemUpdateData
): Promise<ActionResult> {
  try {
    const jobItemRef = adminDb.doc(`tenants/${tenantId}/jobItems/${jobItemId}`);

    // Verify job item exists
    const jobItemDoc = await jobItemRef.get();
    if (!jobItemDoc.exists) {
      return { success: false, error: "Job item not found" };
    }

    const existingItem = jobItemDoc.data() as JobItem;

    // Prevent updates to locked items
    if (existingItem.status !== "open") {
      return {
        success: false,
        error: "Cannot update job item that is selected or invoiced",
      };
    }

    // Validate numeric fields if provided
    if (data.quantity !== undefined && data.quantity <= 0) {
      return { success: false, error: "Quantity must be greater than 0" };
    }

    if (data.unitPriceMinor !== undefined && data.unitPriceMinor < 0) {
      return { success: false, error: "Unit price cannot be negative" };
    }

    const updateData = {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await jobItemRef.update(updateData);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating job item:", error);
    return { success: false, error: "Failed to update job item" };
  }
}

/**
 * Delete a job item
 */
export async function deleteJobItem(
  tenantId: string,
  jobItemId: string
): Promise<ActionResult> {
  try {
    const jobItemRef = adminDb.doc(`tenants/${tenantId}/jobItems/${jobItemId}`);

    // Verify job item exists
    const jobItemDoc = await jobItemRef.get();
    if (!jobItemDoc.exists) {
      return { success: false, error: "Job item not found" };
    }

    const existingItem = jobItemDoc.data() as JobItem;

    // Prevent deletion of locked items
    if (existingItem.status !== "open") {
      return {
        success: false,
        error: "Cannot delete job item that is selected or invoiced",
      };
    }

    await jobItemRef.delete();

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting job item:", error);
    return { success: false, error: "Failed to delete job item" };
  }
}
