# Epic Contract

## Summary

- Epic: EPIC-001
- Title: Business Expenses Import and Tax Reporting
- Last updated: 2026-07-29

## Sources of Truth

- Parent product scope and acceptance criteria: `REQUIREMENTS.md`.
- Authorized child rows and parent coverage: `DECOMPOSITION.md` and `TRACKER.md`.
- Child behavior and validation obligations: each child `REQUIREMENTS.md`, `IMPLEMENTATION.md`, and `EVIDENCE.json` where a proof recipe applies.
- Repository security, tenancy, currency, and transaction rules: `AGENTS.md` and `.project-workflow/guidance.md`.
- Final parent acceptance evidence: `ACCEPTANCE-AUDIT.md`.

## Invalid Substitutes

- A successful lint or build does not prove authenticated server authorization, tenant isolation, Firestore transaction behavior, or visible browser behavior.
- Client-supplied tenant or user identifiers do not prove the caller's identity or authorization.
- Code inspection or an HTTP 200 response does not prove the review workspace renders correctly or that review actions work.
- Unit fixtures do not replace emulator-backed cross-tenant and idempotency evidence.
- Export generation alone does not prove accountant totals, GST calculations, or workbook reconciliation.
- BAS summaries do not constitute tax advice, lodgement, or accountant approval.

## Invariants

- Authenticate the server caller; never authorize from a client-supplied user ID.
- Scope all expense data and file metadata under `tenants/{tenantId}`.
- Use transactions for consistency-sensitive imports and occurrence allocation.
- Store currency in minor units and avoid floating-point arithmetic.
- Treat merchant rules as suggestions that cannot overwrite confirmed accountant decisions.
- Preserve source privacy and do not commit personal bank data, source statements, or generated exports.
- Keep CSV as the deterministic primary input; QIF and PDF remain optional/fallback paths.

## Artifact Targets

- Tenant-scoped expense models and authenticated server access helpers.
- Deterministic CSV import batches and reviewable candidate records.
- Transaction-safe occurrence-aware idempotency.
- Rendered expense review workspace with protected review transitions.
- Confirmed expense records and accountant-controlled classification fields.
- Merchant suggestion rules and recurring/subscription detection.
- Reconciled Excel accountant export and GST/BAS preparation summaries.
- Tenant-scoped source-file/privacy controls and focused automated/emulator evidence.

## Parent AC Proof Ownership

| Parent AC | Proof Owner | Required Evidence |
| --- | --- | --- |
| AC1 | TASK-003, TASK-013 | Redacted bank-shaped fixture parse evidence with row/date/amount assertions. |
| AC2 | TASK-004, TASK-013 | Repeat-import evidence showing no additional candidate or expense records. |
| AC3 | TASK-004, TASK-013 | Overlapping-period evidence showing only net-new occurrences. |
| AC4 | TASK-004, TASK-013 | Same-day identical transaction occurrence-count evidence. |
| AC5 | TASK-005, TASK-013 | In-app Browser review transitions plus persisted emulator state. |
| AC6 | TASK-006, TASK-011, TASK-013 | Confirmation/retention policy tests for Business, Mixed use, Personal, and Ignore. |
| AC7 | TASK-006, TASK-013 | Minor-unit claimable/GST calculation tests including rounding cases. |
| AC8 | TASK-006, TASK-013 | Persisted accountant-field mutation evidence. |
| AC9 | TASK-007, TASK-013 | Merchant-rule suggestion and non-overwrite regression evidence. |
| AC10 | TASK-008, TASK-013 | Rule-match and repeated-pattern detection tests. |
| AC11 | TASK-009, TASK-013 | Workbook inspection and total reconciliation evidence. |
| AC12 | TASK-010, TASK-013 | Monthly/quarterly BAS-period and GST-bucket reconciliation evidence. |
| AC13 | TASK-002, TASK-005, TASK-013 | Emulator-backed tenant-path and cross-tenant isolation evidence. |
| AC14 | TASK-002, TASK-005, TASK-013 | Verified-token owner/staff authorization and unauthorized-call evidence. |
| AC15 | TASK-011, TASK-012 | Tenant metadata/storage evidence and repository secret/data scan. |
