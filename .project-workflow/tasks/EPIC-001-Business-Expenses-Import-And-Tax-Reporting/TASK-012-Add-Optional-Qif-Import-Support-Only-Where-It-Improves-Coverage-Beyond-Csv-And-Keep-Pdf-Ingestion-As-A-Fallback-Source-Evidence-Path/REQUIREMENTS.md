# Requirements

## Summary

- Task: TASK-012
- Title: Add optional QIF import support only where it improves coverage beyond CSV, and keep PDF ingestion as a fallback/source-evidence path
- Parent AC Coverage: AC15
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

- AC15: owner `TASK-011, TASK-012`; required evidence: Tenant metadata/storage evidence and repository secret/data scan.

## Goal

Allow an authorised tenant member to import the owner-supplied Australian bank
QIF export through the same private, idempotent review pipeline as CSV while
keeping PDF statements as evidence-only files.

## Non-Goals

- General-purpose support for every QIF dialect, investment/account transfer
  semantics, split transactions, OCR, PDF row extraction, or AI parsing.
- Replacing CSV as the primary deterministic import path.

## Users & Context

The business owner may export the same bank account in CSV or QIF. The observed
QIF is `!Type:Bank`, contains 111 caret-terminated records, uses day-first
`D/M/YYYY` dates, signed `T` amounts, `P` payees, and `L` category fields.

## Requirements (Outcome-Focused)

- Parse only bank QIF records with explicit date, signed amount, and payee or
  memo description; fail the whole import with record-specific issues when
  required fields are invalid.
- Interpret dates as Australian day-first dates for the observed export and
  signed negative amounts as debits and positive amounts as credits.
- Convert money to positive integer minor units without floating-point
  arithmetic and use the same source-account-aware fingerprint, occurrence,
  possible-duplicate, merchant suggestion, and recurrence pipeline as CSV.
- Persist QIF import batches and candidates with `sourceFormat=qif`, the private
  source file ID, parser version, counts, and source account identity.
- Treat PDF uploads as private source evidence only and state clearly that they
  produce no transaction rows.
- Never commit or reproduce the owner-supplied transaction content in fixtures
  or evidence; tests use synthetic records with the same field structure.

## Acceptance Criteria (Verifiable)

- AC1: The observed `!Type:Bank` field structure parses deterministically into
  correct day-first dates, debit/credit directions, integer minor units,
  descriptions, category hints, and occurrence-aware fingerprints.
- AC2: Malformed headers, incomplete records, zero/invalid amounts, invalid
  dates, unsupported split records, and missing descriptions fail closed with
  record-specific messages and no candidate writes.
- AC3: Authenticated QIF imports create tenant-scoped `qif` batches and
  candidates through the existing transaction-safe idempotency, suggestion,
  and recurrence pipeline.
- AC4: Re-importing the same QIF or overlapping CSV/QIF transactions for the
  same source account does not duplicate candidate or confirmed expense rows.
- AC5: The workspace imports QIF from the source upload control and reports PDF
  as stored evidence only, with no PDF-derived candidates.

## Open Questions (Answer Needed)

- None.

## Decisions (Resolved)

- QIF support is deliberately limited to the observed Australian bank dialect.
- Day-first date interpretation is explicit and no locale inference is used.
- `P` payee is the primary description; `M` memo is a fallback.
- `L` values are retained as bank category hints but never treated as
  accountant classifications.
- Split transaction fields are rejected rather than partially interpreted.

## Validation Plan

- Pure parser tests cover valid records, CRLF, repeated categories, duplicates,
  and every fail-closed case.
- A privacy-safe structural comparison confirms the real QIF record count and
  aggregate directions/amounts against parser output without persisting values.
- Emulator tests cover QIF persistence, access control, same-format re-import,
  and cross-format overlap with synthetic records.
- In-app Browser checks cover QIF upload and PDF evidence-only messaging.
