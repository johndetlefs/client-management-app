"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { WithFieldValue } from "firebase-admin/firestore";

import {
  EXPENSE_DEFAULT_SOURCE_ACCOUNT_KEY,
  EXPENSE_CSV_PARSER_VERSION,
  ExpenseCsvParseError,
  parseExpenseBankCsv,
  toExpenseCandidateDraft,
  type ParsedExpenseCsvImport,
} from "@/lib/expenses/csv";
import {
  assertExpenseTenantAccess,
  expenseCandidateRef,
  tenantExpenseCollectionRefs,
} from "@/lib/expenses/firestore";
import {
  createExpenseCandidateOccurrenceId,
  resolveExpenseImportIdempotency,
  type ExpenseImportDuplicateMatch,
  type ExpenseImportPossibleDuplicateMatch,
  type ExpenseImportIdempotencyResult,
} from "@/lib/expenses/idempotency";
import {
  createPersonalDetailRetentionDate,
  EXPENSE_CANDIDATE_SENSITIVE_FIELDS,
  shouldMinimizeExpenseCandidate,
} from "@/lib/expenses/retention";
import { normalizeSourceAccountKey } from "@/lib/expenses/files";
import {
  EXPENSE_QIF_PARSER_VERSION,
  ExpenseQifParseError,
  parseExpenseBankQif,
} from "@/lib/expenses/qif";
import { findMerchantRuleSuggestion } from "@/lib/expenses/merchant-rules";
import {
  createExpenseRecurrenceCutoffDate,
  detectExpenseRecurrencePattern,
  type ExpenseRecurrenceOccurrence,
} from "@/lib/expenses/recurrence";
import { resolveExpenseSuggestion } from "@/lib/expenses/suggestions";
import { adminDb } from "@/lib/firebase-admin";
import type {
  Expense,
  ExpenseCandidate,
  ExpenseCandidateSuggestion,
  ExpenseCandidateReviewStatus,
  ExpenseImportBatch,
  ExpenseImportCounts,
  ExpenseMerchantRule,
  ExpenseRecurrencePatternEvidence,
  ExpenseSourceFormat,
  FirestoreTimestampLike,
} from "@/types/expense";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

interface ImportExpensesSourceInput {
  originalFileName?: string;
  sourceAccountKey?: string;
  sourceAccountLabel?: string;
  sourceFileId?: string;
  currency?: string;
}

export interface ImportExpensesCsvInput extends ImportExpensesSourceInput {
  csvText: string;
}

export interface ImportExpensesQifInput extends ImportExpensesSourceInput {
  qifText: string;
}

export interface ImportExpensesResult {
  importBatchId: string;
  counts: ExpenseImportCounts;
  skippedDuplicates: ExpenseImportDuplicateMatch[];
  possibleDuplicates: ExpenseImportPossibleDuplicateMatch[];
}

interface ExpenseImportPersistenceResult {
  counts: ExpenseImportCounts;
  skippedDuplicates: ExpenseImportDuplicateMatch[];
  possibleDuplicates: ExpenseImportPossibleDuplicateMatch[];
}

export interface ExpenseCandidateReviewRow {
  id: string;
  importBatchId: string;
  postedDate: string;
  rawDescription: string;
  normalizedMerchantName: string;
  amountMinor: number;
  currency: string;
  direction: ExpenseCandidate["direction"];
  bankCategory?: string;
  bankSubCategory?: string;
  duplicateStatus: ExpenseCandidate["duplicateStatus"];
  duplicateOfCandidateId?: string;
  existingExpenseId?: string;
  reviewStatus: ExpenseCandidateReviewStatus;
  retentionStatus: ExpenseCandidate["retentionStatus"];
  sourceAccountKey?: string;
  suggested?: ExpenseCandidateSuggestion;
  recurrencePattern?: ExpenseRecurrencePatternEvidence;
  reviewedAt?: string;
  reviewedBy?: string;
  updatedAt?: string;
}

export interface ExpenseCandidateMinimizationResult {
  minimizedCount: number;
  scannedCount: number;
}

const REVIEW_DECISIONS = new Set<ExpenseCandidateReviewStatus>([
  "business",
  "personal",
  "mixed_use",
  "ignored",
]);

export async function importExpensesCsv(
  tenantId: string,
  idToken: string,
  input: ImportExpensesCsvInput,
): Promise<ActionResult<ImportExpensesResult>> {
  try {
    const { userId } = await assertExpenseTenantAccess(tenantId, idToken);
    const sourceAccountKey = normalizeSourceAccountKey(
      input.sourceAccountKey?.trim() || EXPENSE_DEFAULT_SOURCE_ACCOUNT_KEY,
    );
    const parsed = parseExpenseBankCsv(input.csvText, {
      currency: input.currency,
      sourceAccountKey,
    });
    return await persistParsedExpenseImport({
      tenantId,
      userId,
      input,
      sourceAccountKey,
      parsed,
      sourceFormat: "csv",
      parserVersion: EXPENSE_CSV_PARSER_VERSION,
    });
  } catch (error) {
    console.error("Error importing expenses CSV:", error);
    return importFailure(error, "Failed to import expenses CSV");
  }
}

export async function importExpensesQif(
  tenantId: string,
  idToken: string,
  input: ImportExpensesQifInput,
): Promise<ActionResult<ImportExpensesResult>> {
  try {
    const { userId } = await assertExpenseTenantAccess(tenantId, idToken);
    const sourceAccountKey = normalizeSourceAccountKey(
      input.sourceAccountKey?.trim() || EXPENSE_DEFAULT_SOURCE_ACCOUNT_KEY,
    );
    const parsed = parseExpenseBankQif(input.qifText, {
      currency: input.currency,
      sourceAccountKey,
    });
    return await persistParsedExpenseImport({
      tenantId,
      userId,
      input,
      sourceAccountKey,
      parsed,
      sourceFormat: "qif",
      parserVersion: EXPENSE_QIF_PARSER_VERSION,
    });
  } catch (error) {
    console.error("Error importing expenses QIF:", error);
    return importFailure(error, "Failed to import expenses QIF");
  }
}

async function persistParsedExpenseImport(input: {
  tenantId: string;
  userId: string;
  input: ImportExpensesSourceInput;
  sourceAccountKey: string;
  parsed: ParsedExpenseCsvImport;
  sourceFormat: Extract<ExpenseSourceFormat, "csv" | "qif">;
  parserVersion: string;
}): Promise<ActionResult<ImportExpensesResult>> {
  const refs = tenantExpenseCollectionRefs(input.tenantId);
  const idempotency = await resolveExpenseImportIdempotency({
    refs,
    rows: input.parsed.rows,
  });
  const merchantKeys = [
    ...new Set(
      idempotency.candidateDecisions
        .filter((decision) => decision.row.direction === "debit")
        .map((decision) => decision.row.normalizedMerchantName),
    ),
  ];
  const latestCandidateDate = idempotency.candidateDecisions
    .map((decision) => decision.row.postedDate)
    .sort()
    .at(-1);
  const [merchantRuleSnapshot, recurringHistory] = await Promise.all([
    refs.merchantRules.where("active", "==", true).get(),
    loadRecurringHistory(
      refs,
      merchantKeys,
      latestCandidateDate
        ? createExpenseRecurrenceCutoffDate(latestCandidateDate)
        : undefined,
    ),
  ]);
  const merchantRules = merchantRuleSnapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  })) as ExpenseMerchantRule[];
  const recurrencePatterns = createRecurrencePatterns(
    idempotency.candidateDecisions.map((decision) => decision.row),
    recurringHistory,
  );
  const counts = createIdempotentImportCounts(input.parsed.counts, idempotency);
  const importBatchRef = refs.importBatches.doc();
  const persistence = await writeImportBatchAndCandidates({
    refs,
    importBatchId: importBatchRef.id,
    tenantId: input.tenantId,
    userId: input.userId,
    input: input.input,
    sourceAccountKey: input.sourceAccountKey,
    parsed: input.parsed,
    sourceFormat: input.sourceFormat,
    parserVersion: input.parserVersion,
    idempotency,
    merchantRules,
    recurrencePatterns,
    counts,
    timestamp: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    data: {
      importBatchId: importBatchRef.id,
      counts: persistence.counts,
      skippedDuplicates: persistence.skippedDuplicates,
      possibleDuplicates: persistence.possibleDuplicates,
    },
  };
}

function importFailure(
  error: unknown,
  fallback: string,
): ActionResult<never> {
  if (
    error instanceof ExpenseCsvParseError ||
    error instanceof ExpenseQifParseError
  ) {
    return { success: false, error: error.message };
  }
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
  };
}

export async function getExpenseCandidatesForReview(
  tenantId: string,
  idToken: string,
): Promise<ActionResult<ExpenseCandidateReviewRow[]>> {
  try {
    await assertExpenseTenantAccess(tenantId, idToken);

    const refs = tenantExpenseCollectionRefs(tenantId);
    const snapshot = await refs.candidates.orderBy("postedDate", "desc").get();
    const candidates = snapshot.docs
      .map((doc) => {
        const candidate = doc.data();
        return {
          ...candidate,
          id: candidate.id || doc.id,
        } as ExpenseCandidate;
      })
      .filter(
        (candidate) =>
          candidate.retentionStatus !== "minimized" &&
          candidate.retentionStatus !== "deleted",
      )
      .map(toExpenseCandidateReviewRow);

    return { success: true, data: candidates };
  } catch (error) {
    console.error("Error fetching expense candidates:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch expense candidates",
    };
  }
}

export async function reviewExpenseCandidate(
  tenantId: string,
  idToken: string,
  candidateId: string,
  reviewStatus: ExpenseCandidateReviewStatus,
): Promise<ActionResult<ExpenseCandidateReviewRow>> {
  try {
    const { userId } = await assertExpenseTenantAccess(tenantId, idToken);

    if (!REVIEW_DECISIONS.has(reviewStatus)) {
      return { success: false, error: "Unsupported expense review status" };
    }

    const candidateRef = expenseCandidateRef(tenantId, candidateId);
    await candidateRef.firestore.runTransaction(async (transaction) => {
      const candidateSnap = await transaction.get(candidateRef);
      if (!candidateSnap.exists) {
        throw new Error("Expense candidate not found");
      }
      if (candidateSnap.get("reviewStatus") === "confirmed") {
        throw new Error("Confirmed expenses cannot be reclassified");
      }

      const retentionFields =
        reviewStatus === "personal" || reviewStatus === "ignored"
          ? {
              retentionStatus: "active",
              retentionExpiresAt: Timestamp.fromDate(
                createPersonalDetailRetentionDate(),
              ),
              minimizedAt: FieldValue.delete(),
              minimizedBy: FieldValue.delete(),
            }
          : {
              retentionStatus: "active",
              retentionExpiresAt: FieldValue.delete(),
              minimizedAt: FieldValue.delete(),
              minimizedBy: FieldValue.delete(),
            };

      transaction.update(candidateRef, {
        reviewStatus,
        ...retentionFields,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: userId,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      });
    });

    const updatedSnap = await candidateRef.get();
    return {
      success: true,
      data: toExpenseCandidateReviewRow({
        ...updatedSnap.data(),
        id: updatedSnap.id,
      } as ExpenseCandidate),
    };
  } catch (error) {
    console.error("Error reviewing expense candidate:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to review expense candidate",
    };
  }
}

export async function minimizeExpiredPersonalCandidates(
  tenantId: string,
  idToken: string,
): Promise<ActionResult<ExpenseCandidateMinimizationResult>> {
  try {
    const { userId } = await assertExpenseTenantAccess(tenantId, idToken);
    const refs = tenantExpenseCollectionRefs(tenantId);
    const now = Timestamp.now();
    const snapshot = await refs.candidates
      .where("retentionExpiresAt", "<=", now)
      .orderBy("retentionExpiresAt", "asc")
      .limit(200)
      .get();

    let minimizedCount = 0;
    for (const candidateDoc of snapshot.docs) {
      await adminDb.runTransaction(async (transaction) => {
        const fresh = await transaction.get(candidateDoc.ref);
        if (!fresh.exists) {
          return;
        }
        const candidate = {
          ...fresh.data(),
          id: fresh.id,
        } as ExpenseCandidate;
        if (!shouldMinimizeExpenseCandidate(candidate, now.toDate())) {
          return;
        }

        const sensitiveDeletes = Object.fromEntries(
          EXPENSE_CANDIDATE_SENSITIVE_FIELDS.map((field) => [
            field,
            FieldValue.delete(),
          ]),
        );
        transaction.update(candidateDoc.ref, {
          ...sensitiveDeletes,
          retentionStatus: "minimized",
          retentionExpiresAt: FieldValue.delete(),
          minimizedAt: FieldValue.serverTimestamp(),
          minimizedBy: userId,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: userId,
        });
        minimizedCount += 1;
      });
    }

    return {
      success: true,
      data: {
        minimizedCount,
        scannedCount: snapshot.size,
      },
    };
  } catch (error) {
    console.error("Error minimizing expense candidates:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to minimise personal expense details",
    };
  }
}

async function writeImportBatchAndCandidates({
  refs,
  importBatchId,
  tenantId,
  userId,
  input,
  sourceAccountKey,
  parsed,
  sourceFormat,
  parserVersion,
  idempotency,
  merchantRules,
  recurrencePatterns,
  counts,
  timestamp,
}: {
  refs: ReturnType<typeof tenantExpenseCollectionRefs>;
  importBatchId: string;
  tenantId: string;
  userId: string;
  input: ImportExpensesSourceInput;
  sourceAccountKey: string;
  parsed: ParsedExpenseCsvImport;
  sourceFormat: Extract<ExpenseSourceFormat, "csv" | "qif">;
  parserVersion: string;
  idempotency: ExpenseImportIdempotencyResult;
  merchantRules: ExpenseMerchantRule[];
  recurrencePatterns: Map<string, ExpenseRecurrencePatternEvidence>;
  counts: ExpenseImportCounts;
  timestamp: ReturnType<typeof FieldValue.serverTimestamp>;
}): Promise<ExpenseImportPersistenceResult> {
  const importBatchRef = refs.importBatches.doc(importBatchId);
  const importBatchData = omitUndefined({
    id: importBatchId,
    tenantId,
    sourceFormat,
    sourceFileId: input.sourceFileId,
    sourceAccountKey,
    sourceAccountLabel: input.sourceAccountLabel,
    status: "parsing",
    counts,
    parserVersion,
    importFingerprint: parsed.importFingerprint,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: userId,
  }) as WithFieldValue<ExpenseImportBatch>;

  await importBatchRef.set(importBatchData);

  const raceSkippedDuplicates: ExpenseImportDuplicateMatch[] = [];
  let createdCandidateRows = 0;
  for (const decision of idempotency.candidateDecisions) {
    const candidateRef = refs.candidates.doc(
      createExpenseCandidateOccurrenceId(decision.row),
    );
    const candidateDraft = toExpenseCandidateDraft(decision.row);
    const initialSuggestion =
      decision.row.direction === "debit"
        ? findMerchantRuleSuggestion(
            decision.row.normalizedMerchantName,
            merchantRules,
          )
        : undefined;
    const recurrencePattern =
      decision.row.direction === "debit"
        ? recurrencePatterns.get(
            createRecurrenceGroupKey(
              decision.row.normalizedMerchantName,
              decision.row.currency,
            ),
          )
        : undefined;

    const candidateData = omitUndefined({
      id: candidateRef.id,
      tenantId,
      importBatchId,
      sourceFileId: input.sourceFileId,
      sourceFormat,
      sourceAccountKey,
      sourceTransactionId: undefined,
      ...candidateDraft,
      duplicateStatus: decision.duplicateStatus,
      duplicateOfCandidateId: decision.duplicateOfCandidateId,
      existingExpenseId: decision.existingExpenseId,
      reviewStatus: "unreviewed",
      retentionStatus: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: userId,
    }) as WithFieldValue<ExpenseCandidate>;

    const created = await refs.candidates.firestore.runTransaction(
      async (transaction) => {
        const ruleRef = initialSuggestion?.merchantRuleId
          ? refs.merchantRules.doc(initialSuggestion.merchantRuleId)
          : null;
        const [existingCandidate, currentRuleSnap] = await Promise.all([
          transaction.get(candidateRef),
          ruleRef ? transaction.get(ruleRef) : Promise.resolve(null),
        ]);
        if (existingCandidate.exists) {
          return false;
        }

        const currentSuggestion =
          currentRuleSnap?.exists && decision.row.direction === "debit"
            ? findMerchantRuleSuggestion(decision.row.normalizedMerchantName, [
                {
                  ...(currentRuleSnap.data() as ExpenseMerchantRule),
                  id: currentRuleSnap.id,
                },
              ])
            : undefined;
        const resolved = resolveExpenseSuggestion(
          currentSuggestion,
          recurrencePattern,
        );
        transaction.set(candidateRef, {
          ...candidateData,
          ...(resolved.suggestion ? { suggested: resolved.suggestion } : {}),
          ...(resolved.recurrencePattern
            ? { recurrencePattern: resolved.recurrencePattern }
            : {}),
        });
        if (currentSuggestion && ruleRef) {
          transaction.update(ruleRef, {
            lastAppliedAt: timestamp,
          });
        }
        return true;
      },
    );

    if (created) {
      createdCandidateRows += 1;
    } else {
      raceSkippedDuplicates.push({
        rowNumber: decision.row.rowNumber,
        transactionFingerprint: decision.row.transactionFingerprint,
        occurrenceIndex: decision.row.occurrenceIndex,
        existingCandidateId: candidateRef.id,
      });
    }
  }

  const skippedDuplicates = [
    ...idempotency.skippedDuplicates,
    ...raceSkippedDuplicates,
  ];
  const raceSkippedKeys = new Set(
    raceSkippedDuplicates.map((duplicate) => createDuplicateResultKey(duplicate)),
  );
  const possibleDuplicates = idempotency.possibleDuplicates.filter(
    (duplicate) => !raceSkippedKeys.has(createDuplicateResultKey(duplicate)),
  );
  const finalCounts: ExpenseImportCounts = {
    ...counts,
    candidateRows: createdCandidateRows,
    skippedRows: skippedDuplicates.length,
    duplicateRows: skippedDuplicates.length,
  };

  await importBatchRef.update({
    status: "ready_for_review",
    counts: finalCounts,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    counts: finalCounts,
    skippedDuplicates,
    possibleDuplicates,
  };
}

function createIdempotentImportCounts(
  parsedCounts: ExpenseImportCounts,
  idempotency: ExpenseImportIdempotencyResult,
): ExpenseImportCounts {
  return {
    ...parsedCounts,
    candidateRows: idempotency.candidateDecisions.length,
    skippedRows: idempotency.skippedDuplicates.length,
    duplicateRows: idempotency.skippedDuplicates.length,
  };
}

function createDuplicateResultKey(input: {
  rowNumber: number;
  transactionFingerprint: string;
  occurrenceIndex: number;
}): string {
  return [
    input.rowNumber,
    input.transactionFingerprint,
    input.occurrenceIndex,
  ].join(":");
}

function toExpenseCandidateReviewRow(
  candidate: ExpenseCandidate,
): ExpenseCandidateReviewRow {
  return {
    id: candidate.id,
    importBatchId: candidate.importBatchId,
    postedDate: candidate.postedDate,
    rawDescription: candidate.rawDescription,
    normalizedMerchantName: candidate.normalizedMerchantName,
    amountMinor: candidate.amountMinor,
    currency: candidate.currency,
    direction: candidate.direction,
    bankCategory: candidate.bankCategory,
    bankSubCategory: candidate.bankSubCategory,
    duplicateStatus: candidate.duplicateStatus,
    duplicateOfCandidateId: candidate.duplicateOfCandidateId,
    existingExpenseId: candidate.existingExpenseId,
    reviewStatus: candidate.reviewStatus,
    retentionStatus: candidate.retentionStatus,
    sourceAccountKey: candidate.sourceAccountKey,
    suggested: candidate.suggested,
    recurrencePattern: candidate.recurrencePattern,
    reviewedAt: serializeTimestamp(candidate.reviewedAt),
    reviewedBy: candidate.reviewedBy,
    updatedAt: serializeTimestamp(candidate.updatedAt),
  };
}

async function loadRecurringHistory(
  refs: ReturnType<typeof tenantExpenseCollectionRefs>,
  merchantKeys: string[],
  cutoffDate: string | undefined,
): Promise<ExpenseRecurrenceOccurrence[]> {
  if (merchantKeys.length === 0 || !cutoffDate) {
    return [];
  }

  const chunks = chunkValues(merchantKeys, 30);
  const [candidateSnapshots, expenseSnapshots] = await Promise.all([
    Promise.all(
      chunks.map((chunk) =>
        refs.candidates
          .where("normalizedMerchantName", "in", chunk)
          .where("postedDate", ">=", cutoffDate)
          .get(),
      ),
    ),
    Promise.all(
      chunks.map((chunk) =>
        refs.expenses
          .where("normalizedMerchantName", "in", chunk)
          .where("date", ">=", cutoffDate)
          .get(),
      ),
    ),
  ]);
  const candidateOccurrences = candidateSnapshots.flatMap((snapshot) =>
    snapshot.docs
      .map((doc) => doc.data() as ExpenseCandidate)
      .filter((candidate) => candidate.direction === "debit")
      .map((candidate) => ({
        postedDate: candidate.postedDate,
        normalizedMerchantName: candidate.normalizedMerchantName,
        amountMinor: candidate.amountMinor,
        currency: candidate.currency,
      })),
  );
  const expenseOccurrences = expenseSnapshots.flatMap((snapshot) =>
    snapshot.docs.map((doc) => {
      const expense = doc.data() as Expense;
      return {
        postedDate: expense.date,
        normalizedMerchantName: expense.normalizedMerchantName,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
      };
    }),
  );

  return [...candidateOccurrences, ...expenseOccurrences];
}

function createRecurrencePatterns(
  rows: ReturnType<typeof parseExpenseBankCsv>["rows"],
  history: ExpenseRecurrenceOccurrence[],
): Map<string, ExpenseRecurrencePatternEvidence> {
  const debitRows = rows.filter((row) => row.direction === "debit");
  const occurrences: ExpenseRecurrenceOccurrence[] = [
    ...history,
    ...debitRows.map((row) => ({
      postedDate: row.postedDate,
      normalizedMerchantName: row.normalizedMerchantName,
      amountMinor: row.amountMinor,
      currency: row.currency,
    })),
  ];
  const groups = new Map<
    string,
    { normalizedMerchantName: string; currency: string }
  >();
  for (const row of debitRows) {
    groups.set(
      createRecurrenceGroupKey(row.normalizedMerchantName, row.currency),
      {
        normalizedMerchantName: row.normalizedMerchantName,
        currency: row.currency,
      },
    );
  }

  const patterns = new Map<string, ExpenseRecurrencePatternEvidence>();
  for (const [key, group] of groups) {
    const pattern = detectExpenseRecurrencePattern({
      ...group,
      occurrences,
    });
    if (pattern) {
      patterns.set(key, pattern);
    }
  }
  return patterns;
}

function createRecurrenceGroupKey(
  normalizedMerchantName: string,
  currency: string,
): string {
  return `${normalizedMerchantName}\u0000${currency}`;
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function serializeTimestamp(value: FirestoreTimestampLike | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if ("toDate" in value) {
    return value.toDate().toISOString();
  }

  return new Date(value.seconds * 1000 + value.nanoseconds / 1_000_000).toISOString();
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}
