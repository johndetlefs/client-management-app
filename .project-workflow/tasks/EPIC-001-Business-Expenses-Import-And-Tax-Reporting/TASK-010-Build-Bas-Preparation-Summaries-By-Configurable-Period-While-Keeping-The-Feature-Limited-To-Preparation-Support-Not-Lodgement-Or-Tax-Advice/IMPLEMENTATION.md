## User Story

As a business owner, I want an evidence-bound BAS preparation summary for my
configured cycle and basis, so that I can review GST with my accountant without
the software inventing tax settings or payment timing.

## Goal

Deliver explicit tenant configuration and reconciled preparation summaries for
parent AC12.

## Approach

- Add pure period and BAS aggregation functions using minor units.
- Persist basis/cadence only through authenticated owner actions.
- Query tenant expenses and invoices for selected periods.
- Fail closed where registration or payment evidence is insufficient.
- Add a dedicated BAS preparation tab to the Expenses workspace.

## Parent AC Coverage

- AC12

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

- AC12: owner `TASK-010, TASK-013`; required evidence: Monthly/quarterly BAS-period and GST-bucket reconciliation evidence.

## Acceptance Criteria

- [x] AC1: Explicit basis/cadence configuration gates summaries.
- [x] AC2: Monthly and quarterly periods are deterministic and inclusive.
- [x] AC3: Registered non-cash labels and GST buckets reconcile.
- [x] AC4: Cash-basis sales and net GST fail closed without payment events.
- [x] AC5: Non-registered tenants receive operational, not BAS, amounts.
- [x] AC6: Review-needed and excluded evidence remains visible.
- [x] AC7: Tenant authorization protects reads and owner-only settings.
- [x] AC8: Preparation-only UI works at desktop and mobile widths.

## Validation

- AC1-AC6: pure aggregation and boundary tests plus emulator readback.
- AC7: emulator owner/staff/outsider/cross-tenant probes.
- AC8: in-app Browser desktop/mobile rendered checks.

## Task List

| ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
| 1 | Build BAS model | Add explicit settings, periods, registration checks, GST buckets, and fail-closed summaries. | AC1, AC2, AC3, AC4, AC5, AC6 | Run focused pure tests. | Complete |
| 2 | Protect tenant actions | Persist owner-only settings and load tenant-scoped summary data. | AC1, AC3, AC4, AC5, AC6, AC7 | Run emulator access probes. | Complete |
| 3 | Deliver preparation UI | Add configuration, period selection, labels, caveats, and review details. | AC1, AC4, AC5, AC6, AC8 | Exercise desktop and mobile states. | Complete |
| 4 | Validate and review TASK-010 | Reconcile all criteria to automated, emulator, browser, and workflow evidence. | AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8 | Inspect QA evidence and Epic audit. | Complete |

## Parent AC Evidence

- AC12: `evidence/bas-preparation-qa.md` records pure reconciliation,
  emulator authorization, cash/non-cash and registered/non-registered
  boundaries, and desktop/mobile rendered evidence. `EVIDENCE.json` contains
  passing fidelity and responsive claims.

## QA & Code Review

- Date: 2026-07-29
- Verdict: Pass.
- Evidence: 43 expense tests; owner/staff/outsider emulator probes; registered,
  non-registered, cash, non-cash, monthly, and quarterly reconciliation;
  desktop/mobile in-app Browser evidence; clean browser console; TypeScript,
  lint, production build, and passing structured evidence.
- Findings: No blocking findings. The implementation deliberately withholds
  cash-basis sales and net GST because invoices lack dated payment events.
- Proof boundaries: preparation only; no BAS lodgement, due-date promise, tax
  advice, accountant approval, or production deployment proof.

## Retro

- Date: 2026-07-29
- Reusable lessons: Basis, cadence, and registration are separate explicit
  facts. A cash-basis summary must withhold sales and net GST when payment
  events lack dates.
- Conventions or agent assets updated: Added the explicit BAS configuration and
  cash-basis fail-closed rule to `.project-workflow/guidance.md`.
- Follow-up tasks: Add dated invoice payment events before expanding cash-basis
  sales support.
- Missed in-scope work: None.

## Notes

- Task: TASK-010
- Title: Build BAS preparation summaries by configurable period while keeping the feature limited to preparation support, not lodgement or tax advice
- Created: 2026-07-29
