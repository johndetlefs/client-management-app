import {
  Invoice,
  InvoiceLine,
  TaxBreakdown,
  InvoiceStatus,
} from "@/types/invoice";
import { JobItem } from "@/types/jobItem";

/**
 * Generate a random public token for invoice access
 */
export function generatePublicToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create an invoice line from a job item
 */
export function createInvoiceLineFromJobItem(
  item: JobItem,
  jobTitle: string
): InvoiceLine {
  const subtotalMinor = Math.round(item.quantity * item.unitPriceMinor);
  const taxMinor = item.taxRate ? Math.round(subtotalMinor * item.taxRate) : 0;
  const totalMinor = subtotalMinor + taxMinor;

  return {
    jobItemId: item.id,
    jobId: item.jobId,
    jobTitle,
    title: item.title,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
    taxRate: item.taxRate,
    subtotalMinor,
    taxMinor,
    totalMinor,
  };
}

/**
 * Compute invoice totals from lines
 */
export function computeInvoiceTotals(lines: InvoiceLine[]): {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxBreakdown: TaxBreakdown[];
} {
  let subtotalMinor = 0;
  let taxMinor = 0;
  const taxByRate = new Map<
    number,
    { taxableAmountMinor: number; taxMinor: number }
  >();

  for (const line of lines) {
    subtotalMinor += line.subtotalMinor;
    taxMinor += line.taxMinor;

    // Track tax breakdown by rate
    if (line.taxRate !== undefined && line.taxRate > 0) {
      const existing = taxByRate.get(line.taxRate) || {
        taxableAmountMinor: 0,
        taxMinor: 0,
      };
      existing.taxableAmountMinor += line.subtotalMinor;
      existing.taxMinor += line.taxMinor;
      taxByRate.set(line.taxRate, existing);
    }
  }

  const taxBreakdown: TaxBreakdown[] = Array.from(taxByRate.entries()).map(
    ([rate, amounts]) => ({
      rate,
      taxableAmountMinor: amounts.taxableAmountMinor,
      taxMinor: amounts.taxMinor,
    })
  );

  return {
    subtotalMinor,
    taxMinor,
    totalMinor: subtotalMinor + taxMinor,
    taxBreakdown,
  };
}

/**
 * Compute balance due based on total and amount paid
 */
export function computeBalanceDue(
  totalMinor: number,
  amountPaidMinor: number
): number {
  return Math.max(0, totalMinor - amountPaidMinor);
}

/**
 * Determine invoice status based on payment and due date
 */
export function determineInvoiceStatus(
  currentStatus: InvoiceStatus,
  totalMinor: number,
  amountPaidMinor: number,
  dueDate?: Date
): InvoiceStatus {
  // Don't change status if void or draft
  if (currentStatus === "void" || currentStatus === "draft") {
    return currentStatus;
  }

  const balanceDue = computeBalanceDue(totalMinor, amountPaidMinor);

  // Fully paid
  if (balanceDue === 0) {
    return "paid";
  }

  // Partially paid
  if (amountPaidMinor > 0) {
    return "partially_paid";
  }

  // Check if overdue
  if (dueDate && new Date() > dueDate && currentStatus !== "viewed") {
    return "overdue";
  }

  // Keep current status if sent or viewed
  return currentStatus;
}

/**
 * Check if an invoice is overdue
 */
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (!invoice.dueDate) return false;
  if (
    invoice.status === "paid" ||
    invoice.status === "void" ||
    invoice.status === "draft"
  ) {
    return false;
  }

  const dueDate =
    invoice.dueDate instanceof Date
      ? invoice.dueDate
      : invoice.dueDate.toDate();

  return new Date() > dueDate;
}

/**
 * Calculate days overdue
 */
export function getDaysOverdue(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (today <= due) return 0;

  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Format invoice number (internal sequential format)
 */
export function formatInvoiceNumber(year: number, number: number): string {
  return `${year}-${number.toString().padStart(3, "0")}`;
}

/**
 * Validate client shortcode (must be exactly 4 uppercase letters)
 */
export function validateShortcode(shortcode: string): boolean {
  return /^[A-Z]{4}$/.test(shortcode);
}

/**
 * Generate a random 5-character alphanumeric code (uppercase)
 */
export function generateInvoiceCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Format invoice display number with client shortcode
 * @param shortcode - 4-letter client code (e.g., "QNTS")
 * @param code - 5-char alphanumeric (e.g., "5TU72")
 */
export function formatInvoiceDisplayNumber(
  shortcode: string,
  code: string
): string {
  return `${shortcode.toUpperCase()}-${code}`;
}

/**
 * Format minor units to display currency (Australian format)
 */
export function formatCurrency(
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
 * Format date to Australian format (DD/MM/YYYY)
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format tax rate as percentage
 */
export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

/**
 * Get status badge color
 */
export function getStatusColor(status: InvoiceStatus): string {
  const colors: Record<InvoiceStatus, string> = {
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    viewed: "bg-purple-100 text-purple-800",
    partially_paid: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    void: "bg-gray-100 text-gray-500 line-through",
  };
  return colors[status];
}

/**
 * Get status display label
 */
export function getStatusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    partially_paid: "Partially Paid",
    paid: "Paid",
    overdue: "Overdue",
    void: "Void",
  };
  return labels[status];
}
