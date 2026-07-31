import type { ExpenseCandidate } from "@/types/expense";

export const EXPENSE_PERSONAL_DETAIL_RETENTION_DAYS = 90;

export const EXPENSE_CANDIDATE_SENSITIVE_FIELDS = [
  "rawDescription",
  "normalizedMerchantName",
  "bankCategory",
  "bankSubCategory",
  "suggested",
  "recurrencePattern",
  "sourceFileId",
] as const satisfies ReadonlyArray<keyof ExpenseCandidate>;

export function createPersonalDetailRetentionDate(
  now: Date = new Date(),
): Date {
  return new Date(
    now.getTime() +
      EXPENSE_PERSONAL_DETAIL_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
}

export function shouldMinimizeExpenseCandidate(
  candidate: Pick<
    ExpenseCandidate,
    "reviewStatus" | "retentionStatus" | "retentionExpiresAt"
  >,
  now: Date = new Date(),
): boolean {
  if (
    (candidate.reviewStatus !== "personal" &&
      candidate.reviewStatus !== "ignored") ||
    candidate.retentionStatus !== "active" ||
    !candidate.retentionExpiresAt
  ) {
    return false;
  }

  return toDate(candidate.retentionExpiresAt).getTime() <= now.getTime();
}

function toDate(
  value: NonNullable<ExpenseCandidate["retentionExpiresAt"]>,
): Date {
  if (value instanceof Date) {
    return value;
  }
  if ("toDate" in value) {
    return value.toDate();
  }
  return new Date(value.seconds * 1000 + value.nanoseconds / 1_000_000);
}
