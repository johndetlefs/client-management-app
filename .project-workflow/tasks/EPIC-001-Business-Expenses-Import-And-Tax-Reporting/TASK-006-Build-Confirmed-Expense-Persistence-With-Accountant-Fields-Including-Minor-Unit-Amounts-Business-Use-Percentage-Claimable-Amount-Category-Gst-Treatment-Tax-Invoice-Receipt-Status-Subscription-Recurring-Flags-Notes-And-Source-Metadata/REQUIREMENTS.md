# Requirements

## Summary

- Task: TASK-006
- Title: Build confirmed expense persistence with accountant fields including minor-unit amounts, business-use percentage, claimable amount, category, GST treatment, tax invoice/receipt status, subscription/recurring flags, notes, and source metadata
- Parent AC Coverage: AC6, AC7, AC8
- Last updated: 2026-07-29

## Owner Approval

- Requirements reviewed by owner: No
- Acceptance criteria reviewed by owner: No
- Approved for decomposition: No
- Approved for implementation: No
- Approved scope envelope: No
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

- AC6: owner `TASK-006, TASK-011, TASK-013`; required evidence: Confirmation/retention policy tests for Business, Mixed use, Personal, and Ignore.
- AC7: owner `TASK-006, TASK-013`; required evidence: Minor-unit claimable/GST calculation tests including rounding cases.
- AC8: owner `TASK-006, TASK-013`; required evidence: Persisted accountant-field mutation evidence.

## Goal

Let an authorised business owner turn a reviewed Business or Mixed use bank
transaction into one durable, accountant-ready expense record, then inspect and
correct its accounting fields without creating duplicate expenses or losing
source provenance. The same workflow must remain accurate for businesses that
are not registered for GST, are registered now, or become registered later.

## Non-Goals

- Do not confirm Personal or Ignore candidates as expenses.
- Do not decide the retention or deletion policy for Personal and Ignore
  candidates; TASK-011 owns that policy.
- Do not add manual expense creation in the recommended first version.
- Do not upload or match receipt/tax-invoice files; TASK-011 owns source-file
  handling. This task stores the evidence status only.
- Do not create merchant-learning rules or recurring-pattern detection;
  TASK-007 and TASK-008 own those outcomes.
- Do not generate accountant workbooks or BAS summaries; TASK-009 and TASK-010
  own those outcomes.
- Do not infer GST treatment from a merchant name, bank category, or amount.
- Do not treat a current GST registration setting as proof that an expense
  outside its effective date range is creditable.
- Do not automatically convert potential GST on historical purchases into a GST
  credit when registration details change or are backdated.
- Do not decide cash-versus-accrual GST accounting or BAS cadence; TASK-010 owns
  those reporting-period decisions.
- Do not provide tax advice or treat calculated values as lodged or
  accountant-approved figures.

## Users & Context

- Primary user: the business owner reviewing transactions imported from a
  personal bank or credit-card account.
- Secondary user: the accountant who needs consistent category, GST,
  business-use, evidence, subscription, recurring, note, and source fields.
- A candidate has already been marked Business or Mixed use in TASK-005 before
  it reaches confirmation.
- The application prepares accounting records. The user or accountant remains
  responsible for choosing the correct category, GST treatment, business-use
  percentage, and evidence status.
- Tenants can be GST registered or not registered, and a tenant can change
  registration state over time. GST-credit eligibility therefore depends on an
  explicit registration state and effective date, not the existing invoice tax
  label or default tax rate.

## Requirements (Outcome-Focused)

- Confirm Business and Mixed use candidates through an authenticated,
  tenant-scoped server mutation.
- Create at most one confirmed expense for a candidate, even when confirmation
  is retried or submitted concurrently.
- Copy immutable transaction/source fields from the candidate and accept only
  the accountant fields owned by this task from the user.
- Store original amount, business-use claimable amount, potential GST included
  in the purchase, and claimable GST credit as distinct integer minor-unit
  values.
- Allow 100% business use for Business candidates and require an explicit
  percentage from 1% through 99% for Mixed use candidates.
- Compute the business-use amount with documented integer rounding.
- Capture an explicit tenant GST registration state separately from invoice tax
  type/rate. Registered tenants require an effective-from date and may have an
  effective-to date; missing or uncertain registration details are treated as
  unknown, not registered.
- Require an explicit purchase GST treatment. A taxable-purchase treatment can
  calculate the potential GST included in the purchase independently of the
  tenant's registration state.
- Store claimable GST credit as zero unless the tenant is explicitly registered
  on the expense date and the purchase treatment, business-use proportion, and
  evidence status support a credit.
- Preserve potential GST and the user's purchase treatment for non-registered
  tenants so registration/backdating questions can be reviewed later, without
  presenting that amount as claimable.
- When registration dates change, flag affected historical expenses for review;
  do not silently convert or remove GST credits.
- Require a category and evidence status before confirmation.
- Store subscription and recurring flags independently because either, both, or
  neither may apply.
- Preserve notes and source metadata needed to trace the expense back to its
  candidate and import batch.
- Provide a confirmed-expense view where the accountant fields can be corrected
  by an authorised owner/staff user.
- Keep the starter category set editable and neutral enough for the accountant
  to rename, add, deactivate, or replace categories without data migration.

## Acceptance Criteria (Verifiable)

- AC1: A Business or Mixed use candidate can be confirmed, while an unreviewed,
  Personal, Ignore, or already-confirmed candidate is rejected without creating
  another expense. Covers parent AC6.
- AC2: Confirmation and concurrent retries create exactly one
  `tenants/{tenantId}/expenses/{expenseId}` record and atomically link the
  candidate to that expense. Covers parent AC6 and AC13.
- AC3: A Business candidate stores `businessUsePercent=100`; a Mixed use
  candidate requires an integer from 1 through 99. Covers parent AC7 and AC8.
- AC4: `claimableAmountMinor` is the original positive expense amount multiplied
  by the business-use percentage and rounded to the nearest minor unit using
  integer half-up arithmetic. Covers parent AC7.
- AC5: For an explicitly selected taxable-purchase treatment,
  `gstIncludedAmountMinor` stores the potential GST included in the
  GST-inclusive purchase, apportioned to business use and rounded using integer
  half-up arithmetic; calculations use no floating-point currency values.
  Covers parent AC7.
- AC6: `gstAmountMinor` stores the claimable GST credit and is non-zero only
  when the tenant is explicitly registered on the expense date and the purchase
  treatment and evidence status support a credit. A non-registered, unknown, or
  out-of-period tenant stores `gstAmountMinor=0` while retaining any
  `gstIncludedAmountMinor` for review. `no_gst`, `gst_free`, `input_taxed`,
  `private_or_non_claimable`, and `review_required` treatments store both
  amounts consistently and never infer a credit from bank data. Covers parent
  AC7 and AC8.
- AC7: Confirmation requires an active category and stores the selected
  category ID. An authorised user can add, rename, deactivate, and select
  tenant-scoped categories without changing historical expense IDs. Covers
  parent AC8.
- AC8: Confirmation stores one explicit tax-invoice/receipt status. A taxable
  purchase over AUD 82.50 cannot produce claimable GST while its required
  evidence is missing or unresolved; the potential GST component may still be
  retained for review. Covers parent AC8.
- AC9: Confirmation stores independent subscription and recurring booleans plus
  optional notes, and an authorised user can later correct them. Covers parent
  AC8.
- AC10: The expense preserves candidate ID, import batch ID, source-file/account
  references when present, transaction fingerprint, occurrence index, date,
  merchant, raw description, original amount, currency, creator, updater, and
  timestamps. Covers parent AC6 and AC8.
- AC11: The confirmed-expense workspace lists persisted values and allows an
  authorised user to correct category, GST treatment, business-use percentage,
  evidence status, subscription, recurring, and notes with recalculated
  minor-unit amounts. It distinguishes potential GST included from GST currently
  claimable and explains when registration state suppresses the credit. Covers
  parent AC8.
- AC12: An unauthenticated caller or a user outside the tenant cannot confirm,
  read, or edit expenses, categories, or GST registration settings, including
  when supplying another user's ID or tenant ID. Covers inherited parent AC13
  and AC14.
- AC13: GST registration is not inferred from `taxType`, `defaultRate`, an ABN,
  or expense data. Changing a registration effective date flags affected
  expenses for review and does not silently change historical claimable GST.
  Covers parent AC7 and AC8.

## Open Questions (Answer Needed)

- None blocking. The owner accepted the starter categories, exclusion of manual
  expense entry, and the revised GST registration envelope provided registered
  and non-registered tenants are handled separately.

## Decisions (Resolved)

- Confirmed expenses remain business-level tenant records and are not linked to
  individual clients.
- The initial editable starter categories are: Accounting and legal;
  Advertising and marketing; Bank and payment fees; Computer, software and
  online services; Contractors and outsourced services; Education and training;
  Equipment and assets; Insurance; Meals and entertainment; Motor vehicle;
  Office supplies; Phone and internet; Professional memberships and
  subscriptions; Rent and occupancy; Travel and transport; Other / accountant
  review.
- Manual expense creation is excluded from TASK-006 and may be proposed later
  if import-based capture does not cover the real workflow.
- Original transaction amount is a positive expense amount in minor units.
- Business-use and GST calculations use integer half-up arithmetic.
- `claimableAmountMinor` means the business-use portion of the GST-inclusive
  payment. It is not labelled as the final income-tax deduction.
- The GST calculation is preparation support only. Current ATO guidance says
  GST credits are normally one-eleventh of a GST-inclusive purchase and only
  the business-use proportion is creditable; a valid tax invoice is generally
  required for purchases over AUD 82.50.
- A tenant that is not registered for GST cannot claim input tax credits. The
  system may retain a separately labelled potential GST component, but
  claimable GST remains zero.
- Becoming registered later does not by itself make every earlier purchase
  creditable. Registration effective dates and any backdating or special
  pre-registration rules require explicit review.
- The existing invoice `taxType` and `defaultRate` settings do not establish GST
  registration and must not be used as an expense-credit eligibility signal.
- No merchant, bank category, or amount automatically establishes GST
  eligibility.
- Expense identity is deterministic from the tenant and candidate, and
  confirmation links candidate and expense in one Firestore transaction.
- Personal/Ignore retention remains explicitly deferred to TASK-011.

## Validation Plan

- Add unit tests for integer half-up business-use and GST calculations,
  including one-cent and rounding-boundary cases, with potential GST separated
  from claimable GST.
- Add registration matrix tests for not registered, unknown, registered before
  the expense date, registered after the expense date, registration ended
  before the expense date, and changed/backdated effective dates.
- Use Firebase emulators to prove Business, Mixed use, Personal, Ignore,
  already-confirmed, retry, and concurrent-confirmation behavior.
- Use Firebase emulators to prove authenticated owner/staff access and
  cross-tenant denial for expenses and categories.
- Exercise category creation/deactivation and confirmed-expense edits, then
  inspect persisted values and audit metadata.
- Verify that changing registration dates flags affected expenses and does not
  silently alter stored historical credits.
- Render and operate the confirmation/editing workflow in the in-app Browser at
  desktop and mobile widths.
- Run `npm run lint` and `npm run build`.
