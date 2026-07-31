/**
 * Firestore timestamp shape shared by client and admin SDK snapshots.
 * Keep this structural so domain types do not depend on a client-only SDK.
 */
export type FirestoreTimestampLike =
  | Date
  | {
      toDate: () => Date;
    }
  | {
      seconds: number;
      nanoseconds: number;
    };

export type ExpenseSourceFormat =
  | "csv"
  | "qif"
  | "ofx"
  | "qfx"
  | "pdf"
  | "manual";

export type ExpenseImportStatus =
  | "uploaded"
  | "parsing"
  | "ready_for_review"
  | "reviewed"
  | "failed";

export type ExpenseTransactionDirection = "debit" | "credit";

export type ExpenseCandidateReviewStatus =
  | "unreviewed"
  | "business"
  | "personal"
  | "mixed_use"
  | "ignored"
  | "confirmed";

export type ExpenseDuplicateStatus =
  | "new"
  | "already_imported"
  | "possible_duplicate"
  | "duplicate_occurrence";

export type ExpenseRetentionStatus =
  | "active"
  | "minimized"
  | "pending_deletion"
  | "deleted";

export type ExpenseStoredFilePurpose = "source" | "receipt";

export type ExpenseReviewStatus =
  | "draft"
  | "needs_review"
  | "reviewed"
  | "exported";

export type ExpenseGstTreatment =
  | "taxable_purchase"
  // Retained for legacy records created before taxable_purchase was introduced.
  | "gst_claimable"
  | "no_gst"
  | "gst_free"
  | "input_taxed"
  | "private_or_non_claimable"
  | "review_required";

export type ExpenseGstCreditStatus =
  | "claimable"
  | "not_registered"
  | "outside_registration_period"
  | "evidence_missing"
  | "not_claimable"
  | "review_required";

export type ExpenseTaxInvoiceStatus =
  | "not_required"
  | "missing"
  | "attached"
  | "review_required";

export type ExpenseMerchantRuleMatchKind =
  | "exact"
  | "contains"
  | "normalized"
  | "regex";

export type ExpenseSuggestionSource =
  | "user_rule"
  | "merchant_history"
  | "recurring_pattern"
  | "bank_category";

export type ExpenseRecurrenceCadence =
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "annual";

export interface ExpenseRecurrencePatternEvidence {
  algorithmVersion: string;
  cadence: ExpenseRecurrenceCadence;
  occurrenceCount: number;
  firstDate: string;
  lastDate: string;
  minIntervalDays: number;
  maxIntervalDays: number;
  medianAmountMinor: number;
  amountRangeMinor: number;
  amountStable: boolean;
  isSubscriptionLike: boolean;
  confidence: number;
  conflictsWithMerchantRule?: boolean;
}

export type ExpenseExportType =
  | "accountant_workbook"
  | "bas_summary"
  | "expenses_detail"
  | "income_outgoings";

export type ExpenseExportStatus =
  | "queued"
  | "generating"
  | "ready"
  | "failed"
  | "deleted";

export interface ExpenseAuditFields {
  tenantId: string;
  createdAt: FirestoreTimestampLike;
  updatedAt: FirestoreTimestampLike;
  createdBy: string;
  updatedBy?: string;
}

/**
 * Source file metadata.
 * Path: tenants/{tenantId}/expenseSourceFiles/{sourceFileId}
 */
export interface ExpenseSourceFile extends ExpenseAuditFields {
  id: string;
  purpose: ExpenseStoredFilePurpose;
  originalFileName: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  sourceFormat?: ExpenseSourceFormat;
  sourceAccountKey?: string;
  sourceAccountLabel?: string;
  linkedExpenseId?: string;
  retentionStatus: ExpenseRetentionStatus;
  deletedAt?: FirestoreTimestampLike;
  deletedBy?: string;
}

export interface ExpenseImportCounts {
  totalRows: number;
  parsedRows: number;
  candidateRows: number;
  skippedRows: number;
  duplicateRows: number;
  failedRows: number;
}

/**
 * One upload/import attempt.
 * Path: tenants/{tenantId}/expenseImportBatches/{importBatchId}
 */
export interface ExpenseImportBatch extends ExpenseAuditFields {
  id: string;
  sourceFormat: ExpenseSourceFormat;
  sourceFileId?: string;
  sourceAccountKey?: string;
  sourceAccountLabel?: string;
  statementStartDate?: string;
  statementEndDate?: string;
  status: ExpenseImportStatus;
  counts: ExpenseImportCounts;
  parserVersion: string;
  importFingerprint?: string;
  errorMessage?: string;
  reviewedAt?: FirestoreTimestampLike;
  reviewedBy?: string;
}

export interface ExpenseCandidateSuggestion {
  source: ExpenseSuggestionSource;
  confidence: number;
  merchantRuleId?: string;
  categoryId?: string;
  gstTreatment?: ExpenseGstTreatment;
  businessUsePercent?: number;
  isSubscription?: boolean;
  isRecurring?: boolean;
}

/**
 * Parsed transaction row awaiting review.
 * Path: tenants/{tenantId}/expenseCandidates/{candidateId}
 */
export interface ExpenseCandidate extends ExpenseAuditFields {
  id: string;
  importBatchId: string;
  sourceFileId?: string;
  sourceFormat: ExpenseSourceFormat;
  sourceAccountKey?: string;
  sourceTransactionId?: string;
  transactionFingerprint: string;
  occurrenceIndex: number;
  duplicateStatus: ExpenseDuplicateStatus;
  duplicateOfCandidateId?: string;
  existingExpenseId?: string;
  postedDate: string;
  rawDescription: string;
  normalizedMerchantName: string;
  amountMinor: number;
  currency: string;
  direction: ExpenseTransactionDirection;
  bankCategory?: string;
  bankSubCategory?: string;
  reviewStatus: ExpenseCandidateReviewStatus;
  retentionStatus: ExpenseRetentionStatus;
  suggested?: ExpenseCandidateSuggestion;
  recurrencePattern?: ExpenseRecurrencePatternEvidence;
  reviewedAt?: FirestoreTimestampLike;
  reviewedBy?: string;
  retentionExpiresAt?: FirestoreTimestampLike;
  minimizedAt?: FirestoreTimestampLike;
  minimizedBy?: string;
}

/**
 * User/accountant expense category.
 * Path: tenants/{tenantId}/expenseCategories/{categoryId}
 */
export interface ExpenseCategory extends ExpenseAuditFields {
  id: string;
  name: string;
  code?: string;
  description?: string;
  parentCategoryId?: string;
  defaultGstTreatment?: ExpenseGstTreatment;
  active: boolean;
  sortOrder: number;
}

/**
 * Confirmed business or mixed-use expense.
 * Path: tenants/{tenantId}/expenses/{expenseId}
 */
export interface Expense extends ExpenseAuditFields {
  id: string;
  candidateId?: string;
  importBatchId?: string;
  sourceFileId?: string;
  sourceFormat?: ExpenseSourceFormat;
  sourceAccountKey?: string;
  sourceTransactionId?: string;
  transactionFingerprint?: string;
  occurrenceIndex?: number;
  sourceReviewStatus?: "business" | "mixed_use";
  date: string;
  merchantName: string;
  normalizedMerchantName: string;
  rawDescription?: string;
  amountMinor: number;
  currency: string;
  businessUsePercent: number;
  claimableAmountMinor: number;
  categoryId?: string;
  gstTreatment: ExpenseGstTreatment;
  gstIncludedAmountMinor: number;
  gstAmountMinor: number;
  gstCreditStatus: ExpenseGstCreditStatus;
  gstRegistrationStatusAtCalculation:
    | "unknown"
    | "not_registered"
    | "registered";
  gstRegistrationEffectiveFromAtCalculation?: string;
  gstRegistrationEffectiveToAtCalculation?: string;
  gstRegistrationReviewRequired?: boolean;
  calculationVersion: string;
  taxInvoiceStatus: ExpenseTaxInvoiceStatus;
  receiptFileId?: string;
  isSubscription: boolean;
  isRecurring: boolean;
  merchantRuleId?: string;
  notes?: string;
  reviewStatus: ExpenseReviewStatus;
  reviewedAt?: FirestoreTimestampLike;
  reviewedBy?: string;
  exportedAt?: FirestoreTimestampLike;
}

/**
 * Classification rule learned from reviewed expenses.
 * Path: tenants/{tenantId}/expenseMerchantRules/{merchantRuleId}
 */
export interface ExpenseMerchantRule extends ExpenseAuditFields {
  id: string;
  name: string;
  matchKind: ExpenseMerchantRuleMatchKind;
  pattern: string;
  normalizedMerchantKey: string;
  categoryId?: string;
  gstTreatment?: ExpenseGstTreatment;
  businessUsePercent?: number;
  isSubscription?: boolean;
  isRecurring?: boolean;
  confidence: number;
  active: boolean;
  source: "user" | "system";
  createdFromExpenseId?: string;
  lastAppliedAt?: FirestoreTimestampLike;
}

export interface ExpenseExportTotals {
  expenseCount: number;
  grossAmountMinor: number;
  claimableAmountMinor: number;
  gstAmountMinor: number;
  reviewNeededCount: number;
}

/**
 * Generated export metadata.
 * Path: tenants/{tenantId}/expenseExports/{exportId}
 */
export interface ExpenseExport extends ExpenseAuditFields {
  id: string;
  exportType: ExpenseExportType;
  status: ExpenseExportStatus;
  periodStartDate?: string;
  periodEndDate?: string;
  storagePath?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  retentionStatus?: ExpenseRetentionStatus;
  totals?: ExpenseExportTotals;
  generatedAt?: FirestoreTimestampLike;
  errorMessage?: string;
  deletedAt?: FirestoreTimestampLike;
  deletedBy?: string;
}
