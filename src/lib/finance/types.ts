export type MovementKind = "unreviewed" | "business_receipt" | "expense" | "supplier_refund" | "salary" | "transfer" | "personal" | "drawings" | "capital" | "loan" | "tax_payment";
export type FinancialDate = string;

export interface CsvMapping {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance?: string;
}

export interface Movement {
  id: string;
  accountId: string;
  date: FinancialDate;
  amountMinor: number; // Signed: account credits positive, debits negative.
  currency: "AUD";
  description: string;
  fingerprint: string;
  occurrence: number;
  sourceRow: number;
  sourceHash: string;
  balanceMinor?: number;
  kind: MovementKind;
  revision: number;
  category?: string;
  businessUseBps?: number;
  expenseId?: string;
  refundOf?: string;
  transferId?: string;
  receiptId?: string;
  taxPaymentId?: string;
  evidence?: string;
  receiptEvidence?: "missing" | "attached" | "not_required";
  taxTreatment?: "operating" | "asset_review" | "non_deductible";
  allowanceMinor?: number;
  gstIncludedMinor?: number;
  gstClaimableMinor?: number;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface StatementImport {
  id: string;
  accountId: string;
  sourceHash: string;
  rawSourceHashes?: string[];
  originalFileSha256?: string;
  parserVersion?: string;
  mapping: CsvMapping;
  start: string;
  end: string;
  rowCount: number;
  debitMinor: number;
  creditMinor: number;
  sourceRows: { movementId: string; row: number; balanceMinor?: number }[];
  completeDays: boolean;
  control: StatementControl;
  createdAt: string;
  createdBy: string;
}

export interface StatementControl {
  state: "balanced" | "missing_balances" | "variance" | "opening_unverified";
  openingMinor: number | null;
  closingMinor: number | null;
  movementMinor: number;
  varianceMinor: number | null;
  balanceBreaks: number;
  note: string;
}

export interface FinancialAccount {
  id: string;
  label: string;
  type: "bank" | "card";
  currency: "AUD";
  mapping: CsvMapping;
  completeThrough?: string;
}

export interface ReceiptAllocation { invoiceId: string; amountMinor: number; replacesLegacyMinor?: number; correctionId?: string; originalAllocations?: { invoiceId: string; amountMinor: number }[] }
export interface Receipt {
  id: string;
  date: string;
  amountMinor: number;
  accountId: string;
  movementId?: string;
  source: "statement" | "manual";
  evidence: string;
  allocations: ReceiptAllocation[];
  reversedBy?: string;
  reversalOf?: string;
  createdAt: string;
  createdBy: string;
}

export interface FinancialInvoice {
  clientId?: string;
  currency?: string;
  creditAppliedMinor?: number;
  id: string;
  number: string;
  issueDate: string;
  totalMinor: number;
  amountPaidMinor: number;
  balanceDueMinor: number;
  status: string;
  ledgerPaidMinor: number;
  legacyUndatedMinor: number;
  taxMinor: number;
  dueDate?: string;
  creditedBy?: string;
  creditedAt?: string;
  correctionId?: string;
}

export interface FinancialAudit {
  id: string;
  action: string;
  actor: string;
  at: string;
  recordId: string;
  before: unknown;
  after: unknown;
  reason: string;
}
