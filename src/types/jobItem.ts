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
  gstApplicable?: boolean; // Whether GST/tax should be applied to this item (defaults to true for legacy items)

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
  item: Pick<JobItem, "quantity" | "unitPriceMinor" | "gstApplicable">,
  taxRate: number
): number {
  // Default to true for legacy items that don't have gstApplicable field
  const shouldApplyGst = item.gstApplicable ?? true;
  if (!shouldApplyGst || taxRate <= 0) return 0;
  const subtotal = computeLineSubtotal(item);
  return Math.round(subtotal * taxRate);
}

/**
 * Helper function to compute line total (subtotal + tax) in minor units
 */
export function computeLineTotal(
  item: Pick<JobItem, "quantity" | "unitPriceMinor" | "gstApplicable">,
  taxRate: number
): number {
  const subtotal = computeLineSubtotal(item);
  const tax = computeTaxAmount(item, taxRate);
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
  // Expense is not a unit - return N/A
  if (unit === "expense") {
    return "—";
  }

  const labels: Record<
    Exclude<BillableUnit, "expense">,
    { singular: string; plural: string }
  > = {
    hour: { singular: "hour", plural: "hours" },
    half_day: { singular: "half day", plural: "half days" },
    day: { singular: "day", plural: "days" },
    unit: { singular: "unit", plural: "units" },
  };

  const label = labels[unit as Exclude<BillableUnit, "expense">];
  return quantity === 1 ? label.singular : label.plural;
}
