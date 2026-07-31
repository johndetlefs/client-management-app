# TASK-008 Recurring Detection QA

## Automated Validation

- `npm run test:expenses`: pass, 24/24 tests.
- Recurrence coverage: month-end monthly, weekly, same-day collapse, unstable
  amounts, irregular dates, cross-currency evidence, malformed dates,
  26-month history exclusion, rule conflict, and pattern-only defaults.
- `npx tsc --noEmit`: pass.
- `npm run lint`: pass; existing `baseline-browser-mapping` freshness advisory
  only.
- `npm run build`: pass.
- `git diff --check`: pass.

## Firebase Emulator Scenario

The temporary synthetic QA route exercised the real import action, tenant
history queries, Firestore candidate transaction, rule re-read, and retry path,
then was removed.

```json
{
  "pass": true,
  "tenantId": "expense-task008-qa",
  "checks": {
    "firstImport": true,
    "patternPersisted": true,
    "retrySkipped": true,
    "conflictImport": true,
    "explicitRuleWins": true,
    "irregularImport": true,
    "irregularSkipped": true,
    "protectedPersonalUnchanged": true,
    "protectedExpenseUnchanged": true,
    "outsiderDenied": true
  }
}
```

The scenario proves monthly pattern-only suggestions, irregular-pattern
rejection, exact retry skipping, explicit false rule flags winning over a
subscription-like pattern, retained conflict evidence, protected Personal and
confirmed records remaining unchanged, and cross-tenant denial.

After QA review moved the 26-month cutoff into the Firestore query itself, a
disposable direct-action probe used a new synthetic merchant and the configured
emulator project. It returned:

```json
{"success":true,"candidateRows":3,"persistedPatternRows":3}
```

This proves the compound tenant history query and post-review transaction path
with the final source. The required candidate and expense composite indexes are
recorded in `firestore.indexes.json`.

## Rendered Journey

The in-app Browser used a synthetic tenant owner at
`http://localhost:3001/workspace/expenses`.

- Pattern-only candidates displayed `Likely monthly recurring` and
  `Subscription-like` while remaining unreviewed.
- The confirmation form explained three distinct dates and preselected
  Subscription and Recurring.
- The owner cleared Subscription and confirmed; the stored expense retained
  Recurring without Subscription.
- Conflicting-rule candidates displayed `Merchant rule suggestion`,
  `Likely monthly recurring`, `Subscription-like`, and `Saved rule differs`.
- The conflict form kept both explicit saved-rule flags unchecked and displayed
  the repeated monthly evidence separately.
- The desktop layout at 1280x900 and mobile layout at 390x844 remained readable
  and operable.
- Browser console warnings/errors: none.

## Artifacts

- `recurring-pattern-desktop.png`
  - SHA-256: `24106947025e872c095463acd8c2a4441daf0c2334a895954cb40b7a60455f94`
- `recurring-rule-conflict-desktop.png`
  - SHA-256: `ffd520efa73d0fd8307793d51a3f3af4629515dcaed39d9d3bef870ed1b78fd8`
- `recurring-rule-conflict-mobile.png`
  - SHA-256: `af24cd1cf289171ddb4224df7979003ae688474c02b2d1d1117b4872a27044ae`
- `recurring-rule-conflict-mobile-detail.png`
  - SHA-256: `06a6020bbfe1e4cb458b9f5f95eaafef3fa159685f94d2942840cbbba525809b`

Source revision: `764e333c69bf4dbde53aad355bf03422cbd8fc08+working-tree`.
