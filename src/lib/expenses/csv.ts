import { createHash } from "node:crypto";

import type {
  ExpenseCandidate,
  ExpenseImportCounts,
  ExpenseTransactionDirection,
} from "@/types/expense";

export const EXPENSE_CSV_PARSER_VERSION = "bank-csv-v1";
export const EXPENSE_DEFAULT_SOURCE_ACCOUNT_KEY = "unknown-account";

const REQUIRED_HEADERS = [
  "Date",
  "Description",
  "Debit",
  "Credit",
  "Category",
  "SubCategory",
] as const;

export interface ExpenseCsvParseIssue {
  rowNumber: number;
  message: string;
}

export class ExpenseCsvParseError extends Error {
  constructor(public readonly issues: ExpenseCsvParseIssue[]) {
    super(issues.map((issue) => `Row ${issue.rowNumber}: ${issue.message}`).join("; "));
    this.name = "ExpenseCsvParseError";
  }
}

export interface ParsedExpenseCsvRow {
  rowNumber: number;
  postedDate: string;
  rawDescription: string;
  normalizedMerchantName: string;
  amountMinor: number;
  currency: string;
  direction: ExpenseTransactionDirection;
  bankCategory?: string;
  bankSubCategory?: string;
  transactionFingerprint: string;
  occurrenceIndex: number;
}

export interface ParseExpenseCsvOptions {
  currency?: string;
  sourceAccountKey?: string;
}

export interface ParsedExpenseCsvImport {
  rows: ParsedExpenseCsvRow[];
  importFingerprint: string;
  counts: ExpenseImportCounts;
}

export type ExpenseCandidateDraft = Pick<
  ExpenseCandidate,
  | "postedDate"
  | "rawDescription"
  | "normalizedMerchantName"
  | "amountMinor"
  | "currency"
  | "direction"
  | "bankCategory"
  | "bankSubCategory"
  | "transactionFingerprint"
  | "occurrenceIndex"
>;

export function parseExpenseBankCsv(
  csvText: string,
  options: ParseExpenseCsvOptions = {},
): ParsedExpenseCsvImport {
  const records = parseCsvRecords(csvText);
  const issues: ExpenseCsvParseIssue[] = [];

  if (records.length === 0) {
    throw new ExpenseCsvParseError([{ rowNumber: 1, message: "CSV is empty" }]);
  }

  const headers = records[0].map((header, index) =>
    index === 0 ? stripBom(header).trim() : header.trim(),
  );
  const hasExactHeader =
    headers.length === REQUIRED_HEADERS.length &&
    REQUIRED_HEADERS.every((header, index) => headers[index] === header);
  if (!hasExactHeader) {
    throw new ExpenseCsvParseError([
      {
        rowNumber: 1,
        message: `CSV header must exactly match: ${REQUIRED_HEADERS.join(", ")}`,
      },
    ]);
  }

  const headerIndexes = Object.fromEntries(
    REQUIRED_HEADERS.map((header) => [header, headers.indexOf(header)]),
  ) as Record<(typeof REQUIRED_HEADERS)[number], number>;

  const rows: ParsedExpenseCsvRow[] = [];
  const occurrenceCounts = new Map<string, number>();
  const currency = options.currency || "AUD";
  const sourceAccountKey =
    options.sourceAccountKey?.trim() || EXPENSE_DEFAULT_SOURCE_ACCOUNT_KEY;

  records.slice(1).forEach((record, recordIndex) => {
    const rowNumber = recordIndex + 2;
    if (record.length === 1 && record[0].trim() === "") {
      return;
    }
    if (record.length !== headers.length) {
      issues.push({
        rowNumber,
        message: `Expected ${headers.length} columns, found ${record.length}`,
      });
      return;
    }

    const rawDate = record[headerIndexes.Date]?.trim() || "";
    const rawDescription = record[headerIndexes.Description]?.trim() || "";
    const rawDebit = record[headerIndexes.Debit]?.trim() || "";
    const rawCredit = record[headerIndexes.Credit]?.trim() || "";
    const bankCategory = optionalTrimmed(record[headerIndexes.Category]);
    const bankSubCategory = optionalTrimmed(record[headerIndexes.SubCategory]);

    const postedDate = parseDateToIso(rawDate);
    if (!postedDate) {
      issues.push({ rowNumber, message: `Invalid date "${rawDate}"` });
    }
    if (!rawDescription) {
      issues.push({ rowNumber, message: "Description is required" });
    }

    const hasDebit = rawDebit.length > 0;
    const hasCredit = rawCredit.length > 0;
    if (hasDebit === hasCredit) {
      issues.push({
        rowNumber,
        message: "Exactly one of Debit or Credit must be populated",
      });
      return;
    }

    const amountMinor = parseMoneyToMinor(hasDebit ? rawDebit : rawCredit);
    if (amountMinor === null || amountMinor <= 0) {
      issues.push({
        rowNumber,
        message: `Invalid ${hasDebit ? "Debit" : "Credit"} amount`,
      });
      return;
    }

    if (!postedDate || !rawDescription) {
      return;
    }

    const direction: ExpenseTransactionDirection = hasDebit ? "debit" : "credit";
    const normalizedMerchantName = normalizeMerchantName(rawDescription);
    const transactionFingerprint = createTransactionFingerprint({
      sourceAccountKey,
      postedDate,
      direction,
      amountMinor,
      normalizedMerchantName,
    });
    const occurrenceIndex = (occurrenceCounts.get(transactionFingerprint) || 0) + 1;
    occurrenceCounts.set(transactionFingerprint, occurrenceIndex);

    rows.push({
      rowNumber,
      postedDate,
      rawDescription,
      normalizedMerchantName,
      amountMinor,
      currency,
      direction,
      bankCategory,
      bankSubCategory,
      transactionFingerprint,
      occurrenceIndex,
    });
  });

  if (issues.length > 0) {
    throw new ExpenseCsvParseError(issues);
  }

  return {
    rows,
    importFingerprint: createImportFingerprint(csvText),
    counts: {
      totalRows: records.length - 1,
      parsedRows: rows.length,
      candidateRows: rows.length,
      skippedRows: 0,
      duplicateRows: 0,
      failedRows: 0,
    },
  };
}

export function toExpenseCandidateDraft(
  row: ParsedExpenseCsvRow,
): ExpenseCandidateDraft {
  return {
    postedDate: row.postedDate,
    rawDescription: row.rawDescription,
    normalizedMerchantName: row.normalizedMerchantName,
    amountMinor: row.amountMinor,
    currency: row.currency,
    direction: row.direction,
    bankCategory: row.bankCategory,
    bankSubCategory: row.bankSubCategory,
    transactionFingerprint: row.transactionFingerprint,
    occurrenceIndex: row.occurrenceIndex,
  };
}

function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      record.push(field);
      field = "";
      continue;
    }
    if (char === "\r" || char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new ExpenseCsvParseError([{ rowNumber: records.length + 1, message: "Unclosed quote" }]);
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}

export function parseDateToIso(value: string): string | null {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return isValidDateParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
    )
      ? trimmed
      : null;
  }

  const auMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(trimmed);
  if (!auMatch) {
    return null;
  }

  const day = Number(auMatch[1]);
  const month = Number(auMatch[2]);
  const rawYear = Number(auMatch[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;

  if (!isValidDateParts(year, month, day)) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseMoneyToMinor(value: string): number | null {
  const cleaned = value.trim().replace(/[$,\s]/g, "");
  const match = /^(?:(\d+)(?:\.(\d{1,2}))?|\.(\d{1,2}))$/.exec(cleaned);
  if (!match) {
    return null;
  }

  const dollars = Number(match[1] || "0");
  const cents = Number((match[2] || match[3] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(dollars) || !Number.isSafeInteger(cents)) {
    return null;
  }

  return dollars * 100 + cents;
}

export function normalizeMerchantName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function createTransactionFingerprint(input: {
  sourceAccountKey: string;
  postedDate: string;
  direction: ExpenseTransactionDirection;
  amountMinor: number;
  normalizedMerchantName: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.sourceAccountKey,
        input.postedDate,
        input.direction,
        input.amountMinor.toString(),
        input.normalizedMerchantName,
      ].join("|"),
    )
    .digest("hex");
}

export function createImportFingerprint(sourceText: string): string {
  return createHash("sha256").update(stripBom(sourceText)).digest("hex");
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
