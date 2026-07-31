# TASK-006 Confirmed Expense Evidence

- Date: 2026-07-29
- Source: `764e333c69bf4dbde53aad355bf03422cbd8fc08+working-tree`
- Runtime: `http://localhost:3001` with Firebase Auth and Firestore emulators
- Data: synthetic QA tenant and transactions only

## Automated Validation

- `npm run test:expenses`: 10 tests passed. The matrix covered registered,
  non-registered, pre-registration, mixed-use integer rounding, evidence
  thresholds, non-creditable treatments, changed registration snapshots, and
  invalid inputs.
- `npm run lint`: passed, with only the existing stale
  `baseline-browser-mapping` data advisory.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed and included `/workspace/expenses`.
- `git diff --check`: passed.

## Emulator Probe

A temporary local-only QA route seeded synthetic users and tenant data, then
called the production server actions against the emulators. The route was
removed after the probe. Result:

```json
{
  "pass": true,
  "tenantId": "expense-task006-qa",
  "checks": {
    "starterCategories": 16,
    "ownerSettingsAuthorized": true,
    "staffSettingsDenied": true,
    "outsiderDenied": true,
    "concurrentSuccesses": 1,
    "concurrentRejections": 1,
    "expenseCount": 3,
    "mixedClaimableAmountMinor": 35200,
    "mixedGstAmountMinor": 3200,
    "historicalGstUnchanged": 909,
    "registrationReviewFlag": true,
    "confirmedReclassificationDenied": true
  }
}
```

The probe also verified that Personal, Ignore, and already-confirmed candidates
were rejected, category edits preserved historical references, and a user
without tenant membership could not read or mutate the accounting data.

## Browser Journey

The in-app Browser signed in as the synthetic tenant owner and confirmed a
reviewed Business candidate dated 15 July 2026 while the tenant registration
started on 1 August 2026.

- Gross and business-use amount: `$121.00`.
- Potential GST included: `$11.00`.
- GST currently claimable: `$0.00`.
- Explanation: `Outside the GST registration period`.
- Result: the candidate moved to Confirmed and the confirmed count increased
  from three to four.

The confirmed-expense table displayed the stored category, notes, amount,
business-use percentage, potential GST, claimable GST, registration review
flags, and edit action. Accounting settings displayed the explicit effective
registration date and the tenant category set.

## Responsive Evidence

- `confirmed-expenses-desktop-1280x900.png`
  - SHA-256:
    `02c5f6e7c3f503dd85054462699bf152340935b170f5a90ab7bdbedb9497b449`
- `confirmed-expenses-mobile-390x844.png`
  - SHA-256:
    `5419663e28a6b84f7ca7e3d0a9dc91a4aa7f2f170c08f5ffd4d67ac0dfa285ea`

At 1280x900, explicit table tracks kept merchant, category, amounts, GST
status, and actions separate. At 390x844, all three workspace mode labels
remained visible and the dense accountant table was horizontally scrollable
without resizing or overlapping the surrounding layout.

## Evidence Boundaries

- The checks prove local code, emulator-backed authorization/data integrity,
  and rendered local UI behavior.
- They do not prove production deployment, accountant approval, ATO
  correctness beyond the implemented requirements, or BAS lodgement.
