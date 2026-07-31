## User Story

As a business owner, I want repeated transactions and explicit merchant rules
to flag likely recurrence and subscriptions, so that I can review regular
outgoings quickly without the software making final accounting decisions.

## Goal

Deliver deterministic repeated-pattern evidence, rule precedence, and an
editable review presentation for parent AC10.

## Approach

- Add a pure recurrence detector with explicit cadence and amount-stability
  policy.
- Query tenant-scoped history only for merchants present in the current import.
- Persist evidence independently from the winning editable suggestion.
- Preserve active learned-rule precedence and expose conflicts.
- Prove behavior through focused tests, Firebase emulators, and the in-app
  Browser.

## Parent AC Coverage

- AC10

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

- AC10: owner `TASK-008, TASK-013`; required evidence: Rule-match and repeated-pattern detection tests.

## Acceptance Criteria

- [x] AC1: Supported cadence requires at least three distinct in-window dates;
  same-day duplicates and insufficient history fail closed.
- [x] AC2: Only stable monthly or annual patterns infer subscription-like;
  supported non-monthly or unstable patterns infer recurrence at most.
- [x] AC3: Candidates persist deterministic cadence, occurrence, date-span,
  stability, confidence, and algorithm-version evidence.
- [x] AC4: Active learned-rule flags win conflicts without discarding repeated
  pattern evidence.
- [x] AC5: Suggestions remain editable and unreviewed and cannot mutate existing
  candidates or confirmed expenses.
- [x] AC6: Desktop and mobile workspace states clearly distinguish user-rule,
  recurring-pattern, and conflict evidence.

## Validation

- AC1-AC3: focused pure recurrence tests plus persisted emulator readback.
- AC4-AC5: rule-conflict, pattern-only, retry, and non-overwrite emulator
  scenarios.
- AC6: in-app Browser checks at 1280x900 and 390x844.
- Static/regression: complete expense tests, type-check, lint, build,
  `git diff --check`, workflow doctor, and Epic audit.

## Task List

| ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
| 1 | Build recurrence detector | Implement cadence, distinct-date, history-window, amount-stability, confidence, and subscription policy with pure tests. | AC1, AC2, AC3 | Run focused recurrence tests. | Complete |
| 2 | Integrate tenant history | Load matching-merchant history, persist pattern evidence, and apply pattern-only defaults during net-new candidate creation. | AC1, AC3, AC5 | Exercise first import, later import, and retry in emulators. | Complete |
| 3 | Preserve rule precedence | Keep active user-rule flags authoritative and retain explicit pattern conflict evidence. | AC4, AC5 | Exercise agreeing and conflicting rule scenarios. | Complete |
| 4 | Deliver review presentation | Label cadence, subscription-like evidence, and rule conflicts while retaining editable confirmation controls. | AC5, AC6 | Verify desktop and mobile rendered journeys. | Complete |
| 5 | Validate and review TASK-008 | Reconcile all criteria to automated, emulator, browser, and workflow evidence; run QA/code review. | AC1-AC6 | Inspect evidence, doctor, and Epic audit. | Complete |

## Parent AC Evidence

- AC10: `evidence/recurring-detection-qa.md` records pure cadence tests,
  emulator persistence and non-overwrite checks, rule-conflict precedence, and
  rendered desktop/mobile behavior. Recipe-triggered claims are backed by
  `EVIDENCE.json`.

## QA & Code Review

- Date: 2026-07-29
- Verdict: Pass
- Reviewed areas: cadence boundaries; distinct-date and same-day behavior;
  amount stability; currency and malformed-history exclusion; 26-month query
  bound; tenant-scoped matching-merchant reads; composite indexes; pattern-only
  defaults; explicit-rule conflict precedence; retry non-overwrite; protected
  record stability; responsive review presentation.
- Evidence: 24 focused expense tests, synthetic emulator import/retry/conflict/
  irregular/outsider scenarios, post-review bounded-query direct-action probe,
  persisted owner override, in-app Browser checks at 1280x900 and 390x844,
  clean browser console, `npm run lint`, `npx tsc --noEmit`, `npm run build`,
  valid `firestore.indexes.json`, `git diff --check`, passing `EVIDENCE.json`
  claims CLM-001 through CLM-003, `project doctor`, and `epic audit`.
- Findings: No blocking findings. Review moved the 26-month cutoff from an
  in-memory-only filter into the Firestore history query, added the required
  composite indexes, and replaced spread-based bounds with reductions.
- Proof boundaries: local/emulator and rendered-development evidence does not
  prove deployed Firestore index readiness, production performance, or
  accountant acceptance. TASK-013 remains responsible for the Epic-wide
  security and regression matrix.
- Workflow notes: `project doctor` passed with warnings confined to older
  CMA-001, CMA-002, and TASK-001 artifacts after the FIX-002 reference was
  clarified. `epic audit` correctly reports unfinished later children and
  historical evidence gaps.

## Retro

- Date: 2026-07-29
- Reusable lessons: Require three distinct dates; collapse same-day
  occurrences; keep cadence and subscription inference separate; store compact
  evidence rather than source record IDs; bound both analysis and database
  reads; let explicit user rules win without hiding contradictory evidence.
- Conventions or agent assets updated: Added durable recurrence suggestion and
  bounded-history guidance to `.project-workflow/guidance.md`.
- Follow-up tasks: TASK-013 owns cross-account and high-volume validation;
  later tuning must version the detector rather than silently reinterpret
  stored evidence.
- Missed in-scope work: None.

## Notes

- Task: TASK-008
- Title: Build recurring and subscription detection using merchant rules and repeated transaction patterns
- Created: 2026-07-29
