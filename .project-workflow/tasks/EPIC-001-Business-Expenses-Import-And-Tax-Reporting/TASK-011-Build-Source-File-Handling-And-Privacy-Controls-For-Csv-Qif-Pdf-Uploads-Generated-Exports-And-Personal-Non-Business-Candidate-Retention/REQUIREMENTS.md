# Requirements

## Summary

- Task: TASK-011
- Title: Build source file handling and privacy controls for CSV/QIF/PDF uploads, generated exports, and personal/non-business candidate retention
- Parent AC Coverage: AC6, AC15
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

- AC6: owner `TASK-006, TASK-011, TASK-013`; required evidence: Confirmation/retention policy tests for Business, Mixed use, Personal, and Ignore.
- AC15: owner `TASK-011, TASK-012`; required evidence: Tenant metadata/storage evidence and repository secret/data scan.

## Goal

Keep financial source files, receipts, generated exports, and personal
transaction details private, tenant scoped, inspectable, and deletable while
preserving only the minimum metadata needed for reliable deduplication.

## Non-Goals

- Public or shareable file URLs.
- Automatic receipt matching, OCR, AI extraction, malware scanning services, or
  permanent retention of personal transaction descriptions.
- Deleting confirmed expense records when a source file is deleted.
- Parsing QIF/PDF transaction rows; TASK-012 owns those format behaviors.

## Users & Context

Owners and authorised staff upload personal bank/card exports that contain
sensitive non-business spending, attach evidence to confirmed expenses, and
download accountant workbooks. Files must never be committed to git or exposed
through client-chosen Storage paths.

## Requirements (Outcome-Focused)

- Accept CSV/QIF/PDF source files through authenticated server routes with
  explicit size, filename, MIME, UTF-8, and magic-byte validation.
- Generate every object ID and Storage path on the server under
  `tenants/{tenantId}/expenses/...`; never trust a client path.
- Store SHA-256, size, content type, purpose, original filename, retention
  state, audit fields, and optional expense linkage in tenant Firestore.
- Serve private downloads only after owner/staff token verification, with
  attachment, no-store, and nosniff headers.
- Support private deletion that removes the object, marks metadata deleted, and
  safely unlinks receipt files without deleting expenses.
- Accept manual PDF/JPEG/PNG receipt attachments and link them transactionally
  to a confirmed tenant expense. Automatic matching is deferred.
- Persist generated accountant exports privately with tenant metadata and
  download/delete controls.
- Retain full Personal/Ignore candidate details for 90 days after review, then
  remove description, merchant, bank hints, suggestions, and recurrence
  evidence while preserving occurrence fingerprint, account, date, direction,
  amount, review state, and audit identity required for deduplication.
- Clear the retention deadline if a candidate changes back to Business/Mixed or
  becomes a confirmed expense.
- Provide an authenticated bounded maintenance operation and workspace trigger
  for due minimisation.

## Acceptance Criteria (Verifiable)

- AC1: Valid CSV/QIF/PDF sources are stored at server-generated tenant paths
  with matching private metadata and no public URL.
- AC2: Unsupported, oversized, binary-text, MIME/magic-mismatched, unauthorised,
  and cross-tenant uploads/downloads/deletes fail closed.
- AC3: Deleting a source or export removes its object and minimises metadata
  without deleting imported candidates or confirmed expenses.
- AC4: A valid manual receipt can be linked, replaced, downloaded, and deleted
  for a confirmed expense by an authorised member only.
- AC5: Personal/Ignore review sets a 90-day deadline; due maintenance removes
  sensitive detail while exact and possible dedupe metadata remains usable.
- AC6: Business/Mixed/Confirmed transitions do not retain a personal-data
  minimisation deadline.
- AC7: Accountant exports are privately persisted and can be downloaded or
  deleted by authorised tenant members.
- AC8: The workspace exposes source upload, account identity, receipt, file
  retention, download, deletion, and minimisation controls coherently at
  desktop and mobile widths.

## Open Questions (Answer Needed)

- None.

## Decisions (Resolved)

- Full Personal/Ignore detail retention is 90 days, followed by dedupe-only
  minimisation.
- Automatic receipt matching is deferred; manual attachment is included.
- Source limits: CSV/QIF 5 MiB, source PDF 15 MiB, receipt PDF/JPEG/PNG 10 MiB,
  generated XLSX 25 MiB.
- Deletion retains audit metadata with `storagePath` removed and
  `retentionStatus=deleted`.
- CSV/QIF text must be valid UTF-8 without NUL bytes.

## Validation Plan

- Pure tests cover filename/path validation, signatures, sizes, retention dates,
  and minimised candidate fields.
- Storage/Firestore emulator probes cover upload/download/delete, receipts,
  exports, owner/staff/outsider access, rollback, and object metadata.
- Idempotency regression proves a minimised candidate still prevents duplicate
  re-import and supports same-date possible-duplicate checks.
- In-app Browser checks cover source upload, receipt, file controls, retention
  action, responsive layout, and console state.
- Run expense tests, type-check, lint, build, repository data scan, workflow
  doctor, and Epic audit.
