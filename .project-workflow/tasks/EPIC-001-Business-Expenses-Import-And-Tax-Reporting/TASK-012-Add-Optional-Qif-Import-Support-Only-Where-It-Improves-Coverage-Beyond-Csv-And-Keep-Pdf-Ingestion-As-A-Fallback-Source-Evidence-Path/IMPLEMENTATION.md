## User Story

As a business owner, I want to import my bank's QIF export when CSV is
inconvenient, so that I can use the same private review and deduplication
workflow without paying for another parsing service.

## Parent AC Coverage

- AC15

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

## Acceptance Criteria

- [x] AC1: Observed bank QIF records parse into deterministic transaction rows.
- [x] AC2: Unsupported or malformed QIF fails closed before persistence.
- [x] AC3: QIF uses the authenticated tenant import pipeline and metadata.
- [x] AC4: Same-format and cross-format overlaps remain idempotent.
- [x] AC5: Workspace imports QIF and keeps PDF evidence-only.

## Validation

- AC1-AC2: Synthetic parser tests plus privacy-safe real-file aggregate
  comparison.
- AC3-AC4: Auth/Firestore emulator import and overlap probe.
- AC5: In-app Browser upload journey and file metadata inspection.

## Task List

| ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
| 1 | Build QIF parser | Parse the observed bank dialect into the shared transaction row shape with strict issues. | AC1, AC2 | Run parser tests and real-file aggregate comparison. | Complete |
| 2 | Share import persistence | Route QIF through authenticated idempotency, suggestions, recurrence, and transactional persistence. | AC3, AC4 | Run emulator same-format and cross-format overlap probes. | Complete |
| 3 | Connect source upload | Import QIF in the existing upload control and retain PDF as evidence-only. | AC5 | Exercise QIF and PDF in the workspace. | Complete |
| 4 | Validate and review TASK-012 | Reconcile parser, emulator, privacy, browser, and workflow evidence. | AC1, AC2, AC3, AC4, AC5 | Inspect evidence and Epic audit. | Complete |

## Parent AC Evidence

- AC15: `evidence/qif-import-qa.md` records the privacy-safe 111-record
  structural comparison, parser assertions, same-format/cross-format
  idempotency, malformed-input denial, PDF evidence-only behavior, and the
  rendered QIF journey. `EVIDENCE.json` contains a passing fidelity claim.

## QA & Code Review

- Date: 2026-07-29
- Verdict: Pass.
- Evidence: QIF parser and fingerprint tests; privacy-safe owner-file aggregate
  comparison; authenticated emulator same-format/cross-format overlap,
  malformed-input, outsider, and PDF probes; in-app Browser QIF import;
  TypeScript, lint, build, and passing structured evidence.
- Findings: Browser QA identified the generic
  `application/octet-stream` MIME emitted for QIF uploads. Support was added
  only for `.qif` files that also pass strict UTF-8 and `!Type:` signature
  validation.
- Proof boundaries: only the observed Bank QIF dialect is supported. PDF is
  retained as evidence and is not parsed into transactions.

## Retro

- Date: 2026-07-29
- Reusable lessons: Browser MIME is weak QIF evidence; accept a generic MIME
  only when extension, UTF-8 decoding, and QIF signature all agree. Cross-format
  idempotency depends on the normalized transaction identity, not source bytes.
- Conventions or agent assets updated: Added the browser-QIF validation rule to
  `.project-workflow/guidance.md`.
- Follow-up tasks: Support another QIF dialect only after observing and
  privacy-safely characterising a real export that the current parser rejects.
- Missed in-scope work: None.

## Notes

- Task: TASK-012
- Title: Add optional QIF import support only where it improves coverage beyond CSV, and keep PDF ingestion as a fallback/source-evidence path
- Created: 2026-07-29
