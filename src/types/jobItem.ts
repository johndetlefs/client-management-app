import { Timestamp } from "firebase/firestore";

/**
 * Billable unit types
 */
export type BillableUnit = "hour" | "half_day" | "day" | "unit" | "expense";

/**
 * Job item status for invoice locking
 */
export type ItemStatus = "open" | "selected" | "invoiced";

/**
 * Invoice lock information
 */
export interface ItemLock {
  invoiceId: string;
  at: Timestamp | Date;
}

/**
 * Main JobItem entity stored in Firestore
 * Path: tenants/{tenantId}/jobItems/{jobItemId}
 */
export interface JobItem {
  id: string;
  tenantId: string;
  jobId: string;
  clientId: string; // Denormalized for easier querying

  // Core information
  title: string;
  description?: string;
  unit: BillableUnit;
  quantity: number;
  unitPriceMinor: number; // Price in minor units (cents)

  // Tax
  taxRate?: number; // Optional tax rate (0.10 = 10%)

  // Invoice locking
  status: ItemStatus;
  lock?: ItemLock; // Present when status is 'selected' or 'invoiced'

  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string; // User ID who created the item
}

/**
 * Form data for creating/editing job items
 * (excludes auto-generated fields)
 */
export type JobItemFormData = Omit<
  JobItem,
  "id" | "tenantId" | "createdAt" | "updatedAt" | "createdBy" | "lock"
>;

/**
 * Partial job item data for updates
 */
export type JobItemUpdateData = Partial<
  Omit<JobItem, "id" | "tenantId" | "createdAt" | "createdBy" | "lock">
>;

/**
 * Helper function to compute line subtotal in minor units
 */
export function computeLineSubtotal(
  item: Pick<JobItem, "quantity" | "unitPriceMinor">
): number {
  return Math.round(item.quantity * item.unitPriceMinor);
}

/**
 * Helper function to compute tax amount in minor units
 */
export function computeTaxAmount(
  item: Pick<JobItem, "quantity" | "unitPriceMinor" | "taxRate">
): number {
  if (!item.taxRate) return 0;
  const subtotal = computeLineSubtotal(item);
  return Math.round(subtotal * item.taxRate);
}

/**
 * Helper function to compute line total (subtotal + tax) in minor units
 */
export function computeLineTotal(
  item: Pick<JobItem, "quantity" | "unitPriceMinor" | "taxRate">
): number {
  const subtotal = computeLineSubtotal(item);
  const tax = computeTaxAmount(item);
  return subtotal + tax;
}

/**
 * Helper function to format minor units to display currency
 */
export function formatMinorUnits(
  minorUnits: number,
  currency: string = "AUD"
): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: currency,
  }).format(major);
}

/**
 * Helper function to get display label for billable unit
 */
export function getBillableUnitLabel(
  unit: BillableUnit,
  quantity: number = 1
): string {
  const labels: Record<BillableUnit, { singular: string; plural: string }> = {
    hour: { singular: "hour", plural: "hours" },
    half_day: { singular: "half day", plural: "half days" },
    day: { singular: "day", plural: "days" },
    unit: { singular: "unit", plural: "units" },
    expense: { singular: "expense", plural: "expenses" },
  };

  const label = labels[unit];
  return quantity === 1 ? label.singular : label.plural;
}
