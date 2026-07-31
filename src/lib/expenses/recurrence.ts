import type {
  ExpenseRecurrenceCadence,
  ExpenseRecurrencePatternEvidence,
} from "@/types/expense";

import { normalizeMerchantRuleKey } from "./merchant-rules";

export const EXPENSE_RECURRENCE_VERSION = "recurrence-v1";
export const EXPENSE_RECURRENCE_HISTORY_MONTHS = 26;

export interface ExpenseRecurrenceOccurrence {
  postedDate: string;
  normalizedMerchantName: string;
  amountMinor: number;
  currency: string;
}

const CADENCE_WINDOWS: Array<{
  cadence: ExpenseRecurrenceCadence;
  minDays: number;
  maxDays: number;
}> = [
  { cadence: "weekly", minDays: 5, maxDays: 9 },
  { cadence: "fortnightly", minDays: 12, maxDays: 16 },
  { cadence: "monthly", minDays: 25, maxDays: 35 },
  { cadence: "quarterly", minDays: 80, maxDays: 100 },
  { cadence: "annual", minDays: 350, maxDays: 380 },
];

export function detectExpenseRecurrencePattern(input: {
  normalizedMerchantName: string;
  currency: string;
  occurrences: ExpenseRecurrenceOccurrence[];
}): ExpenseRecurrencePatternEvidence | undefined {
  const merchantKey = normalizeMerchantRuleKey(input.normalizedMerchantName);
  const matching = input.occurrences
    .filter(
      (occurrence) =>
        normalizeMerchantRuleKey(occurrence.normalizedMerchantName) ===
          merchantKey &&
        occurrence.currency === input.currency &&
        Number.isSafeInteger(occurrence.amountMinor) &&
        occurrence.amountMinor > 0 &&
        isIsoDate(occurrence.postedDate),
    )
    .sort((left, right) => left.postedDate.localeCompare(right.postedDate));
  if (!merchantKey || matching.length < 3) {
    return undefined;
  }

  const latestDate = matching.at(-1)?.postedDate;
  if (!latestDate) {
    return undefined;
  }
  const cutoffDate = createExpenseRecurrenceCutoffDate(latestDate);
  const inWindow = matching.filter(
    (occurrence) => occurrence.postedDate >= cutoffDate,
  );
  const byDate = new Map<string, number[]>();
  for (const occurrence of inWindow) {
    const amounts = byDate.get(occurrence.postedDate) ?? [];
    amounts.push(occurrence.amountMinor);
    byDate.set(occurrence.postedDate, amounts);
  }

  const datedAmounts = [...byDate.entries()]
    .map(([postedDate, amounts]) => ({
      postedDate,
      amountMinor: medianInteger(amounts),
    }))
    .sort((left, right) => left.postedDate.localeCompare(right.postedDate));
  if (datedAmounts.length < 3) {
    return undefined;
  }

  const intervals = datedAmounts.slice(1).map((occurrence, index) =>
    daysBetween(datedAmounts[index].postedDate, occurrence.postedDate),
  );
  const cadenceWindow = CADENCE_WINDOWS.find(({ minDays, maxDays }) =>
    intervals.every((days) => days >= minDays && days <= maxDays),
  );
  if (!cadenceWindow) {
    return undefined;
  }

  const amounts = datedAmounts.map((occurrence) => occurrence.amountMinor);
  const medianAmountMinor = medianInteger(amounts);
  const amountBounds = amounts.reduce(
    (bounds, amount) => ({
      min: Math.min(bounds.min, amount),
      max: Math.max(bounds.max, amount),
    }),
    { min: amounts[0], max: amounts[0] },
  );
  const amountRangeMinor = amountBounds.max - amountBounds.min;
  const stabilityToleranceMinor = Math.max(
    100,
    Math.floor((medianAmountMinor * 5) / 100),
  );
  const amountStable = amountRangeMinor <= stabilityToleranceMinor;
  const isSubscriptionLike =
    amountStable &&
    (cadenceWindow.cadence === "monthly" ||
      cadenceWindow.cadence === "annual");
  const intervalBounds = intervals.reduce(
    (bounds, interval) => ({
      min: Math.min(bounds.min, interval),
      max: Math.max(bounds.max, interval),
    }),
    { min: intervals[0], max: intervals[0] },
  );
  const minIntervalDays = intervalBounds.min;
  const maxIntervalDays = intervalBounds.max;
  const supportPoints = Math.min(15, (datedAmounts.length - 3) * 5);
  const stabilityPoints = amountStable ? 5 : 0;
  const regularityPoints = Math.max(
    0,
    5 - Math.min(5, maxIntervalDays - minIntervalDays),
  );
  const confidence = Math.min(
    0.98,
    (75 + supportPoints + stabilityPoints + regularityPoints) / 100,
  );

  return {
    algorithmVersion: EXPENSE_RECURRENCE_VERSION,
    cadence: cadenceWindow.cadence,
    occurrenceCount: datedAmounts.length,
    firstDate: datedAmounts[0].postedDate,
    lastDate: datedAmounts.at(-1)?.postedDate ?? datedAmounts[0].postedDate,
    minIntervalDays,
    maxIntervalDays,
    medianAmountMinor,
    amountRangeMinor,
    amountStable,
    isSubscriptionLike,
    confidence,
  };
}

function medianInteger(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function daysBetween(left: string, right: string): number {
  return Math.round(
    (Date.parse(`${right}T00:00:00.000Z`) -
      Date.parse(`${left}T00:00:00.000Z`)) /
      86_400_000,
  );
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function createExpenseRecurrenceCutoffDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - EXPENSE_RECURRENCE_HISTORY_MONTHS);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}
