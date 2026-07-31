## User Story

As a business owner, I want to submit my bank's CSV transaction export and have it converted into reviewable expense candidates, so that I can later mark which transactions are business, personal, mixed use, or ignored without manually retyping the statement.

## Goal

Create the first deterministic expenses input path by parsing the observed bank CSV format and writing tenant-scoped import batches plus unreviewed candidates.

## Approach

Build this as server-side plumbing first. Add a pure parser/normaliser that can be validated without UI, then add a server action that enforces tenant access and persists the import batch/candidates using the TASK-002 helpers. Defer cross-import dedupe to TASK-004 but populate fingerprint and occurrence fields now.

## Phases

1. CSV parser and normaliser: parse the observed CSV shape, validate data, convert dates/amounts, and compute fingerprints.
2. Server import action: enforce owner/staff access and write import batch/candidates under the tenant.
3. Validation: run lint and a build/type check if needed.

## Tasks

|  ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
|   1 | Add CSV parser | Add a reusable parser for `Date`, `Description`, `Debit`, `Credit`, `Category`, `SubCategory` with BOM/CRLF/quoted-field support. | - Valid CSV returns parsed rows.<br>- Missing headers, bad row widths, invalid dates, invalid amounts, both debit/credit, and neither debit/credit are rejected.<br>- Real bank data is not committed. | - Review parser module.<br>- Run validation commands. | Done |
|   2 | Normalise candidate inputs | Convert parsed rows to candidate-ready values including ISO date, minor-unit amount, direction, normalised merchant name, bank category hints, fingerprint, and occurrence index. | - Debit/credit direction is preserved.<br>- Money is integer minor units.<br>- Identical row fingerprints get stable occurrence indexes within the import. | - Review parser output shape.<br>- Run validation commands. | Done |
|   3 | Add server import action | Add a server-side function/action that checks owner/staff tenant access and writes an import batch plus one candidate per parsed row. | - Writes use TASK-002 tenant-scoped helpers.<br>- Import batch counts are recorded.<br>- Candidates start `unreviewed`, `active`, and `new`. | - Review server action.<br>- Run validation commands. | Done |

## Validation

- `npm run lint` passed on 2026-06-03.
- `npm run build` passed on 2026-06-03 after rerunning with network access for Google Fonts.

## Parent AC Evidence

- AC1: TASK-013 refreshed synthetic bank-shaped parser, normalized row,
  import-batch, candidate, and rendered import evidence in
  `../TASK-013-Add-Validation-Coverage-For-Parsing-Idempotency-Tenant-Scoping-Permissions-Review-Transitions-Merchant-Rules-Exports-And-Bas-Summaries/evidence/epic-validation-qa.md`.

## QA & Code Review

- Date: 2026-06-11
- Verdict: Pass
- Reviewed areas: `src/lib/expenses/csv.ts`, `src/app/workspace/expenses/actions.ts`, `src/lib/expenses/firestore.ts`, `src/types/expense.ts`.
- Evidence:
  - `npm run lint` passed on 2026-06-11.
  - `npm run build` passed on 2026-06-11.
  - Acceptance criteria mapped to parser validation, tenant-scoped Firestore helpers, owner/staff access guard use, import batch creation, candidate creation, and unreviewed/new/active default statuses.
- Findings:
  - Fixed header validation so the first CSV parser accepts the observed bank header exactly instead of accepting extra/reordered columns.
  - Fixed source account consistency so the value stored on import batches/candidates matches the value used to create transaction fingerprints.

## Retro

- Date: 2026-06-11
- Reusable lessons:
  - Parser boundary checks should be strict for known bank export formats before later tasks build idempotency and review workflows on top of the parsed shape.
  - Any source field used in deterministic fingerprints should be persisted in the same normalized form so later duplicate checks can explain their matches.
- Conventions or agent assets updated: None.
- Follow-up tasks: Continue with TASK-004 for cross-import idempotency, overlapping statement imports, and possible duplicate warnings.

## Notes

- Task: TASK-003
- Epic: EPIC-001
- Title: Build the CSV import pipeline for the observed bank format and create tenant-scoped import batches plus reviewable candidates
- Created: 2026-06-03
