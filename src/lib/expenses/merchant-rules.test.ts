import assert from "node:assert/strict";
import test from "node:test";

import {
  createMerchantRuleId,
  findMerchantRuleSuggestion,
  normalizeMerchantRuleKey,
  type MatchableMerchantRule,
} from "./merchant-rules";

function rule(
  overrides: Partial<MatchableMerchantRule> = {},
): MatchableMerchantRule {
  return {
    id: "merchant-rule",
    matchKind: "normalized",
    normalizedMerchantKey: "EXAMPLE SOFTWARE",
    categoryId: "software",
    gstTreatment: "taxable_purchase",
    businessUsePercent: 100,
    isSubscription: true,
    isRecurring: true,
    confidence: 1,
    active: true,
    ...overrides,
  };
}

test("normalizes whitespace and case for deterministic matching", () => {
  assert.equal(
    normalizeMerchantRuleKey("  Example   Software "),
    "EXAMPLE SOFTWARE",
  );
  assert.equal(
    createMerchantRuleId("Example Software"),
    createMerchantRuleId("  EXAMPLE   SOFTWARE "),
  );
});

test("projects an active normalized rule into an editable suggestion", () => {
  assert.deepEqual(
    findMerchantRuleSuggestion("example software", [rule()]),
    {
      source: "user_rule",
      confidence: 1,
      merchantRuleId: "merchant-rule",
      categoryId: "software",
      gstTreatment: "taxable_purchase",
      businessUsePercent: 100,
      isSubscription: true,
      isRecurring: true,
    },
  );
});

test("selects the highest-confidence matching rule deterministically", () => {
  const suggestion = findMerchantRuleSuggestion("EXAMPLE SOFTWARE", [
    rule({ id: "lower", confidence: 0.7 }),
    rule({ id: "higher", confidence: 0.9 }),
  ]);

  assert.equal(suggestion?.merchantRuleId, "higher");
});

test("inactive, unsupported, malformed, and non-matching rules fail closed", () => {
  assert.equal(
    findMerchantRuleSuggestion("EXAMPLE SOFTWARE", [
      rule({ active: false }),
      rule({ matchKind: "contains" }),
      rule({ businessUsePercent: 0 }),
      rule({ normalizedMerchantKey: "ANOTHER MERCHANT" }),
    ]),
    undefined,
  );
});

test("legacy GST treatment is normalized in suggestions", () => {
  assert.equal(
    findMerchantRuleSuggestion("EXAMPLE SOFTWARE", [
      rule({ gstTreatment: "gst_claimable" }),
    ])?.gstTreatment,
    "taxable_purchase",
  );
});
