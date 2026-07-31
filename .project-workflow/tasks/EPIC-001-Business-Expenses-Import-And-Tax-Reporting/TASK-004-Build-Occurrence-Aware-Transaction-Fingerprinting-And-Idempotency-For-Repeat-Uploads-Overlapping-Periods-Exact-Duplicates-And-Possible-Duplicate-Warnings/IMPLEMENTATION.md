## User Story

As a business owner, I want repeated or overlapping bank CSV uploads to import only net-new transaction occurrences, so that I can safely upload exports without cleaning up duplicate expense candidates.

## Goal

Make the CSV import path idempotent by comparing parsed fingerprints and occurrence indexes with existing tenant candidates and confirmed expenses before writing new candidate rows.

## Approach

Keep the parser deterministic and add the duplicate decision layer inside the server-side import path after the owner/staff access guard. Query only tenant-scoped expense collections, build exact-match and possible-match indexes in memory, then write only the candidate rows that should be reviewed.

## Phases

1. Duplicate lookup model: define exact occurrence keys and possible duplicate matching data from existing candidates and expenses.
2. Import decision layer: classify parsed rows as skipped exact duplicate, possible duplicate candidate, or net-new candidate.
3. Persistence and result metadata: write only reviewable candidates, update import counts, and return duplicate summaries for the future UI.
4. Validation: run lint/build and cover deterministic duplicate scenarios with redacted data.

## Tasks

|  ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
|   1 | Build duplicate lookup helpers | Add tenant-scoped helper logic that loads existing candidates and expenses by fingerprint/date and builds exact occurrence and possible duplicate indexes. | - Existing candidates and expenses are read only from the active tenant.<br>- Exact keys use `transactionFingerprint` plus `occurrenceIndex`.<br>- Possible matches use date/direction/amount with a different fingerprint. | - Review helper code.<br>- Run validation commands. | Done |
|   2 | Classify parsed import rows | Decide whether each parsed row should be skipped, created as new, or created as a possible duplicate warning. | - Repeat upload rows are skipped.<br>- Overlapping upload rows create only net-new occurrences.<br>- Repeated identical transactions retain distinct occurrence indexes.<br>- Possible duplicates are flagged without blocking import. | - Review import decision output.<br>- Run validation commands. | Done |
|   3 | Persist idempotent import results | Update the import action so candidate writes and import counts reflect the duplicate decisions and result metadata reports skipped/possible matches. | - Only reviewable candidates are written.<br>- Counts include created candidate rows and skipped exact duplicates.<br>- Possible duplicate candidates link to matched candidate or expense where available. | - Review server action.<br>- Run validation commands. | Done |

## Validation

- `npm run lint` passed on 2026-06-11.
- `npm run build` passed on 2026-06-11.
- Manual scenario coverage was reviewed in code against same-file repeats, overlapping statements, repeated identical transactions, existing candidate matches, existing expense matches, and possible duplicate warnings. Emulator-backed import scenario tests remain for TASK-013.

## Parent AC Evidence

- AC2: TASK-013 refreshed exact-repeat and concurrent-import persisted evidence
  in
  `../TASK-013-Add-Validation-Coverage-For-Parsing-Idempotency-Tenant-Scoping-Permissions-Review-Transitions-Merchant-Rules-Exports-And-Bas-Summaries/evidence/epic-validation-qa.md`.
- AC3: The same bundle records CSV/CSV and CSV/QIF overlapping-period evidence
  with only net-new occurrences created.
- AC4: The same bundle records two legitimate same-day identical occurrences
  and repeat-import deduplication.

## QA & Code Review

- Date: 2026-06-11
- Verdict: Pass
- Reviewed areas: `src/lib/expenses/idempotency.ts`, `src/app/workspace/expenses/actions.ts`, `src/lib/expenses/csv.ts`, `src/types/expense.ts`.
- Evidence:
  - `npm run lint` passed on 2026-06-11.
  - `npm run build` passed on 2026-06-11.
  - Acceptance criteria mapped to tenant-scoped duplicate reads, exact `transactionFingerprint` plus `occurrenceIndex` skipping, deterministic possible duplicate warnings, candidate status/default persistence, and result/count metadata.
- Findings:
  - No blocking findings.
  - Emulator-backed duplicate scenario tests remain deferred to TASK-013 as planned.

## Retro

- Date: 2026-06-11
- Reusable lessons:
  - Idempotent import paths are easier to reason about when duplicate lookup, row classification, and persistence counts are separated.
  - Deterministic candidate IDs provide an additional safety layer, but user-facing duplicate behaviour should still be driven by explicit tenant-scoped lookup decisions.
- Conventions or agent assets updated: None.
- Follow-up tasks: Continue with TASK-005 for the candidate review workspace; emulator-backed scenario tests remain tracked in TASK-013.

## Notes

- Task: TASK-004
- Epic: EPIC-001
- Title: Build occurrence-aware transaction fingerprinting and idempotency for repeat uploads, overlapping periods, exact duplicates, and possible duplicate warnings
- Created: 2026-06-11
