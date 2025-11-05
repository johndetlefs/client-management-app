"use server";

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  Job,
  JobFormData,
  JobUpdateData,
  JobWithClient,
} from "@/types/job";
import type { Client } from "@/types/client";

/**
 * Server action result type
 */
type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Helper function to convert Firestore document to Job
 */
function docToJob(
  doc:
    | FirebaseFirestore.QueryDocumentSnapshot
    | FirebaseFirestore.DocumentSnapshot
): Job {
  const data = doc.data();
  if (!data) throw new Error("Document has no data");

  return {
    id: doc.id,
    ...data,
    startDate: data.startDate?.toDate() || new Date(),
    endDate: data.endDate?.toDate(),
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Job;
}

/**
 * Get all jobs for a tenant
 */
export async function getJobs(
  tenantId: string
): Promise<ActionResult<JobWithClient[]>> {
  try {
    const jobsRef = adminDb.collection(`tenants/${tenantId}/jobs`);
    const snapshot = await jobsRef.orderBy("createdAt", "desc").get();

    const jobs: Job[] = snapshot.docs.map((doc) => docToJob(doc));

    // Fetch client information for each job
    const clientsRef = adminDb.collection(`tenants/${tenantId}/clients`);
    const clientsSnapshot = await clientsRef.get();
    const clientsMap = new Map<string, string>();
    clientsSnapshot.docs.forEach((doc) => {
      const data = doc.data() as Client;
      clientsMap.set(doc.id, data.name);
    });

    const jobsWithClients: JobWithClient[] = jobs.map((job) => ({
      ...job,
      clientName: clientsMap.get(job.clientId) || "Unknown Client",
    }));

    return { success: true, data: jobsWithClients };
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return { success: false, error: "Failed to fetch jobs" };
  }
}

/**
 * Get all jobs for a specific client
 */
export async function getJobsByClient(
  tenantId: string,
  clientId: string
): Promise<ActionResult<Job[]>> {
  try {
    const jobsRef = adminDb.collection(`tenants/${tenantId}/jobs`);
    const snapshot = await jobsRef
      .where("clientId", "==", clientId)
      .orderBy("createdAt", "desc")
      .get();

    const jobs: Job[] = snapshot.docs.map((doc) => docToJob(doc));

    return { success: true, data: jobs };
  } catch (error) {
    console.error("Error fetching jobs by client:", error);
    return { success: false, error: "Failed to fetch jobs for this client" };
  }
}

/**
 * Get a single job by ID
 */
export async function getJob(
  tenantId: string,
  jobId: string
): Promise<ActionResult<Job>> {
  try {
    const jobRef = adminDb.doc(`tenants/${tenantId}/jobs/${jobId}`);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return { success: false, error: "Job not found" };
    }

    const job = docToJob(jobDoc);

    return { success: true, data: job };
  } catch (error) {
    console.error("Error fetching job:", error);
    return { success: false, error: "Failed to fetch job" };
  }
}

/**
 * Create a new job
 */
export async function createJob(
  tenantId: string,
  userId: string,
  data: JobFormData
): Promise<ActionResult<string>> {
  try {
    // Validate that the client exists
    const clientRef = adminDb.doc(
      `tenants/${tenantId}/clients/${data.clientId}`
    );
    const clientDoc = await clientRef.get();

    if (!clientDoc.exists) {
      return { success: false, error: "Client not found" };
    }

    const jobsRef = adminDb.collection(`tenants/${tenantId}/jobs`);

    const jobData = {
      ...data,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      tenantId,
      createdBy: userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await jobsRef.add(jobData);

    return { success: true, data: docRef.id };
  } catch (error) {
    console.error("Error creating job:", error);
    return { success: false, error: "Failed to create job" };
  }
}

/**
 * Update an existing job
 */
export async function updateJob(
  tenantId: string,
  jobId: string,
  data: JobUpdateData
): Promise<ActionResult> {
  try {
    const jobRef = adminDb.doc(`tenants/${tenantId}/jobs/${jobId}`);

    // Verify job exists
    const jobDoc = await jobRef.get();
    if (!jobDoc.exists) {
      return { success: false, error: "Job not found" };
    }

    // If clientId is being updated, validate the new client exists
    if (data.clientId) {
      const clientRef = adminDb.doc(
        `tenants/${tenantId}/clients/${data.clientId}`
      );
      const clientDoc = await clientRef.get();

      if (!clientDoc.exists) {
        return { success: false, error: "Client not found" };
      }
    }

    const updateData = {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await jobRef.update(updateData);

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error updating job:", error);
    return { success: false, error: "Failed to update job" };
  }
}

/**
 * Archive a job (soft delete by setting status to archived)
 */
export async function archiveJob(
  tenantId: string,
  jobId: string
): Promise<ActionResult> {
  try {
    const jobRef = adminDb.doc(`tenants/${tenantId}/jobs/${jobId}`);

    await jobRef.update({
      status: "archived",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error archiving job:", error);
    return { success: false, error: "Failed to archive job" };
  }
}

/**
 * Delete a job (hard delete)
 */
export async function deleteJob(
  tenantId: string,
  jobId: string
): Promise<ActionResult> {
  try {
    const jobRef = adminDb.doc(`tenants/${tenantId}/jobs/${jobId}`);
    await jobRef.delete();

    return { success: true, data: undefined };
  } catch (error) {
    console.error("Error deleting job:", error);
    return { success: false, error: "Failed to delete job" };
  }
}
