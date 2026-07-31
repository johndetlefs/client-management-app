# Requirements

## Summary

- Task: TASK-008
- Title: Build recurring and subscription detection using merchant rules and repeated transaction patterns
- Parent AC Coverage: AC10
- Last updated: 2026-07-29

## Owner Approval

- Requirements reviewed by owner: Yes
- Acceptance criteria reviewed by owner: Yes
- Approved for decomposition: Yes
- Approved for implementation: Yes
- Approved scope envelope: Yes
- Approved by: John Detlefs
- Approval date: 2026-07-29
- Approval note / source: Inherited unchanged from the approved EPIC-001
  requirements and owner instruction to complete the Epic.
- Approved artifact identity: EPIC-001 approved requirements envelope, AC10,
  and TASK-008 decomposition row.

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

## Goal

Flag likely recurring and subscription-like debit candidates from explicit
merchant rules and conservative repeated-transaction evidence, reducing review
effort without making business or accountant decisions for the owner.

## Non-Goals

- Automatically confirming, categorising, or changing review status.
- Treating bank categories, descriptions alone, or two transactions as
  sufficient recurrence evidence.
- Overwriting a learned merchant rule or a confirmed expense.
- Forecasting cash flow, cancelling subscriptions, or providing tax advice.

## Users & Context

Business owners and authorised staff reviewing repeated purchases after a CSV
import, especially subscriptions or regular services appearing across several
statement periods.

## Requirements (Outcome-Focused)

- Detect weekly, fortnightly, monthly, quarterly, and annual cadence only after
  at least three distinct dates for one normalized merchant.
- Ignore same-day duplicate occurrences when establishing cadence.
- Use integer minor-unit comparisons for amount stability.
- Flag monthly or annual stable-amount patterns as subscription-like; other
  supported cadences may be recurring without being subscriptions.
- Keep a 26-month analysis window and query only tenant-scoped matching
  merchants.
- Preserve deterministic pattern evidence on the candidate.
- Let an active user merchant rule win when its recurring/subscription flags
  differ, while retaining the pattern evidence and conflict state.
- Keep every result editable and leave the candidate unreviewed.

## Acceptance Criteria (Verifiable)

- AC1: Three or more distinct dates for one normalized debit merchant can
  produce a deterministic supported cadence; two dates, same-day duplicates,
  malformed dates, and out-of-window history cannot.
- AC2: Stable monthly or annual patterns suggest both recurring and
  subscription-like; weekly, fortnightly, quarterly, or unstable patterns do
  not infer subscription.
- AC3: Candidate pattern evidence records cadence, date span, occurrence count,
  amount stability, confidence, and algorithm version.
- AC4: An active learned merchant rule remains the suggestion source and its
  explicit flags win, while conflicting repeated-pattern evidence remains
  visible.
- AC5: Pattern-only suggestions leave review status unreviewed, are editable,
  and never alter prior candidates or confirmed expenses.
- AC6: The workspace visibly distinguishes learned-rule and repeated-pattern
  suggestions and remains operable at desktop and mobile widths.

## Open Questions (Answer Needed)

- None. Thresholds are conservative implementation policy within the approved
  suggestion-only scope and can be tuned later without changing stored owner
  decisions.

## Decisions (Resolved)

- Require three distinct dates.
- Supported cadence windows: weekly 5-9 days, fortnightly 12-16, monthly
  25-35, quarterly 80-100, annual 350-380.
- Analyse at most 26 months and collapse same-day occurrences.
- Treat amount range within the larger of 100 minor units or 5% of the median
  as stable.
- Infer subscription-like only for stable monthly or annual patterns.
- Explicit active user-rule flags override pattern defaults.

## Validation Plan

- Pure tests cover cadence boundaries, distinct-date rules, same-day collapse,
  amount stability, subscription inference, history windows, and deterministic
  confidence.
- Emulator scenarios cover pattern-only imports, learned-rule conflict,
  retries, tenant scoping, and persisted evidence.
- In-app Browser checks verify labels, editable defaults, conflict messaging,
  and responsive behavior at 1280x900 and 390x844.
- Run the complete expense suite, type-check, lint, build, diff check, workflow
  doctor, and Epic audit.
