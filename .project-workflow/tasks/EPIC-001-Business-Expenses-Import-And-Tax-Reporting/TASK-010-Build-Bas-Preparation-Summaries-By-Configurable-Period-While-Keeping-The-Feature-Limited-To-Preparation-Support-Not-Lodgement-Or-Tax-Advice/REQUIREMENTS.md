# Requirements

## Summary

- Task: TASK-010
- Title: Build BAS preparation summaries by configurable period while keeping the feature limited to preparation support, not lodgement or tax advice
- Parent AC Coverage: AC12
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

- AC12: owner `TASK-010, TASK-013`; required evidence: Monthly/quarterly BAS-period and GST-bucket reconciliation evidence.

## Goal

Prepare evidence-bound monthly or quarterly GST summaries that make BAS review
easier without inferring registration, accounting basis, reporting cadence,
payment dates, or lodgement outcomes.

## Non-Goals

- BAS lodgement, ATO integration, due-date guarantees, tax advice, PAYG, WET,
  LCT, fuel tax credits, or full-reporting labels.
- Inferring cash/non-cash basis, monthly/quarterly cadence, GST registration,
  or cash receipt dates.
- Retrofitting dated invoice payment events.

## Users & Context

Owners configure the tenant's ATO-aligned GST accounting basis and reporting
cycle. Owners and staff can inspect a selected period. Some tenants are not GST
registered; they still need operational income/outgoing totals without BAS
amounts being represented as liabilities or credits.

## Requirements (Outcome-Focused)

- Require an owner to explicitly save `cash` or `non_cash` basis and `monthly`
  or `quarterly` cadence before BAS summaries are available.
- Keep GST registration effective dates separate from basis and cadence.
- Generate stable Australian monthly or calendar-quarter period boundaries.
- For registered periods, separate G1 total sales, 1A GST on sales, 1B GST on
  purchases, potential GST, non-claimable GST, and review-needed GST using
  integer minor-unit arithmetic.
- Use issued invoice records for non-cash sales. For cash basis, fail closed on
  sales and net GST because existing invoices do not contain dated payment
  events.
- For non-registered tenants, return operational totals while leaving BAS
  labels and net GST unset.
- Recompute expense GST-registration drift against current settings and exclude
  unresolved credits from 1B.
- Authenticate owner/staff reads, restrict configuration changes to owners, and
  scope every query under the tenant.
- Present preparation status, caveats, period boundaries, evidence gaps, and
  source totals without claiming lodgement readiness.

## Acceptance Criteria (Verifiable)

- AC1: No BAS summary is generated until both basis and cadence are explicitly
  configured; owner-only settings persist under the tenant.
- AC2: Monthly and quarterly period boundaries are deterministic, inclusive,
  and Australian-calendar aligned.
- AC3: Registered non-cash summaries reconcile G1, 1A, eligible 1B, potential
  GST, non-claimable GST, and review-needed amounts to tenant records.
- AC4: Cash-basis summaries never attribute cumulative invoice payments to a
  period without dated payment events and therefore do not calculate sales or
  net GST.
- AC5: Non-GST-registered summaries expose operational totals but no BAS label,
  liability, credit, or net-GST amounts.
- AC6: Registration drift, missing evidence, unresolved GST, and excluded
  amounts remain visible as review-needed evidence.
- AC7: Owner/staff reads and owner-only writes are tenant isolated.
- AC8: The BAS preparation UI remains readable and operable at desktop and
  mobile widths and clearly states its preparation-only boundary.

## Open Questions (Answer Needed)

- None.

## Decisions (Resolved)

- Basis and cadence have no software default.
- The initial reporting method is Simpler BAS only.
- Expense transaction date is payment evidence for imported bank/card
  purchases.
- Non-cash invoice income uses issue date.
- Cash-basis invoice income remains unavailable until dated payment records
  exist.
- The app does not calculate or promise lodgement due dates; users check their
  ATO activity statement.
- Official references verified 2026-07-29:
  `https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/accounting-for-gst-in-your-business`,
  `https://www.ato.gov.au/api/public/content/0-98e0ef06-57b7-4811-a119-5236f1676a3c`,
  and
  `https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/business-activity-statements-bas/due-dates-for-lodging-and-paying-your-bas`.

## Validation Plan

- Pure tests cover monthly/quarterly boundaries, registration periods,
  registered/non-registered behavior, integer reconciliation, review exclusion,
  and cash-basis fail-closed behavior.
- Emulator probes cover settings persistence, owner/staff/outsider access, and
  tenant-scoped summary reads.
- In-app Browser checks cover explicit configuration, period selection,
  summary/caveat presentation, and responsive behavior.
- Run expense tests, type-check, lint, build, diff check, workflow doctor, and
  Epic audit.
