import {
  createImportFingerprint,
  createTransactionFingerprint,
  EXPENSE_DEFAULT_SOURCE_ACCOUNT_KEY,
  normalizeMerchantName,
  parseDateToIso,
  parseMoneyToMinor,
  type ParsedExpenseCsvImport,
  type ParsedExpenseCsvRow,
} from "@/lib/expenses/csv";
import type { ExpenseTransactionDirection } from "@/types/expense";

export const EXPENSE_QIF_PARSER_VERSION = "bank-qif-au-v1";

export interface ExpenseQifParseIssue {
  recordNumber: number;
  message: string;
}

export class ExpenseQifParseError extends Error {
  constructor(public readonly issues: ExpenseQifParseIssue[]) {
    super(
      issues
        .map((issue) => `Record ${issue.recordNumber}: ${issue.message}`)
        .join("; "),
    );
    this.name = "ExpenseQifParseError";
  }
}

export function parseExpenseBankQif(
  qifText: string,
  options: {
    currency?: string;
    sourceAccountKey?: string;
  } = {},
): ParsedExpenseCsvImport {
  const normalizedText = stripBom(qifText).replace(/\r\n?/g, "\n");
  const lines = normalizedText.split("\n");
  while (lines.at(-1) === "") lines.pop();
  if (lines[0]?.trim() !== "!Type:Bank") {
    throw new ExpenseQifParseError([
      {
        recordNumber: 1,
        message: "QIF header must be !Type:Bank",
      },
    ]);
  }

  const rawRecords: string[][] = [];
  let current: string[] = [];
  for (const line of lines.slice(1)) {
    if (line === "^") {
      rawRecords.push(current);
      current = [];
    } else if (line.trim()) {
      current.push(line);
    }
  }
  if (current.length > 0) {
    throw new ExpenseQifParseError([
      {
        recordNumber: rawRecords.length + 1,
        message: "QIF record is missing its ^ terminator",
      },
    ]);
  }
  if (rawRecords.length === 0) {
    throw new ExpenseQifParseError([
      { recordNumber: 1, message: "QIF contains no transaction records" },
    ]);
  }

  const issues: ExpenseQifParseIssue[] = [];
  const rows: ParsedExpenseCsvRow[] = [];
  const occurrenceCounts = new Map<string, number>();
  const sourceAccountKey =
    options.sourceAccountKey?.trim() || EXPENSE_DEFAULT_SOURCE_ACCOUNT_KEY;
  const currency = options.currency || "AUD";

  rawRecords.forEach((record, recordIndex) => {
    const recordNumber = recordIndex + 1;
    const fields = collectFields(record);
    if (fields.has("S") || fields.has("E") || fields.has("$")) {
      issues.push({
        recordNumber,
        message: "Split transactions are not supported",
      });
      return;
    }

    const rawDate = singleField(fields, "D", recordNumber, issues);
    const rawAmount = singleField(fields, "T", recordNumber, issues);
    const payee = optionalSingleField(fields, "P", recordNumber, issues);
    const memo = optionalSingleField(fields, "M", recordNumber, issues);
    const rawDescription = payee || memo || "";
    const postedDate = rawDate ? parseDateToIso(rawDate) : null;
    if (!postedDate) {
      issues.push({ recordNumber, message: "Date is invalid" });
    }
    if (!rawDescription) {
      issues.push({
        recordNumber,
        message: "Payee or memo description is required",
      });
    }
    const amount = rawAmount ? parseSignedAmount(rawAmount) : null;
    if (!amount) {
      issues.push({
        recordNumber,
        message: "Signed amount must be a non-zero value with at most 2 decimals",
      });
    }
    if (!postedDate || !rawDescription || !amount) {
      return;
    }

    const normalizedMerchantName = normalizeMerchantName(rawDescription);
    const transactionFingerprint = createTransactionFingerprint({
      sourceAccountKey,
      postedDate,
      direction: amount.direction,
      amountMinor: amount.amountMinor,
      normalizedMerchantName,
    });
    const occurrenceIndex =
      (occurrenceCounts.get(transactionFingerprint) || 0) + 1;
    occurrenceCounts.set(transactionFingerprint, occurrenceIndex);
    const categories = fields.get("L") || [];

    rows.push({
      rowNumber: recordNumber,
      postedDate,
      rawDescription,
      normalizedMerchantName,
      amountMinor: amount.amountMinor,
      currency,
      direction: amount.direction,
      bankCategory: optionalTrimmed(categories[0]),
      bankSubCategory: optionalTrimmed(categories[1]),
      transactionFingerprint,
      occurrenceIndex,
    });
  });

  if (issues.length > 0) {
    throw new ExpenseQifParseError(issues);
  }
  return {
    rows,
    importFingerprint: createImportFingerprint(normalizedText),
    counts: {
      totalRows: rawRecords.length,
      parsedRows: rows.length,
      candidateRows: rows.length,
      skippedRows: 0,
      duplicateRows: 0,
      failedRows: 0,
    },
  };
}

function collectFields(lines: string[]): Map<string, string[]> {
  const fields = new Map<string, string[]>();
  for (const line of lines) {
    const prefix = line[0] || "";
    const values = fields.get(prefix) || [];
    values.push(line.slice(1).trim());
    fields.set(prefix, values);
  }
  return fields;
}

function singleField(
  fields: Map<string, string[]>,
  prefix: string,
  recordNumber: number,
  issues: ExpenseQifParseIssue[],
): string | undefined {
  const values = fields.get(prefix) || [];
  if (values.length !== 1 || !values[0]) {
    issues.push({
      recordNumber,
      message: `${prefix} field must occur exactly once`,
    });
    return undefined;
  }
  return values[0];
}

function optionalSingleField(
  fields: Map<string, string[]>,
  prefix: string,
  recordNumber: number,
  issues: ExpenseQifParseIssue[],
): string | undefined {
  const values = fields.get(prefix) || [];
  if (values.length > 1) {
    issues.push({
      recordNumber,
      message: `${prefix} field cannot occur more than once`,
    });
    return undefined;
  }
  return optionalTrimmed(values[0]);
}

function parseSignedAmount(value: string): {
  direction: ExpenseTransactionDirection;
  amountMinor: number;
} | null {
  const cleaned = value.trim().replace(/[$,\s]/g, "");
  const sign = cleaned[0] === "-" || cleaned[0] === "+" ? cleaned[0] : "+";
  const unsigned = sign === "+" && cleaned[0] !== "+" ? cleaned : cleaned.slice(1);
  const amountMinor = parseMoneyToMinor(unsigned);
  if (amountMinor === null || amountMinor <= 0) {
    return null;
  }
  return {
    direction: sign === "-" ? "debit" : "credit",
    amountMinor,
  };
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
