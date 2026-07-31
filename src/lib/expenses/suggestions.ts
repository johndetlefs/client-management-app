import type {
  ExpenseCandidateSuggestion,
  ExpenseRecurrencePatternEvidence,
} from "@/types/expense";

export interface ResolvedExpenseSuggestion {
  suggestion?: ExpenseCandidateSuggestion;
  recurrencePattern?: ExpenseRecurrencePatternEvidence;
}

export function resolveExpenseSuggestion(
  merchantRuleSuggestion: ExpenseCandidateSuggestion | undefined,
  recurrencePattern: ExpenseRecurrencePatternEvidence | undefined,
): ResolvedExpenseSuggestion {
  if (!recurrencePattern) {
    return merchantRuleSuggestion
      ? { suggestion: merchantRuleSuggestion }
      : {};
  }

  if (!merchantRuleSuggestion) {
    return {
      suggestion: {
        source: "recurring_pattern",
        confidence: recurrencePattern.confidence,
        isRecurring: true,
        isSubscription: recurrencePattern.isSubscriptionLike,
      },
      recurrencePattern,
    };
  }

  const recurringConflict =
    typeof merchantRuleSuggestion.isRecurring === "boolean" &&
    merchantRuleSuggestion.isRecurring !== true;
  const subscriptionConflict =
    typeof merchantRuleSuggestion.isSubscription === "boolean" &&
    merchantRuleSuggestion.isSubscription !==
      recurrencePattern.isSubscriptionLike;
  const recurrenceWithConflict = {
    ...recurrencePattern,
    ...(recurringConflict || subscriptionConflict
      ? { conflictsWithMerchantRule: true }
      : {}),
  };

  return {
    suggestion: {
      ...merchantRuleSuggestion,
      isRecurring: merchantRuleSuggestion.isRecurring ?? true,
      isSubscription:
        merchantRuleSuggestion.isSubscription ??
        recurrencePattern.isSubscriptionLike,
    },
    recurrencePattern: recurrenceWithConflict,
  };
}
