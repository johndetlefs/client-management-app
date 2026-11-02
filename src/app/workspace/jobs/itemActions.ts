"use server";

import { requireBusinessAccess } from "@/lib/business/server-access";
import { BusinessError, businessActionFailure, assertResourceId } from "@/lib/business/errors";
import { assertBusinessInput } from "@/lib/business/validation";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  JobItem,
  JobItemFormData,
  JobItemUpdateData,
} from "@/types/jobItem";
import { sortJobItems } from "@/types/jobItem";

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
    | FirebaseFirestore.DocumentSnapshot,
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
  jobId: string,
  idToken: string,
): Promise<ActionResult<JobItem[]>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.read" });
    assertResourceId(jobId, "jobId");
    const jobItemsRef = adminDb.collection(`tenants/${tenantId}/jobItems`);
    const snapshot = await jobItemsRef.where("jobId", "==", jobId).get();

    const jobItems: JobItem[] = sortJobItems(
      snapshot.docs.map((doc) => docToJobItem(doc)),
    );
    return { success: true, data: jobItems };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
    console.error("Error fetching job items:", error);

    // Check if it's an index error
    if (error instanceof Error && error.message.includes("index")) {
      return {
        success: false,
        error:
          "Database index required. Please deploy Firestore indexes or contact support.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch job items",
    };
  }
}

/**
 * Get all open job items for a specific client (for invoice creation)
 */
export async function getOpenJobItemsByClient(
  tenantId: string,
  clientId: string,
  idToken: string,
): Promise<ActionResult<JobItem[]>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.read" });
    assertResourceId(clientId, "clientId");

    const jobItemsRef = adminDb.collection(`tenants/${tenantId}/jobItems`);
    const snapshot = await jobItemsRef
      .where("clientId", "==", clientId)
      .where("status", "==", "open")
      .get();

    const jobItems: JobItem[] = sortJobItems(
      snapshot.docs.map((doc) => docToJobItem(doc)),
    );

    return { success: true, data: jobItems };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
    console.error("Error fetching open job items:", error);

    // Check if it's an index error
    if (error instanceof Error && error.message.includes("index")) {
      return {
        success: false,
        error:
          "Database index required. Please deploy Firestore indexes or contact support.",
      };
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch open job items",
    };
  }
}

/**
 * Get a single job item by ID
 */
export async function getJobItem(
  tenantId: string,
  jobItemId: string,
  idToken: string,
): Promise<ActionResult<JobItem>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.read" });
    assertResourceId(jobItemId, "jobItemId");

    const jobItemRef = adminDb.doc(`tenants/${tenantId}/jobItems/${jobItemId}`);
    const jobItemDoc = await jobItemRef.get();

    if (!jobItemDoc.exists) {
      return { success: false, error: "Job item not found" };
    }

    const jobItem = docToJobItem(jobItemDoc);

    return { success: true, data: jobItem };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
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
  data: JobItemFormData,
  idToken: string,
): Promise<ActionResult<string>> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.prepare", claimedUserId: userId });
    assertBusinessInput("item", data);

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
    const existingForJobSnap = await jobItemsRef
      .where("jobId", "==", data.jobId)
      .get();

    let nextSortOrder = 1;
    if (!existingForJobSnap.empty) {
      const existingItems = existingForJobSnap.docs
        .map((doc) => docToJobItem(doc))
        .filter((item) => typeof item.sortOrder === "number");

      if (existingItems.length > 0) {
        nextSortOrder =
          Math.max(...existingItems.map((item) => item.sortOrder as number)) +
          1;
      } else {
        nextSortOrder = existingForJobSnap.size + 1;
      }
    }

    // Remove undefined values to avoid Firestore errors
    const cleanData: Record<string, unknown> = {
      jobId: data.jobId,
      clientId: data.clientId,
      title: data.title,
      unit: data.unit,
      quantity: data.quantity,
      unitPriceMinor: data.unitPriceMinor,
      gstApplicable: data.gstApplicable ?? true,
      status: data.status,
      sortOrder: nextSortOrder,
      tenantId,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only add description if it's defined
    if (data.description !== undefined && data.description !== "") {
      cleanData.description = data.description;
    }
    const docRef = await jobItemsRef.add(cleanData);

    return { success: true, data: docRef.id };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
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
  data: JobItemUpdateData,
  idToken: string,
): Promise<ActionResult> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.prepare" });
    assertResourceId(jobItemId, "jobItemId");
    assertBusinessInput("item", data);

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

    // Remove undefined values to avoid Firestore errors
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only add fields that are defined
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) {
      // Allow empty string to clear description
      updateData.description = data.description || FieldValue.delete();
    }
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.quantity !== undefined) updateData.quantity = data.quantity;
    if (data.unitPriceMinor !== undefined)
      updateData.unitPriceMinor = data.unitPriceMinor;
    if (data.gstApplicable !== undefined)
      updateData.gstApplicable = data.gstApplicable;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.jobId !== undefined) updateData.jobId = data.jobId;
    if (data.clientId !== undefined) updateData.clientId = data.clientId;

    await jobItemRef.update(updateData);

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
    console.error("Error updating job item:", error);
    return { success: false, error: "Failed to update job item" };
  }
}

/**
 * Delete a job item
 */
export async function deleteJobItem(
  tenantId: string,
  jobItemId: string,
  idToken: string,
): Promise<ActionResult> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.delete" });
    assertResourceId(jobItemId, "jobItemId");

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
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
    console.error("Error deleting job item:", error);
    return { success: false, error: "Failed to delete job item" };
  }
}

export async function moveJobItemOrder(
  tenantId: string,
  jobId: string,
  jobItemId: string,
  direction: "up" | "down",
  idToken: string,
): Promise<ActionResult> {
  try {
    await requireBusinessAccess({ tenantId, idToken, capability: "business.prepare" });
    assertResourceId(jobId, "jobId");
    assertResourceId(jobItemId, "jobItemId");
    if (direction !== "up" && direction !== "down") throw new BusinessError("VALIDATION_ERROR", "Invalid reorder direction");

    const jobItemsRef = adminDb.collection(`tenants/${tenantId}/jobItems`);
    const snapshot = await jobItemsRef.where("jobId", "==", jobId).get();

    if (snapshot.empty) {
      return { success: false, error: "No job items found" };
    }

    const orderedItems = sortJobItems(
      snapshot.docs.map((doc) => docToJobItem(doc)),
    );
    const currentIndex = orderedItems.findIndex(
      (item) => item.id === jobItemId,
    );

    if (currentIndex === -1) {
      return { success: false, error: "Job item not found" };
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= orderedItems.length) {
      return { success: true, data: undefined };
    }

    const reorderedItems = [...orderedItems];
    const [movedItem] = reorderedItems.splice(currentIndex, 1);
    reorderedItems.splice(targetIndex, 0, movedItem);

    const batch = adminDb.batch();
    reorderedItems.forEach((item, index) => {
      const nextSortOrder = index + 1;
      if (item.sortOrder !== nextSortOrder) {
        const itemRef = adminDb.doc(`tenants/${tenantId}/jobItems/${item.id}`);
        batch.update(itemRef, {
          sortOrder: nextSortOrder,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    await batch.commit();

    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof BusinessError) return businessActionFailure(error, "Business operation failed");
    console.error("Error moving job item order:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to move job item",
    };
  }
}
