import { Timestamp } from "firebase/firestore";

/**
 * Job status enumeration
 */
export type JobStatus = "active" | "completed" | "archived";

/**
 * Main Job entity stored in Firestore
 * Path: tenants/{tenantId}/jobs/{jobId}
 */
export interface Job {
  id: string;
  tenantId: string;
  clientId: string;

  // Core information
  title: string;
  reference?: string; // Client's reference number/code
  description?: string;
  status: JobStatus;

  // Dates
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;

  // Billing defaults
  defaultDailyHours?: number; // Default hours per day for daily billing

  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string; // User ID who created the job
}

/**
 * Form data for creating/editing jobs
 * (excludes auto-generated fields)
 */
export type JobFormData = Omit<
  Job,
  "id" | "tenantId" | "createdAt" | "updatedAt" | "createdBy"
>;

/**
 * Partial job data for updates
 */
export type JobUpdateData = Partial<
  Omit<Job, "id" | "tenantId" | "createdAt" | "createdBy">
>;

/**
 * Job with populated client information
 */
export interface JobWithClient extends Job {
  clientName: string;
}
