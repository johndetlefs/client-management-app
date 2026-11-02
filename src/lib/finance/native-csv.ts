import { createHash } from "node:crypto";
import { parseCsvRecords, parseDateToIso } from "@/lib/expenses/csv";
import { add, parseSignedMoney } from "./money";
import type { CsvMapping, Movement, StatementControl } from "./types";

export const NATIVE_PARSER_VERSION = "native-au-csv-2";
export const nativeMapping: CsvMapping = { date: "Date", description: "Description", debit: "Debit", credit: "Credit" };
export function identity(...parts: (string | number)[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
export function resourceId(value: unknown, name = "ID"): asserts value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error(`Invalid ${name}`);
}
export function financialDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || parseDateToIso(value) !== value) throw new Error("Use a valid YYYY-MM-DD date");
  return value;
}

export function parseNativeStatement(text: string, accountId: string, mapping: CsvMapping = nativeMapping) {
  resourceId(accountId, "account");
  if (typeof text !== "string" || text.length > 8_000_000) throw new Error("CSV must be at most 8 MB");
  // Line-ending conversions do not create a different financial source. Retain
  // the exact UTF-8 file hash separately from this canonical import identity.
  const canonicalText = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const records = parseCsvRecords(canonicalText);
  if (records.length < 2 || records.length > 5001) throw new Error("CSV must contain 1–5,000 movements");
  const headers = records[0].map((v) => v.trim());
  const used = [mapping.date, mapping.description, mapping.debit, mapping.credit, mapping.balance].filter(Boolean) as string[];
  if (new Set(used).size !== used.length) throw new Error("Each mapped field needs a different column");
  for (const field of used) if (headers.filter((h) => h === field).length !== 1) throw new Error(`Mapped column is missing or ambiguous: ${field}`);
  const sourceHash = identity(canonicalText);
  const rawSourceHash = createHash("sha256").update(text, "utf8").digest("hex");
  const counts = new Map<string, number>();
  const rows: Movement[] = [];
  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    if (record.every((v) => !v.trim())) continue;
    if (record.length < headers.length || record.slice(headers.length).some((v) => v.trim())) throw new Error(`Row ${i + 1}: unexpected columns`);
    const field = (name?: string) => name ? (record[headers.indexOf(name)] || "").trim() : "";
    const date = parseDateToIso(field(mapping.date));
    if (!date) throw new Error(`Row ${i + 1}: invalid date`);
    const description = field(mapping.description);
    if (!description || description.length > 1500) throw new Error(`Row ${i + 1}: description required (maximum 1,500 characters)`);
    const debit = field(mapping.debit), credit = field(mapping.credit);
    if (Boolean(debit) === Boolean(credit)) throw new Error(`Row ${i + 1}: exactly one debit or credit required`);
    const amount = parseSignedMoney(debit || credit);
    if (amount <= 0) throw new Error(`Row ${i + 1}: debit/credit must be positive`);
    const amountMinor = debit ? -amount : amount;
    const fingerprint = identity(accountId, "AUD", date, amountMinor, description.replace(/\s+/g, " ").toUpperCase());
    const occurrence = (counts.get(fingerprint) || 0) + 1;
    counts.set(fingerprint, occurrence);
    const balance = field(mapping.balance);
    rows.push({ id: identity(fingerprint, occurrence), accountId, date, amountMinor, currency: "AUD", description, fingerprint, occurrence, sourceRow: i + 1, sourceHash, ...(balance ? { balanceMinor: parseSignedMoney(balance) } : {}), kind: "unreviewed", revision: 0 });
  }
  if (!rows.length) throw new Error("No movements in CSV");
  const dates = rows.map((r) => r.date).sort();
  return { rows, sourceHash, rawSourceHash, start: dates[0], end: dates.at(-1)!, debitMinor: add(...rows.filter((r) => r.amountMinor < 0).map((r) => -r.amountMinor)), creditMinor: add(...rows.filter((r) => r.amountMinor > 0).map((r) => r.amountMinor)), mapping, parserVersion: NATIVE_PARSER_VERSION };
}

/** Running balances prove continuity; a separately supplied opening control proves the period. */
export function reconcileStatement(rows: Movement[], openingMinor?: number, closingMinor?: number): StatementControl {
  const movementMinor = add(...rows.map((r) => r.amountMinor));
  if (!rows.length) throw new Error("A statement must have movements");
  const withBalances = rows.every((r) => r.balanceMinor !== undefined);
  if (!withBalances && (openingMinor === undefined || closingMinor === undefined)) return { state: "missing_balances", openingMinor: openingMinor ?? null, closingMinor: closingMinor ?? null, movementMinor, varianceMinor: null, balanceBreaks: 0, note: "Missing statement balance controls. Movement totals alone do not prove a complete account." };
  const evaluate = (ordered: Movement[]) => ordered.slice(1).filter((r, i) => add(ordered[i].balanceMinor!, r.amountMinor) !== r.balanceMinor).length;
  const forwardBreaks = withBalances ? evaluate(rows) : 0;
  const reverse = [...rows].reverse();
  const reverseBreaks = withBalances ? evaluate(reverse) : 0;
  const ordered = withBalances && reverseBreaks < forwardBreaks ? reverse : rows;
  const breaks = Math.min(forwardBreaks, reverseBreaks);
  const opening = openingMinor ?? add(ordered[0].balanceMinor!, -ordered[0].amountMinor);
  const closing = closingMinor ?? ordered.at(-1)!.balanceMinor!;
  const varianceMinor = add(opening, movementMinor, -closing);
  const rowOpeningMismatch = withBalances && openingMinor !== undefined && add(openingMinor, ordered[0].amountMinor) !== ordered[0].balanceMinor;
  const rowClosingMismatch = withBalances && closingMinor !== undefined && closingMinor !== ordered.at(-1)!.balanceMinor;
  const balanceBreaks = breaks + Number(rowOpeningMismatch) + Number(rowClosingMismatch);
  return { state: varianceMinor || balanceBreaks ? "variance" : openingMinor === undefined ? "opening_unverified" : "balanced", openingMinor: opening, closingMinor: closing, movementMinor, varianceMinor, balanceBreaks, note: openingMinor === undefined ? "Running balance continuity checked; opening derived from first row, awaiting independent statement opening control." : "Opening plus signed credits/debits compared with closing and each available running balance." };
}

/** Partial-day exports of identical postings cannot establish occurrence identity. Fail explicitly. */
export function resolveMovementImport(rows: Movement[], existing: Movement[], completeDays: boolean) {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const incomingCounts = new Map<string, number>(), existingCounts = new Map<string, number>();
  for (const r of rows) incomingCounts.set(r.fingerprint, (incomingCounts.get(r.fingerprint) || 0) + 1);
  for (const r of existing) existingCounts.set(r.fingerprint, (existingCounts.get(r.fingerprint) || 0) + 1);
  for (const [fingerprint, count] of incomingCounts) {
    const oldCount = existingCounts.get(fingerprint) || 0;
    const knownSource = rows.filter((r) => r.fingerprint === fingerprint).every((r) => byId.get(r.id)?.sourceHash === r.sourceHash);
    if (oldCount && !knownSource && (!completeDays || count < oldCount)) throw new Error("Ambiguous overlapping identical movements. Import complete days or review the source before continuing.");
  }
  for (const r of rows) {
    const old = byId.get(r.id);
    if (old && (old.accountId !== r.accountId || old.date !== r.date || old.amountMinor !== r.amountMinor)) throw new Error("Movement identity conflict");
  }
  return { newRows: rows.filter((r) => !byId.has(r.id)), duplicates: rows.filter((r) => byId.has(r.id)).length };
}
