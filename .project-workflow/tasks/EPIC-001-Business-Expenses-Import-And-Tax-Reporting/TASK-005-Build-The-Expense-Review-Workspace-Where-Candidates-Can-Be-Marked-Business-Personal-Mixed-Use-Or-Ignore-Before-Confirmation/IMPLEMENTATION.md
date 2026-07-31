## User Story

As a business owner, I want to review imported expense candidates and mark each row as Business, Personal, Mixed use, or Ignore, so that only relevant transactions continue toward accountant-ready expense records.

## Goal

Add a tenant-scoped review workspace and review-status mutation path for imported expense candidates.

## Parent AC Coverage

- AC5, AC13, AC14

## Child Charter

### Inherited Invariants

- Authenticate the server caller; never authorize from a client-supplied user ID.
- Scope all expense data under `tenants/{tenantId}`.
- Preserve source privacy and do not expose unrelated personal transaction details.

### Invalid Substitutes

- A successful lint or build does not prove authenticated server authorization, tenant isolation, or visible browser behavior.
- Client-supplied tenant or user identifiers do not prove the caller's identity or authorization.
- Code inspection or an HTTP 200 response does not prove the workspace renders or that review actions work.

### Artifact Targets

- Authenticated tenant-scoped expense-candidate list and review actions.
- Rendered review workspace with visible duplicate warnings and persisted review transitions.

### Parent AC Proof Ownership

- AC5: owner `TASK-005, TASK-013`; required evidence: in-app Browser review transitions plus persisted emulator state.
- AC13: owner `TASK-002, TASK-005, TASK-013`; required evidence: emulator-backed tenant-path and cross-tenant isolation.
- AC14: owner `TASK-002, TASK-005, TASK-013`; required evidence: verified-token owner/staff authorization and unauthorized-call rejection.

## Acceptance Criteria

- AC1: An authenticated owner/staff user can load active-tenant expense candidates.
- AC2: Candidate rows expose the required review context.
- AC3: Business, Personal, Mixed use, and Ignore transitions are available.
- AC4: Review writes remain tenant-scoped and record authenticated reviewer metadata.
- AC5: Successful transitions are reflected in the workspace.
- AC6: Possible duplicates are visibly distinguished before review.
- AC7: Unauthenticated and cross-tenant callers cannot list or mutate candidates.
- AC8: Review transitions do not create confirmed expense records.
- AC9: Static validation passes or failures are scoped.

## Approach

Build a practical review surface first: tenant-scoped server actions load and mutate candidates, and a workspace page renders candidate rows with clear status filters, duplicate warnings, and per-row review actions. Keep confirmation/accountant fields out of this task.

## Phases

1. Candidate review data access: add server-side list and review-status update functions with owner/staff access checks.
2. Review workspace UI: add an authenticated expenses page with candidate table/list, status counts, duplicate warnings, and action buttons for Business, Personal, Mixed use, and Ignore.
3. Validation: run lint/build and review UI/action wiring against acceptance criteria.

## Task List

|  ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
|   1 | Add review actions | Add tenant-scoped server actions to list candidates and update one candidate review status. | AC1, AC3, AC4, AC5, AC7, AC8 | - Review server action code.<br>- Run validation commands. | Done |
|   2 | Add review workspace page | Build the workspace expenses page for scanning candidates and marking review decisions. | AC1, AC2, AC3, AC5, AC6 | - Open the page in the in-app Browser.<br>- Exercise review actions with emulator data. | Done |
|   3 | Preserve task boundary | Ensure the review workflow does not create confirmed expense records or apply retention/minimisation policy. | AC8, AC9 | - Review mutation code.<br>- Run validation commands. | Done |

## Validation

- `npm run lint` passed on 2026-06-11.
- `npm run build` passed on 2026-06-11.
- Local route check returned `200 OK` for `http://localhost:3000/workspace/expenses` on 2026-06-11.
- Manual review confirmed review actions update candidate status metadata only and do not create confirmed expense records.
- Pre-adoption evidence above is retained as history but was not trusted for the 2026-07-29 review.
- `npm run lint` passed on 2026-07-29.
- `npm run build` passed on 2026-07-29, including TypeScript and route generation.
- In-app Browser and emulator validation passed for owner list/review, persisted reviewer metadata, outsider list/mutation rejection, duplicate-warning visibility, and 1280x900 plus 390x844 viewports.
- Detailed evidence: `evidence/expense-review-qa.md`.

## Parent AC Evidence

- AC5: The in-app Browser rendered seeded candidates, exposed all four review decisions, visibly flagged a possible duplicate, and reflected a Business transition; see `evidence/expense-review-qa.md`.
- AC13: Emulator evidence proved the owner could read/update only the QA tenant candidate and an authenticated non-member could neither list nor mutate that tenant's candidates.
- AC14: Firebase Admin verified the client ID token, reviewer metadata used the decoded UID, and non-member list/mutation calls were rejected.

## QA & Code Review

- Date: 2026-07-29
- Verdict: Pass
- Reviewed areas: authenticated caller identity, owner/staff membership, tenant-scoped reads/writes, reviewer metadata, timestamp serialization, review-state UI, duplicate warnings, error states, and responsive visual behavior.
- Evidence:
  - `npm run lint`: pass.
  - `npm run build`: pass.
  - `git diff --check`: pass.
  - In-app Browser plus Firebase emulator evidence: `evidence/expense-review-qa.md`.
- Findings:
  - Resolved: server actions previously trusted a client-supplied user ID. They now verify a Firebase ID token and derive the UID server-side.
  - Resolved: Admin Auth emulator configuration could be skipped when a hot-reloaded process reused an existing Admin app.
  - Resolved: an authorization error previously appeared alongside the misleading `No candidates` empty state.
  - No remaining TASK-005 blocking findings.

## Retro

- Date: 2026-07-29
- Reusable lessons:
  - Tenant membership checks are not authorization unless the server first derives the UID from a verified caller credential.
  - Firebase Auth emulator configuration must run before reusing an existing Admin app so hot reloads cannot bypass emulator token verification.
  - A route response and successful build do not prove visible review behavior, persisted metadata, or cross-tenant denial.
- Conventions or agent assets updated:
  - `.project-workflow/guidance.md` now explicitly rejects client-supplied user IDs as authorization.
  - The adopted epic contract records the required authorization, browser, and emulator proof boundaries.
- Follow-up tasks:
  - Route the completed TASK-004 import read/decision/write transaction gap through the lightweight Fix workflow before confirmed-expense persistence depends on it.
- Missed in-scope work:
  - None after the review corrections and emulator-backed revalidation.

## Notes

- Task: TASK-005
- Epic: EPIC-001
- Title: Build the expense review workspace where candidates can be marked Business, Personal, Mixed use, or Ignore before confirmation
- Created: 2026-06-11
