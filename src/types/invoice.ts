import { Timestamp } from "firebase/firestore";
import { z } from "zod";

/**
 * Invoice status enumeration
 */
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

/**
 * Invoice line item (snapshot of JobItem at time of invoicing)
 */
export interface InvoiceLine {
  jobItemId: string;
  jobId: string;
  jobTitle: string;
  title: string;
  description?: string;
  unit: string;
  quantity: number;
  unitPriceMinor: number; // Price per unit in minor units (cents)
  taxRate?: number; // Tax rate applied (0.10 = 10%)
  subtotalMinor: number; // quantity * unitPriceMinor
  taxMinor: number; // subtotalMinor * taxRate
  totalMinor: number; // subtotalMinor + taxMinor
}

/**
 * Tax breakdown by rate
 */
export interface TaxBreakdown {
  rate: number; // Tax rate (0.10 = 10%)
  taxableAmountMinor: number; // Total taxable amount at this rate
  taxMinor: number; // Total tax at this rate
}

/**
 * Main Invoice entity stored in Firestore
 * Path: tenants/{tenantId}/invoices/{invoiceId}
 */
export interface Invoice {
  id: string;
  tenantId: string;
  clientId: string;

  // Invoice identification
  invoiceNumber?: string; // Sequential per tenant/year (e.g., "2025-001")
  status: InvoiceStatus;

  // Dates
  issueDate?: Timestamp | Date; // When invoice was sent
  dueDate?: Timestamp | Date; // Payment due date
  viewedAt?: Timestamp | Date; // When client first viewed (for public link)

  // Line items
  lines: InvoiceLine[];
  lockedJobItemIds: string[]; // IDs of job items locked to this invoice

  // Totals (all in minor units)
  subtotalMinor: number; // Sum of all line subtotals
  taxMinor: number; // Sum of all line taxes
  totalMinor: number; // subtotalMinor + taxMinor
  taxBreakdown: TaxBreakdown[]; // Breakdown by tax rate

  // Payment tracking
  amountPaidMinor: number; // Amount paid so far
  balanceDueMinor: number; // totalMinor - amountPaidMinor

  // Client snapshot (denormalized for display)
  clientName: string;
  clientEmail?: string;
  clientAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };

  // Public access
  publicToken?: string; // Random token for public read-only access

  // Notes
  notes?: string;
  paymentInstructions?: string;

  // Timestamps
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string; // User ID who created the invoice
  issuedBy?: string; // User ID who issued/sent the invoice
}

/**
 * Counter document for sequential invoice numbering
 * Path: tenants/{tenantId}/counters/invoices-{year}
 */
export interface InvoiceCounter {
  year: number;
  lastNumber: number; // Last used number for this year
  updatedAt: Timestamp | Date;
}

/**
 * Form data for creating invoices
 */
export type InvoiceFormData = {
  clientId: string;
  dueDate?: Date;
  notes?: string;
  paymentInstructions?: string;
};

/**
 * Zod schema for invoice form data
 */
export const InvoiceFormSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  dueDate: z.date().optional(),
  notes: z.string().optional(),
  paymentInstructions: z.string().optional(),
});

/**
 * Payment update data
 */
export type PaymentUpdateData = {
  amountPaidMinor: number;
};

/**
 * Zod schema for payment updates
 */
export const PaymentUpdateSchema = z.object({
  amountPaidMinor: z.number().min(0, "Amount must be non-negative"),
});

/**
 * Helper type for invoice with computed properties
 */
export interface InvoiceWithComputed extends Invoice {
  isOverdue: boolean;
  daysOverdue: number;
}

/**
 * Filter options for invoice list
 */
export type InvoiceFilterStatus = InvoiceStatus | "all";

/**
 * Sort options for invoice list
 */
export type InvoiceSortField =
  | "issueDate"
  | "dueDate"
  | "invoiceNumber"
  | "totalMinor";
export type InvoiceSortDirection = "asc" | "desc";
