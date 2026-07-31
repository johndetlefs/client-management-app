# Requirements

## Summary

- Task: TASK-007
- Title: Build merchant rule learning so reviewed merchants can pre-fill future category, GST treatment, subscription flag, recurring flag, and business-use percentage suggestions
- Parent AC Coverage: AC9
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

- AC9: owner `TASK-007, TASK-013`; required evidence: Merchant-rule suggestion and non-overwrite regression evidence.

## Goal

Let an authorised tenant user learn a reusable merchant rule from a confirmed
expense so future imports for that merchant arrive with editable accountant
suggestions instead of requiring repeated data entry.

## Non-Goals

- Do not automatically classify a candidate as Business, Mixed use, Personal,
  Ignore, or Confirmed.
- Do not overwrite an existing confirmed expense or a user's later accountant
  corrections during import.
- Do not implement repeated-transaction pattern detection; TASK-008 owns that
  separate signal.
- Do not create cross-tenant/global merchant intelligence, paid AI matching, or
  a general regular-expression rule editor.

## Users & Context

- Primary user: an owner or staff member who repeatedly sees the same business
  merchant in personal-card imports.
- Context: the source expense is already confirmed and holds the accountant
  fields that may be reused as suggestions.
- Context: merchant rules and candidate suggestions are tenant-scoped and may
  contain business-sensitive classification decisions.

## Requirements (Outcome-Focused)

- Save or refresh one deterministic tenant merchant rule from a confirmed
  expense using its normalized merchant identity.
- Copy category, GST treatment, business-use percentage, subscription flag, and
  recurring flag from the confirmed expense into the rule.
- Apply active matching rules only while creating net-new import candidates.
- Store the match as a suggestion with rule provenance and confidence, leaving
  candidate review status unchanged.
- Present the suggestion in the review/confirmation workflow and let the user
  override every suggested accountant field before confirmation.
- Allow an authorised tenant user to deactivate or reactivate a learned rule.

## Acceptance Criteria (Verifiable)

- AC1: An authenticated owner/staff user can save a rule from a confirmed
  expense; an unauthenticated or cross-tenant caller cannot read or mutate the
  rule. Covers parent AC9, AC13, and AC14.
- AC2: Saving again for the same normalized merchant updates one deterministic
  rule rather than creating duplicates, while preserving created-at/creator
  audit fields. Covers parent AC9.
- AC3: The rule stores category, normalized GST treatment, integer business-use
  percentage, subscription flag, recurring flag, source expense ID, active
  state, confidence, and audit metadata. Covers parent AC9.
- AC4: A net-new candidate whose normalized merchant matches an active rule
  stores a `user_rule` suggestion with the rule ID and suggested accountant
  fields. Covers parent AC9.
- AC5: Rule application leaves the new candidate `unreviewed`, does not mutate
  previously imported candidates, and does not overwrite confirmed expenses or
  their accountant fields on repeat/overlapping imports. Covers parent AC9.
- AC6: An inactive rule does not produce a suggestion and can be reactivated by
  an authorised tenant user. Covers parent AC9.
- AC7: The review/confirmation workspace clearly labels rule suggestions,
  pre-fills the accountant fields, and permits the user to change any suggested
  value before confirmation. Covers parent AC9.
- AC8: Merchant matching is deterministic and fail-closed for blank/unsupported
  rule data; no bank category or amount is treated as a learned rule. Covers
  parent AC9.

## Open Questions (Answer Needed)

- None. The parent envelope already requires suggestions rather than automatic
  classifications and authorises owner/staff tenant access.

## Decisions (Resolved)

- The first learned-rule strategy is exact normalized-merchant matching.
- Rule IDs are deterministic from the normalized merchant key so a tenant has
  at most one learned rule for that key.
- Rules are learned only from confirmed expenses, not from unconfirmed bank
  candidates.
- The confirmation form applies suggested values as editable defaults.
- Repeated-pattern detection and confidence blending remain in TASK-008.

## Validation Plan

- Add pure rule-ID, matching, and suggestion tests including inactive and
  malformed rules.
- Use Firebase emulators to save/update/deactivate a rule, prove tenant
  isolation, import a future matching row, and inspect suggestion provenance.
- Re-import existing/confirmed occurrences and verify no candidate/expense
  accountant fields are overwritten.
- Operate the suggestion and override workflow in the in-app Browser at desktop
  and mobile widths.
- Run focused expense tests, `npm run lint`, `npx tsc --noEmit`, `npm run
  build`, `git diff --check`, workflow doctor, and Epic audit.
