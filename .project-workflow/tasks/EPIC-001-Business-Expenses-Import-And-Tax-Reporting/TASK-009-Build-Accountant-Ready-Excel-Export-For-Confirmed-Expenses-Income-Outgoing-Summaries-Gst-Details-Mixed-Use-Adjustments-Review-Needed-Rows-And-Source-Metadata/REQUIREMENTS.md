# Requirements

## Summary

- Task: TASK-009
- Title: Build accountant-ready Excel export for confirmed expenses, income/outgoing summaries, GST details, mixed-use adjustments, review-needed rows, and source metadata
- Parent AC Coverage: AC11
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

- AC11: owner `TASK-009, TASK-013`; required evidence: Workbook inspection and total reconciliation evidence.

## Goal

Generate a deterministic Excel workbook that an accountant can use to inspect
confirmed expenses, invoice income, GST details, mixed-use adjustments,
evidence gaps, and source-import provenance without access to the application.

## Non-Goals

- Importing bank credits as income or adjustments.
- Inferring payment dates from cumulative invoice payment amounts.
- Changing invoice payment workflows or supplying tax advice.
- Persisting generated files; private export-file retention is owned by
  TASK-011.

## Users & Context

An authorised owner or staff member exports a selected date range for an
accountant. Expense dates and invoice issue dates determine inclusion. Existing
invoice records expose cumulative paid amounts but not dated payment events, so
that limitation must remain visible.

## Requirements (Outcome-Focused)

- Generate a valid `.xlsx` workbook in memory using integer minor-unit source
  values and deterministic row ordering.
- Include separate sheets for Overview, Expenses, Income, Review Needed, and
  Import Sources.
- Include confirmed business and mixed-use expenses in the selected inclusive
  date range with category, gross, business-use percentage, claimable amount,
  potential GST, claimable GST, GST status, evidence status, recurrence flags,
  notes, and source identifiers.
- Include non-draft, non-void invoices by issue date with invoiced, GST, paid,
  and balance values. Flag paid values as lacking dated-payment attribution.
- Reconcile workbook totals to the exported source rows and expose review counts
  for missing evidence, unresolved GST, and historical payment timing.
- Authenticate the caller and enforce tenant owner/staff membership before
  reading export data.
- Return a private download payload without writing source or generated data to
  git.

## Acceptance Criteria (Verifiable)

- AC1: A valid workbook contains Overview, Expenses, Income, Review Needed, and
  Import Sources sheets with stable headers and deterministic ordering.
- AC2: Expense gross, claimable, potential-GST, claimable-GST, and review counts
  reconcile exactly to confirmed tenant expenses in the selected range.
- AC3: Income rows use existing issued invoice records only, exclude drafts and
  voids, and surface cumulative paid values without inventing payment dates.
- AC4: Mixed-use percentages and adjustments, evidence gaps, GST review states,
  and source metadata are visible to the accountant.
- AC5: An unauthenticated caller, non-member, or cross-tenant caller cannot
  generate or read another tenant's workbook data.

## Open Questions (Answer Needed)

- None.

## Decisions (Resolved)

- Use `exceljs` for deterministic XLSX generation.
- Use invoice issue date for income period inclusion.
- Do not treat imported bank credits as income.
- Treat cumulative paid amounts without payment-event dates as review-needed,
  not cash-basis evidence.
- Generated-file persistence and deletion remain TASK-011 concerns.

## Validation Plan

- Pure workbook tests load the generated bytes and inspect sheets, values,
  ordering, totals, and review rows.
- Emulator-backed action probes verify authenticated tenant reads and outsider
  rejection.
- In-app Browser verification checks date controls, export command states, and
  an actual download from the Expenses workspace.
- Run expense tests, type-check, lint, build, diff check, workflow doctor, and
  Epic audit.
