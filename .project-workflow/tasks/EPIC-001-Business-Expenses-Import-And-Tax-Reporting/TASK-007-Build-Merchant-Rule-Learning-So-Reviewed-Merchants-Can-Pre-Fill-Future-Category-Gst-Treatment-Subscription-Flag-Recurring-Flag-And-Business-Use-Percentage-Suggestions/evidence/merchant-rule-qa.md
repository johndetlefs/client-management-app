# TASK-007 Merchant Rule QA

## Automated Validation

- `npm run test:expenses`: pass, 15/15 tests.
- `npx tsc --noEmit`: pass.
- `npm run lint`: pass; existing `baseline-browser-mapping` freshness advisory only.
- `npm run build`: pass.
- `git diff --check`: pass.
- Empty-token access probe: denied with `Authentication is required`.

## Firebase Emulator Scenario

The temporary synthetic QA route exercised the real server actions and CSV
importer against Firebase Auth and Firestore emulators, then was removed.

```json
{
  "pass": true,
  "tenantId": "expense-task007-qa",
  "ruleId": "merchant_5b92afaa1dc79f928df49102",
  "checks": {
    "firstSave": true,
    "staffRefresh": true,
    "oneDeterministicRule": true,
    "refreshedFields": true,
    "firstImport": true,
    "suggestionApplied": true,
    "retrySkipped": true,
    "retryDidNotTouchRule": true,
    "retryDidNotTouchExpense": true,
    "deactivate": true,
    "inactiveRuleSkipped": true,
    "outsiderDenied": true,
    "reactivate": true,
    "expenseUpdate": true
  }
}
```

This proves owner and staff rule updates, one deterministic rule per normalized
merchant, inactive-rule behavior, cross-tenant denial, import-time suggestion
projection, and retry non-overwrite.

## Rendered Journey

The in-app Browser used the synthetic owner account at
`http://localhost:3001/workspace/expenses`.

- At 1280x900, the August `EXAMPLE SOFTWARE` candidate displayed a
  `Merchant rule suggestion` label and remained unreviewed.
- Selecting Mixed use and Confirm opened editable defaults: 80% business use,
  `Other / accountant review`, `No GST in price`, subscription false, and
  recurring true.
- The owner changed business use to 75%, selected
  `Computer, software and online services`, and enabled subscription.
- Confirmation persisted the overrides as a $41.25 business-use amount while
  retaining the source rule unchanged.
- Accounting settings displayed the deterministic active rule and its defaults.
- At 390x844, summary cards, tabs, settings, and learned-rule content remained
  readable; wide settings tables retained horizontal reachability.
- Browser console warnings/errors: none.

## Artifacts

- `merchant-rule-desktop.png`
  - SHA-256: `d66b0f6e0f27f7b1945c445c9c5e28b68b0257a507d984b47ed139ab2c9bb76b`
- `merchant-rules-mobile-viewport.png`
  - SHA-256: `ada9bdefdb643c8ea91874ada8d622a237ca22356c9c320a588d287b2566349d`
- `merchant-rules-mobile-rules.png`
  - SHA-256: `a3b4f43e529a028cbda668829b33fa27ab02ec764a0fc47dbd3c7edfa5abf310`

Source revision: `764e333c69bf4dbde53aad355bf03422cbd8fc08+working-tree`.
