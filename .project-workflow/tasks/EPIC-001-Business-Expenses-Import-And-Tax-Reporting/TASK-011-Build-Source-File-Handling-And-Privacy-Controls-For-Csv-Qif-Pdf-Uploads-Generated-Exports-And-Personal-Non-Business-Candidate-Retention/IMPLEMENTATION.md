## User Story

As a business owner, I want source statements, receipts, exports, and personal
transaction details to have explicit private lifecycles, so that expense
automation does not create an uncontrolled archive of sensitive spending data.

## Goal

Deliver private tenant file controls and 90-day personal-detail minimisation for
parent AC6 and AC15.

## Approach

- Centralise server-generated Storage paths and file validation.
- Add authenticated upload/download/delete routes and metadata.
- Link receipts transactionally and persist generated exports privately.
- Schedule review deadlines and run bounded dedupe-preserving minimisation.
- Add workspace source, receipt, export, and retention controls.

## Parent AC Coverage

- AC6, AC15

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

## Acceptance Criteria

- [x] AC1: Private tenant source storage and metadata.
- [x] AC2: File validation and cross-tenant access fail closed.
- [x] AC3: Deletion removes objects without deleting accounting records.
- [x] AC4: Manual receipt lifecycle is protected and linked.
- [x] AC5: 90-day Personal/Ignore minimisation preserves dedupe.
- [x] AC6: Business/Mixed/Confirmed records clear retention deadlines.
- [x] AC7: Generated exports are private, downloadable, and deletable.
- [x] AC8: File/privacy controls work at desktop and mobile widths.

## Validation

- AC1-AC4, AC7: Storage/Firestore emulator lifecycle and access probes.
- AC5-AC6: retention tests plus minimised-record idempotency regression.
- AC8: in-app Browser desktop/mobile journey.

## Task List

| ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
| 1 | Build private file layer | Add server paths, validation, metadata, Storage upload/download/delete, and tests. | AC1, AC2, AC3 | Run pure and emulator file probes. | Complete |
| 2 | Add receipts and exports | Link manual receipts and persist generated workbooks with protected lifecycle controls. | AC4, AC7 | Exercise receipt/export emulator scenarios. | Complete |
| 3 | Implement minimisation | Set 90-day deadlines and remove sensitive candidate fields while preserving dedupe. | AC5, AC6 | Run retention/idempotency regression. | Complete |
| 4 | Deliver workspace controls | Add upload, source-account, receipt, file, export, and maintenance UI. | AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8 | Exercise desktop/mobile journey. | Complete |
| 5 | Validate and review TASK-011 | Reconcile all criteria to automated, emulator, browser, and workflow evidence. | AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8 | Inspect QA evidence and Epic audit. | Complete |

## Parent AC Evidence

- AC6, AC15: `evidence/source-files-privacy-qa.md` records tenant-path,
  checksum, role, denial, receipt, export, deletion, retention, and responsive
  evidence. `EVIDENCE.json` contains passing fidelity and responsive claims.

## QA & Code Review

- Date: 2026-07-29
- Verdict: Pass.
- Evidence: file signature and path tests; synthetic Storage/Firestore
  lifecycle matrix; owner/staff/outsider/cross-tenant route probes;
  dedupe-preserving minimisation regression; desktop/mobile in-app Browser
  evidence; TypeScript, lint, build, diff, and structured evidence.
- Findings: No blocking findings. Receipt replacement safely unlinks the prior
  file; source/export deletion preserves imported and confirmed accounting
  records; client Storage access is denied.
- Proof boundaries: no malware scanning, OCR, automatic receipt matching,
  production bucket/rules deployment, or production-scale evidence.

## Retro

- Date: 2026-07-29
- Reusable lessons: Personal-detail minimisation must preserve the complete
  dedupe identity, and file-object deletion must remain independent from
  accounting-record deletion.
- Conventions or agent assets updated: Added the dedupe-preserving privacy rule
  and bounded file-input rule to `.project-workflow/guidance.md`.
- Follow-up tasks: Automatic receipt matching and malware scanning remain
  optional future work, not implied by manual private attachment.
- Missed in-scope work: None.

## Notes

- Task: TASK-011
- Title: Build source file handling and privacy controls for CSV/QIF/PDF uploads, generated exports, and personal/non-business candidate retention
- Created: 2026-07-29
