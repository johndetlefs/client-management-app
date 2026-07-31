## User Story

As a business owner, I want to confirm reviewed Business or Mixed use
transactions as accountant-ready expenses, so that the records remain useful
whether my business is not registered for GST, is currently registered, or
becomes registered later.

## Goal

Deliver an authenticated, tenant-scoped workflow that converts one reviewed
candidate into at most one confirmed expense, preserves accountant-editable
fields and source provenance, and distinguishes potential GST included from GST
currently claimable according to explicit registration dates.

## Approach

- Extend the expense and tenant settings contracts with explicit GST
  registration state, potential GST, claimable GST, calculation status, and
  review metadata.
- Keep all money calculations in pure integer helpers with focused boundary
  tests before wiring persistence.
- Secure the existing business-settings actions with verified Firebase ID
  tokens and owner/staff tenant membership before adding GST registration.
- Create tenant categories and confirmed expenses through authenticated server
  actions; use deterministic expense IDs and Firestore transactions for
  confirmation/linking.
- Extend the Expenses workspace with focused confirmation and confirmed-expense
  editing surfaces that work at desktop and mobile widths.
- Prove calculations through automated tests, data integrity and permissions
  through Firebase emulators, and visible behavior through the in-app Browser.

## Phases

1. Domain and calculation foundation: define registration/accounting contracts,
   starter categories, validation, and integer calculations.
2. Secure persistence: protect settings, manage tenant categories, confirm
   candidates transactionally, and support authenticated expense edits.
3. User workflow: add registration settings, candidate confirmation, and
   confirmed-expense inspection/editing.
4. Validation and review: run tests, emulator scenarios, responsive browser
   checks, structured evidence capture, build/lint, and QA review.

## Parent AC Coverage

- AC6, AC7, AC8

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

- AC6: owner `TASK-006, TASK-011, TASK-013`; required evidence: Confirmation/retention policy tests for Business, Mixed use, Personal, and Ignore.
- AC7: owner `TASK-006, TASK-013`; required evidence: Minor-unit claimable/GST calculation tests including rounding cases.
- AC8: owner `TASK-006, TASK-013`; required evidence: Persisted accountant-field mutation evidence.

## Acceptance Criteria

- [x] AC1: Only Business and Mixed use candidates can be confirmed; other or
  already-confirmed states do not create another expense. Parent AC6.
- [x] AC2: Concurrent/retried confirmation creates one deterministic expense and
  atomically links the source candidate. Parent AC6.
- [x] AC3: Business stores 100% use and Mixed use requires an integer 1-99%.
  Parent AC7, AC8.
- [x] AC4: Business-use claimable amount uses integer half-up minor-unit
  arithmetic. Parent AC7.
- [x] AC5: Potential GST included is calculated separately with integer
  half-up arithmetic. Parent AC7.
- [x] AC6: Claimable GST is non-zero only for an explicitly registered tenant
  in period with supporting treatment/evidence; all other cases retain zero
  claimable GST. Parent AC7, AC8.
- [x] AC7: Authorised users can manage active tenant categories and historical
  expenses preserve stable category references. Parent AC8.
- [x] AC8: Evidence status prevents an unsupported GST credit while preserving
  potential GST for review. Parent AC8.
- [x] AC9: Subscription, recurring, and notes are stored independently and can
  be corrected. Parent AC8.
- [x] AC10: Confirmed expenses preserve candidate/import/source/occurrence
  provenance and audit metadata. Parent AC6, AC8.
- [x] AC11: The workspace lists and edits confirmed fields, distinguishes
  potential from claimable GST, and explains registration suppression. Parent
  AC8.
- [x] AC12: Verified Firebase identity and tenant owner/staff membership protect
  settings, categories, confirmation, reads, and edits. Parent AC6, AC8.
- [x] AC13: Registration is explicit and effective-dated; changing dates flags
  affected expenses rather than silently changing historical credits. Parent
  AC7, AC8.

## Validation

- AC1-AC2 / parent AC6: emulator scenarios for all candidate states, retry, and
  simultaneous confirmation with one expense/candidate link.
- AC3-AC6 / parent AC7: automated integer calculation matrix including rounding,
  non-registered, unknown, in-period, out-of-period, ended registration, and
  evidence-blocked cases.
- AC7-AC10 / parent AC6, AC8: emulator inspection of category lifecycle,
  persisted accountant fields, source provenance, and audit metadata.
- AC11 / parent AC8: in-app Browser confirmation/editing checks at desktop and
  mobile widths with responsive structured evidence in `EVIDENCE.json`.
- AC12 / parent AC6, AC8: emulator-backed owner/staff success plus outsider,
  unauthenticated, supplied-identity, and cross-tenant denial.
- AC13 / parent AC7, AC8: emulator test showing registration-date changes mark
  affected expenses for review without silently mutating stored credits.
- Static/regression validation: focused tests, `npm run lint`, `npm run build`,
  `git diff --check`, and `project doctor`.

## Task List

| ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
| 1 | Establish calculation and domain contracts | Add explicit GST registration, potential/claimable GST, calculation status, starter categories, validation, and pure integer helpers. | AC3, AC4, AC5, AC6, AC8, AC13 / parent AC7, AC8: deterministic contracts and calculation matrix pass without floating-point currency arithmetic. | Run focused calculation tests and inspect boundary outputs. | Done |
| 2 | Secure settings and category management | Replace supplied-user authorization in business settings, add effective-dated GST registration, and manage tenant-scoped starter/custom categories. | AC7, AC12, AC13 / parent AC7, AC8: owner/staff succeed, outsiders fail, category history remains stable, and registration changes flag review. | Exercise settings/categories against Firebase emulators and inspect tenant documents. | Done |
| 3 | Persist and edit confirmed expenses | Add deterministic transactional confirmation plus authenticated listing/editing with validation, provenance, audit fields, and recalculation. | AC1, AC2, AC3, AC4, AC5, AC6, AC8, AC9, AC10, AC12, AC13 / parent AC6, AC7, AC8: one expense per candidate and correct stored accountant values. | Run candidate-state, concurrency, edit, and cross-tenant emulator scenarios. | Done |
| 4 | Deliver the confirmed-expense workspace | Add registration controls, confirmation inputs, category controls, and a confirmed-expense list/editor with clear potential-versus-claimable GST presentation. | AC7, AC8, AC9, AC11, AC12, AC13 / parent AC7, AC8: complete workflow is operable and coherent at desktop and mobile widths. | Use the in-app Browser at 1280x900 and 390x844; capture responsive structured evidence. | Done |
| 5 | Validate and review TASK-006 | Reconcile every child and parent AC to automated, emulator, browser, and workflow evidence; run QA/code review. | AC1-AC13 / parent AC6, AC7, AC8: all required evidence passes with no blocking findings. | Inspect `EVIDENCE.json`, QA notes, lint/build output, workflow doctor, and epic audit. | Done |

## Parent AC Evidence

- AC6: Emulator state, retry, concurrency, and reclassification scenarios
  proved one deterministic confirmed expense and source link. See CLM-001 and
  `evidence/confirmed-expense-qa.md`.
- AC7: Ten focused tests plus emulator and browser readback proved integer
  business-use/GST calculations and registration-period suppression. See
  CLM-002 and `evidence/confirmed-expense-qa.md`.
- AC8: Emulator mutations and responsive browser checks proved persisted,
  editable accountant fields, stable categories, potential-versus-claimable
  GST presentation, and registration review flags. See CLM-003 and
  `evidence/confirmed-expense-qa.md`.

## QA & Code Review

- Date: 2026-07-29
- Verdict: Pass
- Reviewed areas: verified Firebase identity and tenant authorization; owner-only
  GST registration; category lifecycle; deterministic transactional
  confirmation; candidate/expense consistency; integer money and GST
  calculations; historical registration snapshots; accountant-field editing;
  source provenance; responsive workspace behavior.
- Evidence: 10 focused tests, owner/staff/outsider and concurrency emulator
  scenarios, persisted mutation readback, in-app Browser confirmation at
  1280x900 and 390x844, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
  `git diff --check`, passing `EVIDENCE.json` claims CLM-001 through CLM-003,
  `project doctor`, and `epic audit`.
- Findings: No blocking findings. The browser pass found and resolved table
  field collision and mobile mode-label clipping before the verdict.
- Proof boundaries: local/emulator and rendered-development evidence does not
  prove deployment, accountant approval, BAS lodgement, or production data
  migration.
- Workflow notes: `project doctor` passed with warnings confined to older
  CMA-001, CMA-002, and TASK-001 artifacts. `epic audit` correctly reports the
  unfinished later Epic children and historical evidence gaps; TASK-006 remains
  in Review pending the owner's explicit completion instruction.

## Retro

- Date: 2026-07-29
- Reusable lessons: Keep GST registration independent from invoice tax defaults;
  persist potential GST separately from claimable GST; derive stale-registration
  review state without silently recalculating historical credits; use fixed
  accountant-table tracks and explicit mobile mode geometry for dense expense
  workflows.
- Conventions or agent assets updated: Added the expense GST and deterministic
  confirmation invariants to `.project-workflow/guidance.md`.
- Follow-up tasks: TASK-007 through TASK-013 remain the approved Epic sequence.
- Missed in-scope work: None.

## Notes

- Task: TASK-006
- Title: Build confirmed expense persistence with accountant fields including minor-unit amounts, business-use percentage, claimable amount, category, GST treatment, tax invoice/receipt status, subscription/recurring flags, notes, and source metadata
- Created: 2026-07-29
