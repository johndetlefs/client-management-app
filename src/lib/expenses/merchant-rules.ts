import { createHash } from "node:crypto";

import type {
  ExpenseCandidateSuggestion,
  ExpenseGstTreatment,
  ExpenseMerchantRuleMatchKind,
} from "@/types/expense";

const SUPPORTED_GST_TREATMENTS = new Set<ExpenseGstTreatment>([
  "taxable_purchase",
  "gst_claimable",
  "no_gst",
  "gst_free",
  "input_taxed",
  "private_or_non_claimable",
  "review_required",
]);

export interface MatchableMerchantRule {
  id: string;
  matchKind: ExpenseMerchantRuleMatchKind;
  normalizedMerchantKey: string;
  categoryId?: string;
  gstTreatment?: ExpenseGstTreatment;
  businessUsePercent?: number;
  isSubscription?: boolean;
  isRecurring?: boolean;
  confidence: number;
  active: boolean;
}

export function normalizeMerchantRuleKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function createMerchantRuleId(merchantName: string): string {
  const normalizedKey = normalizeMerchantRuleKey(merchantName);
  if (!normalizedKey) {
    throw new Error("Merchant name is required");
  }

  return `merchant_${createHash("sha256")
    .update(normalizedKey)
    .digest("hex")
    .slice(0, 24)}`;
}

export function findMerchantRuleSuggestion(
  merchantName: string,
  rules: MatchableMerchantRule[],
): ExpenseCandidateSuggestion | undefined {
  const normalizedKey = normalizeMerchantRuleKey(merchantName);
  if (!normalizedKey) {
    return undefined;
  }

  const rule = rules
    .filter(
      (candidate) =>
        isUsableMerchantRule(candidate) &&
        normalizeMerchantRuleKey(candidate.normalizedMerchantKey) ===
          normalizedKey,
    )
    .sort(
      (left, right) =>
        right.confidence - left.confidence || left.id.localeCompare(right.id),
    )[0];

  if (!rule) {
    return undefined;
  }

  return {
    source: "user_rule",
    confidence: rule.confidence,
    merchantRuleId: rule.id,
    ...(rule.categoryId ? { categoryId: rule.categoryId } : {}),
    ...(rule.gstTreatment
      ? {
          gstTreatment:
            rule.gstTreatment === "gst_claimable"
              ? "taxable_purchase"
              : rule.gstTreatment,
        }
      : {}),
    ...(rule.businessUsePercent !== undefined
      ? { businessUsePercent: rule.businessUsePercent }
      : {}),
    ...(rule.isSubscription !== undefined
      ? { isSubscription: rule.isSubscription }
      : {}),
    ...(rule.isRecurring !== undefined
      ? { isRecurring: rule.isRecurring }
      : {}),
  };
}

function isUsableMerchantRule(rule: MatchableMerchantRule): boolean {
  if (
    !rule.active ||
    rule.matchKind !== "normalized" ||
    !rule.id ||
    !normalizeMerchantRuleKey(rule.normalizedMerchantKey) ||
    !Number.isFinite(rule.confidence) ||
    rule.confidence < 0 ||
    rule.confidence > 1
  ) {
    return false;
  }

  if (
    rule.businessUsePercent !== undefined &&
    (!Number.isInteger(rule.businessUsePercent) ||
      rule.businessUsePercent < 1 ||
      rule.businessUsePercent > 100)
  ) {
    return false;
  }

  if (
    rule.gstTreatment !== undefined &&
    !SUPPORTED_GST_TREATMENTS.has(rule.gstTreatment)
  ) {
    return false;
  }

  return Boolean(
    rule.categoryId ||
      rule.gstTreatment ||
      rule.businessUsePercent !== undefined ||
      rule.isSubscription !== undefined ||
      rule.isRecurring !== undefined,
  );
}
