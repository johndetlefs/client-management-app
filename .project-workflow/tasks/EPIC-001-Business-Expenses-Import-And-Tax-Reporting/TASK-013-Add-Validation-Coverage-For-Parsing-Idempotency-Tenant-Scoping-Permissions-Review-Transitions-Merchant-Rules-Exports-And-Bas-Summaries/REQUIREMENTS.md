# Requirements

## Summary

- Task: TASK-013
- Title: Add validation coverage for parsing, idempotency, tenant scoping, permissions, review transitions, merchant rules, exports, and BAS summaries
- Parent AC Coverage: AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12, AC13, AC14
- Last updated: 2026-07-29

## Owner Approval

- Requirements reviewed by owner: Yes
- Acceptance criteria reviewed by owner: Yes
- Approved for decomposition: Yes
- Approved for implementation: Yes
- Approved scope envelope: Yes
- Approved by: Inherited from parent epic envelope when unchanged
- Approval date: Inherited from parent epic envelope when unchanged
- Approval note / source: Inherited from parent epic envelope when unchanged
- Approved artifact identity: Inherited from parent epic envelope when unchanged

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

- AC1: owner `TASK-003, TASK-013`; required evidence: Redacted bank-shaped fixture parse evidence with row/date/amount assertions.
- AC2: owner `TASK-004, TASK-013`; required evidence: Repeat-import evidence showing no additional candidate or expense records.
- AC3: owner `TASK-004, TASK-013`; required evidence: Overlapping-period evidence showing only net-new occurrences.
- AC4: owner `TASK-004, TASK-013`; required evidence: Same-day identical transaction occurrence-count evidence.
- AC5: owner `TASK-005, TASK-013`; required evidence: In-app Browser review transitions plus persisted emulator state.
- AC6: owner `TASK-006, TASK-011, TASK-013`; required evidence: Confirmation/retention policy tests for Business, Mixed use, Personal, and Ignore.
- AC7: owner `TASK-006, TASK-013`; required evidence: Minor-unit claimable/GST calculation tests including rounding cases.
- AC8: owner `TASK-006, TASK-013`; required evidence: Persisted accountant-field mutation evidence.
- AC9: owner `TASK-007, TASK-013`; required evidence: Merchant-rule suggestion and non-overwrite regression evidence.
- AC10: owner `TASK-008, TASK-013`; required evidence: Rule-match and repeated-pattern detection tests.
- AC11: owner `TASK-009, TASK-013`; required evidence: Workbook inspection and total reconciliation evidence.
- AC12: owner `TASK-010, TASK-013`; required evidence: Monthly/quarterly BAS-period and GST-bucket reconciliation evidence.
- AC13: owner `TASK-002, TASK-005, TASK-013`; required evidence: Emulator-backed tenant-path and cross-tenant isolation evidence.
- AC14: owner `TASK-002, TASK-005, TASK-013`; required evidence: Verified-token owner/staff authorization and unauthorized-call evidence.

## Goal

Produce current, reproducible evidence that the complete expense workflow meets
the parent acceptance criteria across deterministic code, Firebase emulators,
generated workbooks, and the rendered in-app experience.

## Non-Goals

- New product scope, live Firebase mutation, deployment, BAS lodgement, tax
  advice, OCR, or use of real transaction values in committed evidence.
- Treating lint, build, code inspection, or HTTP success as proof for behaviors
  that require emulator or rendered-browser evidence.

## Users & Context

The owner needs confidence that the epic is operational before relying on it
for business records, and future maintainers need a focused regression suite
that protects tenant isolation, idempotency, money, tax, and privacy behavior.

## Requirements (Outcome-Focused)

- Refresh all pre-adoption and legacy evidence required by parent AC1-AC14.
- Use synthetic bank-shaped fixtures for all committed tests and emulator data.
- Prove repeat, overlap, and same-day occurrence behavior against persisted
  tenant records, including concurrent import attempts.
- Prove all review transitions, confirmation restrictions, accountant field
  edits, merchant-rule suggestions, recurring detection, and retention.
- Inspect generated XLSX sheets and integer reconciliation, and verify BAS
  monthly/quarterly, registered/nonregistered, cash/non-cash outcomes.
- Exercise owner, staff, unauthenticated, outsider, and cross-tenant access for
  actions and routes.
- Verify the rendered workspace at desktop and mobile widths with console and
  network inspection through the in-app Browser.
- Run type-check, lint, build, data/secret scan, workflow doctor, child QA
  review, and epic acceptance audit.

## Acceptance Criteria (Verifiable)

- AC1: Parser and emulator evidence proves CSV/QIF valid-row handling, repeat
  idempotency, overlapping periods, counted same-day occurrences, and
  concurrent-write protection for parent AC1-AC4.
- AC2: Emulator and browser evidence proves Business, Personal, Mixed use,
  Ignore, confirmation restrictions, accountant fields, minor-unit/GST
  calculations, and retention for parent AC5-AC8.
- AC3: Tests and emulator state prove merchant rules remain editable
  suggestions and recurring/subscription evidence behaves deterministically
  for parent AC9-AC10.
- AC4: Workbook inspection and BAS matrices reconcile integer totals and expose
  review limitations for parent AC11-AC12.
- AC5: Emulator and browser evidence proves tenant paths, verified owner/staff
  access, denied outsider/cross-tenant access, and responsive workspace
  behavior for parent AC13-AC14.

## Open Questions (Answer Needed)

- None.

## Decisions (Resolved)

- Existing child evidence is treated as incomplete until rerun or directly
  incorporated into this task's dated evidence bundle.
- Expected denial logs are not failures when assertions confirm fail-closed
  behavior.
- The final browser journey uses only synthetic local-emulator data.

## Validation Plan

- Run all expense unit tests and dedicated emulator probes with machine-readable
  summaries.
- Inspect XLSX output with ExcelJS and Firestore/Storage state with Admin SDK.
- Complete one rendered desktop and one mobile workflow journey in the in-app
  Browser, recording screenshots, console, and relevant network outcomes.
- Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, repository privacy
  scan, `workflow doctor`, and `epic audit`.
