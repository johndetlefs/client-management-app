import type { InvoiceLine } from "@/types/invoice";
import type { Receipt, ReceiptAllocation } from "@/lib/finance/types";
import type { GstRegistrationSettings } from "@/types/tenant";

export interface OriginalInvoice {
  id: string; version: string; clientId: string; clientName: string; number: string;
  issueDate: string; currency: string; status: string; lines: InvoiceLine[];
  subtotalMinor: number; taxMinor: number; totalMinor: number; amountPaidMinor: number;
  ledgerPaidMinor: number; legacyUndatedMinor: number; lockedJobItemIds: string[];
  snapshot: Record<string, unknown>;
}
export interface ServicePeriod { invoiceId: string; lineIndex: number; from: string; through: string }
export interface ReceiptMatch { receiptId: string; invoiceId: string; amountMinor: number; evidence: string }
export interface CorrectionAttachment { name: string; sha256: string; base64: string }
export interface CorrectionInput {
  id: string; originalIds: string[]; reason: string; evidence: string; taxRateBps: number;
  periods: ServicePeriod[]; receiptMatches: ReceiptMatch[]; unresolved: string[];
  omittedLines: { invoiceId: string; lineIndex: number; reason: string }[];
  dueDate: string; attachments: CorrectionAttachment[];
}
export interface CorrectionLine extends InvoiceLine {
  originalInvoiceId: string; originalNumber: string; originalLineIndex: number;
  serviceFrom: string; serviceThrough: string;
}
export interface CorrectionPreview {
  creditSubtotalMinor: number; creditTaxMinor: number; creditTotalMinor: number;
  subtotalMinor: number; taxMinor: number; totalMinor: number; carriedMinor: number; balanceMinor: number;
  lines: CorrectionLine[]; blockers: string[];
  receiptChanges: { id: string; before: ReceiptAllocation[]; after: ReceiptAllocation[] }[];
}
export interface InvoiceCorrection {
  id: string; revision: number; status: "prepared" | "posted";
  input: CorrectionInput; originals: OriginalInvoice[]; receipts: Receipt[]; receiptVersions: Record<string, string>;
  preview: CorrectionPreview; createdAt: string; updatedAt: string; createdBy: string;
  settingsSnapshot: { businessName: string; abn: string; address: string; email: string; bankAccount: Record<string, unknown>; phone?: string; logoUrl?: string; invoiceTerms?: string; invoiceFooter?: string };
  publicToken?: string; replacementPublicToken?: string;
  settlement?: { amountPaidMinor: number; balanceDueMinor: number; status: string };
  postedAt?: string; postingDate?: string; creditNumber?: string; replacementNumber?: string; replacementId?: string;
}
export interface CorrectionContext {
  originals: OriginalInvoice[]; receipts: Receipt[];
  registration?: GstRegistrationSettings; registrationEvidence: string; today: string;
}
