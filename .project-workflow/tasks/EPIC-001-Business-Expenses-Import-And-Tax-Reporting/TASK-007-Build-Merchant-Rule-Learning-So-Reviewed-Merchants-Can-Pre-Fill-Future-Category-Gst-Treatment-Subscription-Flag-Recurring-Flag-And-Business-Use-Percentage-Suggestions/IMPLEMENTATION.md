## User Story

As a business owner, I want confirmed merchant decisions to become editable
defaults on future imports, so that recurring bookkeeping takes less time
without silently changing my records.

## Goal

Deliver deterministic tenant merchant rules, safe import-time suggestions, and
an overrideable review experience while preserving all confirmed decisions.

## Approach

- Add a pure merchant-rule module for normalized keys, deterministic IDs, rule
  validation, and suggestion projection.
- Save rules from persisted confirmed expenses through authenticated server
  actions and tenant collection helpers.
- Load active rules once per import and attach suggestions only to net-new
  candidate writes.
- Extend review rows and the confirmation UI to show and apply rule defaults.
- Prove non-overwrite, authorization, and visible behavior with focused tests,
  Firebase emulators, and the in-app Browser.

## Parent AC Coverage

- AC9

## Child Charter

### Inherited Invariants

- Authenticate the server caller; never authorize from a client-supplied user ID.
- Scope all expense data and file metadata under `tenants/{tenantId}`.
- Use transactions for consistency-sensitive imports and occurrence allocation.
- Store currency in minor units and avoid floating-point arithmetic.
- Treat merchant rules as suggestions that cannot overwrite confirmed accountant decisions.
- Preserve source privacy and do not commit personal bank data, source statements, or generated exports.
- Keep CSV as the deterministic primary input; QIF and PDF remain optional/fallback paths.

### Invalid Substitutes

- A successful lint or build does not prove authenticated server authorization, tenant isolation, Firestore transaction behavior, or visible browser behavior.
- Client-supplied tenant or user identifiers do not prove the caller's identity or authorization.
- Code inspection or an HTTP 200 response does not prove the review workspace renders correctly or that review actions work.
- Unit fixtures do not replace emulator-backed cross-tenant and idempotency evidence.
- Export generation alone does not prove accountant totals, GST calculations, or workbook reconciliation.
- BAS summaries do not constitute tax advice, lodgement, or accountant approval.

### Artifact Targets

- Tenant-scoped expense models and authenticated server access helpers.
- Deterministic CSV import batches and reviewable candidate records.
- Transaction-safe occurrence-aware idempotency.
- Rendered expense review workspace with protected review transitions.
- Confirmed expense records and accountant-controlled classification fields.
- Merchant suggestion rules and recurring/subscription detection.
- Reconciled Excel accountant export and GST/BAS preparation summaries.
- Tenant-scoped source-file/privacy controls and focused automated/emulator evidence.

### Parent AC Proof Ownership

- AC9: owner `TASK-007, TASK-013`; required evidence: Merchant-rule suggestion and non-overwrite regression evidence.

## Acceptance Criteria

- [x] AC1: Verified owner/staff users can save rules from confirmed expenses;
  unauthenticated and cross-tenant callers are denied. Parent AC9.
- [x] AC2: A normalized merchant has one deterministic updatable rule with
  stable creation audit fields. Parent AC9.
- [x] AC3: Rules persist all authorised accountant suggestion fields,
  provenance, confidence, active state, and audit metadata. Parent AC9.
- [x] AC4: New matching candidates store a `user_rule` suggestion with rule
  provenance and accountant defaults. Parent AC9.
- [x] AC5: Suggestions leave candidates unreviewed and never overwrite prior
  candidates or confirmed accountant decisions. Parent AC9.
- [x] AC6: Inactive rules do not apply and authorised users can reactivate
  them. Parent AC9.
- [x] AC7: The workspace labels, pre-fills, and permits overrides of every rule
  suggestion. Parent AC9.
- [x] AC8: Matching is deterministic and fail-closed; bank hints and amounts do
  not create learned rules. Parent AC9.

## Validation

- AC1-AC3, AC6 / parent AC9: emulator save/update/deactivate/reactivate and
  cross-tenant permission scenarios with persisted audit readback.
- AC4-AC5, AC8 / parent AC9: pure matching tests plus import/re-import emulator
  scenarios proving suggestion provenance and non-overwrite.
- AC7 / parent AC9: in-app Browser review/confirmation checks at 1280x900 and
  390x844 with responsive structured evidence.
- Static/regression: focused expense tests, lint, type-check, build,
  `git diff --check`, workflow doctor, and Epic audit.

## Task List

| ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
| 1 | Build merchant-rule domain helpers | Add deterministic normalized keys/IDs, matching, validation, and suggestion projection with focused tests. | AC2, AC3, AC4, AC6, AC8: pure rule behavior is deterministic and fail-closed. | Run focused merchant-rule tests. | Complete |
| 2 | Add secured rule persistence | Save/update/list/toggle rules from confirmed expenses using verified tenant access and stable audit fields. | AC1, AC2, AC3, AC6: owner/staff succeed and outsiders fail. | Exercise actions against Firebase emulators and inspect documents. | Complete |
| 3 | Apply rules to net-new imports | Load active rules and attach suggestions only when creating new candidates without changing review status or existing records. | AC4, AC5, AC8: matching future imports gain suggestions and repeat imports preserve records. | Run import/re-import emulator scenarios. | Complete |
| 4 | Deliver suggestion controls | Show learned suggestions, pre-fill confirmation fields, allow overrides, and expose rule activation controls. | AC6, AC7: the workflow is understandable and operable at desktop/mobile widths. | Verify in the in-app Browser at 1280x900 and 390x844. | Complete |
| 5 | Validate and review TASK-007 | Reconcile AC1-AC8 to automated, emulator, browser, and workflow evidence; run QA/code review. | AC1-AC8: evidence passes with no blocking findings. | Inspect evidence, validation output, doctor, and Epic audit. | Complete |

## Parent AC Evidence

- AC9: `evidence/merchant-rule-qa.md` records deterministic matching,
  authenticated emulator scenarios, retry non-overwrite, and rendered
  desktop/mobile override behavior. Recipe-triggered claims are backed by
  `EVIDENCE.json`.

## QA & Code Review

- Date: 2026-07-29
- Verdict: Pass
- Reviewed areas: normalized merchant matching; deterministic rule identity;
  authenticated owner/staff persistence; cross-tenant denial; active-state
  control; transactional import application; retry and confirmed-expense
  non-overwrite; audit-field and future-metadata preservation; editable
  suggestion presentation; responsive settings behavior.
- Evidence: 15 focused expense tests, synthetic owner/staff/outsider and
  re-import emulator scenarios, empty-token denial, persisted owner override,
  in-app Browser checks at 1280x900 and 390x844, clean browser console,
  `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --check`,
  passing `EVIDENCE.json` claims CLM-001 through CLM-003, `project doctor`,
  and `epic audit`.
- Findings: No blocking findings. Review hardened relearning to merge unknown
  future metadata and import-time application to re-read the active rule inside
  the candidate transaction. The temporary QA route was removed.
- Proof boundaries: local/emulator and rendered-development evidence does not
  prove deployment, production migration, or accountant acceptance. TASK-013
  remains responsible for the Epic-wide security and regression matrix.
- Workflow notes: `project doctor` passed with warnings confined to older
  CMA-001, CMA-002, and TASK-001 artifacts. `epic audit` correctly reports the
  unfinished later Epic children and historical evidence gaps.

## Retro

- Date: 2026-07-29
- Reusable lessons: Learn only from confirmed owner decisions; use exact
  normalized merchant keys and deterministic IDs; re-read a rule in the same
  transaction that creates a candidate; preserve rule creation, application,
  and unknown future metadata when relearning; never let a suggestion change
  review state or overwrite a confirmed expense.
- Conventions or agent assets updated: Added durable merchant-rule guidance to
  `.project-workflow/guidance.md`.
- Follow-up tasks: TASK-008 adds evidence-based recurrence detection. TASK-013
  owns the final all-roles and cross-account regression matrix.
- Missed in-scope work: None.

## Notes

- Task: TASK-007
- Title: Build merchant rule learning so reviewed merchants can pre-fill future category, GST treatment, subscription flag, recurring flag, and business-use percentage suggestions
- Created: 2026-07-29
