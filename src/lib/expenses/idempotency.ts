import type {
  CollectionReference,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import type { ParsedExpenseCsvRow } from "@/lib/expenses/csv";
import type { tenantExpenseCollectionRefs } from "@/lib/expenses/firestore";
import type {
  Expense,
  ExpenseCandidate,
  ExpenseDuplicateStatus,
  ExpenseTransactionDirection,
} from "@/types/expense";

const FIRESTORE_IN_FILTER_LIMIT = 30;

type ExpenseRefs = Pick<
  ReturnType<typeof tenantExpenseCollectionRefs>,
  "candidates" | "expenses"
>;

type ExistingExpenseRecordKind = "candidate" | "expense";

interface ExistingExpenseRecord {
  kind: ExistingExpenseRecordKind;
  id: string;
  transactionFingerprint?: string;
  occurrenceIndex?: number;
  postedDate: string;
  direction: ExpenseTransactionDirection;
  amountMinor: number;
}

export interface ExpenseImportDuplicateMatch {
  rowNumber: number;
  transactionFingerprint: string;
  occurrenceIndex: number;
  existingCandidateId?: string;
  existingExpenseId?: string;
}

export interface ExpenseImportPossibleDuplicateMatch {
  rowNumber: number;
  transactionFingerprint: string;
  occurrenceIndex: number;
  matchedCandidateId?: string;
  matchedExpenseId?: string;
}

export interface ExpenseImportCandidateDecision {
  row: ParsedExpenseCsvRow;
  duplicateStatus: Extract<ExpenseDuplicateStatus, "new" | "possible_duplicate">;
  duplicateOfCandidateId?: string;
  existingExpenseId?: string;
}

export interface ExpenseImportIdempotencyResult {
  candidateDecisions: ExpenseImportCandidateDecision[];
  skippedDuplicates: ExpenseImportDuplicateMatch[];
  possibleDuplicates: ExpenseImportPossibleDuplicateMatch[];
}

export async function resolveExpenseImportIdempotency({
  refs,
  rows,
}: {
  refs: ExpenseRefs;
  rows: ParsedExpenseCsvRow[];
}): Promise<ExpenseImportIdempotencyResult> {
  if (rows.length === 0) {
    return {
      candidateDecisions: [],
      skippedDuplicates: [],
      possibleDuplicates: [],
    };
  }

  const existingRecords = await loadExistingExpenseRecords(refs, rows);
  const exactMatches = buildExactMatchIndex(existingRecords);
  const possibleMatches = buildPossibleMatchIndex(existingRecords);

  const candidateDecisions: ExpenseImportCandidateDecision[] = [];
  const skippedDuplicates: ExpenseImportDuplicateMatch[] = [];
  const possibleDuplicates: ExpenseImportPossibleDuplicateMatch[] = [];

  for (const row of rows) {
    const exactMatch = exactMatches.get(createOccurrenceKey(row));
    if (exactMatch) {
      skippedDuplicates.push(toDuplicateMatch(row, exactMatch));
      continue;
    }

    const possibleMatch = findPossibleDuplicate(row, possibleMatches);
    if (possibleMatch) {
      const possibleDuplicate = toPossibleDuplicateMatch(row, possibleMatch);
      possibleDuplicates.push(possibleDuplicate);
      candidateDecisions.push({
        row,
        duplicateStatus: "possible_duplicate",
        duplicateOfCandidateId: possibleDuplicate.matchedCandidateId,
        existingExpenseId: possibleDuplicate.matchedExpenseId,
      });
      continue;
    }

    candidateDecisions.push({
      row,
      duplicateStatus: "new",
    });
  }

  return {
    candidateDecisions,
    skippedDuplicates,
    possibleDuplicates,
  };
}

export function createExpenseCandidateOccurrenceId(row: ParsedExpenseCsvRow): string {
  return `tx_${row.transactionFingerprint}_${row.occurrenceIndex}`;
}

function createOccurrenceKey(input: {
  transactionFingerprint: string;
  occurrenceIndex: number;
}): string {
  return `${input.transactionFingerprint}:${input.occurrenceIndex}`;
}

function createPossibleMatchKey(input: {
  postedDate: string;
  direction: ExpenseTransactionDirection;
  amountMinor: number;
}): string {
  return `${input.postedDate}:${input.direction}:${input.amountMinor}`;
}

async function loadExistingExpenseRecords(
  refs: ExpenseRefs,
  rows: ParsedExpenseCsvRow[],
): Promise<ExistingExpenseRecord[]> {
  const fingerprints = unique(rows.map((row) => row.transactionFingerprint));
  const postedDates = unique(rows.map((row) => row.postedDate));

  const [
    exactCandidateDocs,
    exactExpenseDocs,
    sameDateCandidateDocs,
    sameDateExpenseDocs,
  ] = await Promise.all([
    getDocsWhereIn(refs.candidates, "transactionFingerprint", fingerprints),
    getDocsWhereIn(refs.expenses, "transactionFingerprint", fingerprints),
    getDocsWhereIn(refs.candidates, "postedDate", postedDates),
    getDocsWhereIn(refs.expenses, "date", postedDates),
  ]);

  const records = new Map<string, ExistingExpenseRecord>();

  for (const doc of exactCandidateDocs) {
    addRecord(records, fromCandidateDoc(doc));
  }
  for (const doc of exactExpenseDocs) {
    addRecord(records, fromExpenseDoc(doc));
  }
  for (const doc of sameDateCandidateDocs) {
    addRecord(records, fromCandidateDoc(doc));
  }
  for (const doc of sameDateExpenseDocs) {
    addRecord(records, fromExpenseDoc(doc));
  }

  return [...records.values()];
}

async function getDocsWhereIn<T>(
  collection: CollectionReference<T>,
  fieldPath: string,
  values: string[],
): Promise<QueryDocumentSnapshot<T>[]> {
  if (values.length === 0) {
    return [];
  }

  const docs: QueryDocumentSnapshot<T>[] = [];
  for (const valueChunk of chunks(values, FIRESTORE_IN_FILTER_LIMIT)) {
    const snapshot = await collection.where(fieldPath, "in", valueChunk).get();
    docs.push(...snapshot.docs);
  }

  return docs;
}

function fromCandidateDoc(
  doc: QueryDocumentSnapshot<ExpenseCandidate>,
): ExistingExpenseRecord {
  const candidate = doc.data();
  return {
    kind: "candidate",
    id: doc.id,
    transactionFingerprint: candidate.transactionFingerprint,
    occurrenceIndex: candidate.occurrenceIndex,
    postedDate: candidate.postedDate,
    direction: candidate.direction,
    amountMinor: candidate.amountMinor,
  };
}

function fromExpenseDoc(doc: QueryDocumentSnapshot<Expense>): ExistingExpenseRecord {
  const expense = doc.data();
  return {
    kind: "expense",
    id: doc.id,
    transactionFingerprint: expense.transactionFingerprint,
    occurrenceIndex: expense.occurrenceIndex,
    postedDate: expense.date,
    direction: "debit",
    amountMinor: expense.amountMinor,
  };
}

function buildExactMatchIndex(
  records: ExistingExpenseRecord[],
): Map<string, ExistingExpenseRecord> {
  const exactMatches = new Map<string, ExistingExpenseRecord>();

  for (const record of records) {
    if (
      !record.transactionFingerprint ||
      record.occurrenceIndex === undefined
    ) {
      continue;
    }

    const key = createOccurrenceKey({
      transactionFingerprint: record.transactionFingerprint,
      occurrenceIndex: record.occurrenceIndex,
    });
    const existing = exactMatches.get(key);
    if (!existing || record.kind === "expense") {
      exactMatches.set(key, record);
    }
  }

  return exactMatches;
}

function buildPossibleMatchIndex(
  records: ExistingExpenseRecord[],
): Map<string, ExistingExpenseRecord[]> {
  const possibleMatches = new Map<string, ExistingExpenseRecord[]>();

  for (const record of records) {
    const key = createPossibleMatchKey(record);
    const matches = possibleMatches.get(key) || [];
    matches.push(record);
    possibleMatches.set(key, matches);
  }

  return possibleMatches;
}

function findPossibleDuplicate(
  row: ParsedExpenseCsvRow,
  possibleMatches: Map<string, ExistingExpenseRecord[]>,
): ExistingExpenseRecord | undefined {
  const matches = possibleMatches.get(createPossibleMatchKey(row)) || [];
  const differentFingerprintMatches = matches.filter(
    (match) => match.transactionFingerprint !== row.transactionFingerprint,
  );

  return (
    differentFingerprintMatches.find((match) => match.kind === "expense") ||
    differentFingerprintMatches[0]
  );
}

function toDuplicateMatch(
  row: ParsedExpenseCsvRow,
  match: ExistingExpenseRecord,
): ExpenseImportDuplicateMatch {
  return {
    rowNumber: row.rowNumber,
    transactionFingerprint: row.transactionFingerprint,
    occurrenceIndex: row.occurrenceIndex,
    existingCandidateId: match.kind === "candidate" ? match.id : undefined,
    existingExpenseId: match.kind === "expense" ? match.id : undefined,
  };
}

function toPossibleDuplicateMatch(
  row: ParsedExpenseCsvRow,
  match: ExistingExpenseRecord,
): ExpenseImportPossibleDuplicateMatch {
  return {
    rowNumber: row.rowNumber,
    transactionFingerprint: row.transactionFingerprint,
    occurrenceIndex: row.occurrenceIndex,
    matchedCandidateId: match.kind === "candidate" ? match.id : undefined,
    matchedExpenseId: match.kind === "expense" ? match.id : undefined,
  };
}

function addRecord(
  records: Map<string, ExistingExpenseRecord>,
  record: ExistingExpenseRecord,
): void {
  records.set(`${record.kind}:${record.id}`, record);
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
