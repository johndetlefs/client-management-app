# Requirements

## Summary

- Task: TASK-005
- Epic: EPIC-001 Business Expenses Import and Tax Reporting
- Title: Build the expense review workspace where candidates can be marked Business, Personal, Mixed use, or Ignore before confirmation
- Parent AC Coverage: AC5, AC13, AC14
- Last updated: 2026-07-29

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

## Overview

This task creates the first usable workspace for reviewing imported expense candidates. Imported rows can contain personal and business spending, so the user needs a fast way to triage candidates before later tasks convert Business and Mixed use rows into confirmed accountant-ready expenses.

## User Story

As a business owner, I want to review imported expense candidates and mark each row as Business, Personal, Mixed use, or Ignore, so that only relevant transactions continue toward accountant-ready expense records.

## Goal

Add a tenant-scoped expense review page and server-side review actions for imported candidates.

## Non-Goals

- Do not create confirmed expense records in this task.
- Do not build accountant category, GST treatment, tax invoice, receipt, recurring, subscription, or notes editing in this task.
- Do not build merchant rule learning or recurring detection in this task.
- Do not build CSV upload UI in this task.
- Do not delete or minimise personal/ignored candidates yet; retention policy belongs to TASK-011.
- Do not build Excel export or BAS reporting in this task.

## Users & Context

- Primary user: business owner who has imported a personal bank/card CSV and needs to separate business from personal transactions.
- Context: candidates already exist under `tenants/{tenantId}/expenseCandidates` from TASK-003/TASK-004.
- Context: personal transactions are sensitive, so the review screen should display only the information needed to make the triage decision.
- Context: this is a multi-tenant app; reads and writes must remain tenant-scoped and server actions must enforce owner/staff access.

## Requirements (Outcome-Focused)

- Add an expenses review workspace reachable from the authenticated workspace area.
- List tenant expense candidates with posted date, merchant/description, amount, direction, bank category hints, duplicate warning status, import batch ID, and current review status.
- Provide filters or grouped counts for unreviewed, Business, Personal, Mixed use, Ignore, and possible duplicate rows.
- Allow a user to mark one candidate as Business, Personal, Mixed use, or Ignore.
- Persist review transitions by updating the candidate `reviewStatus`, `reviewedAt`, `reviewedBy`, `updatedAt`, and `updatedBy` fields.
- Keep candidates `active` in this task regardless of review choice.
- Enforce owner/staff access before listing candidates or updating review status.
- Serialize Firestore timestamps and avoid returning raw Firestore objects to client components.
- Make duplicate warnings visible enough that the user can avoid accidentally reviewing a possible duplicate as a business expense.

## Acceptance Criteria (Verifiable)

- AC1: A signed-in owner/staff user can open the expenses review workspace from the app and see imported candidates for the active tenant.
- AC2: Candidate rows show date, merchant/description, amount, direction, bank category/subcategory where available, duplicate status, and current review status.
- AC3: A candidate can be marked Business, Personal, Mixed use, or Ignore from the review workspace.
- AC4: Marking a candidate updates only that tenant's candidate document and records reviewer/update metadata.
- AC5: After marking a candidate, the workspace reflects the new review status.
- AC6: Possible duplicate rows are visibly flagged before review.
- AC7: Unauthorised users or users outside the tenant cannot list or mutate candidates through the server actions.
- AC8: The task does not create confirmed expenses.
- AC9: `npm run lint` passes or any failure is reported with scope.

## Open Questions (Answer Needed)

- None blocking for this task. The detailed accountant fields for Business/Mixed use confirmation remain TASK-006.

## Decisions (Resolved)

- Business/Mixed use in this task means candidate review status only; confirmed expense creation happens later.
- Personal and Ignore rows remain active until the retention/minimisation task defines policy.
- The first review workspace can be a pragmatic list/table view with per-row actions rather than a full accountant categorisation workflow.

## Validation Plan

- Run `npm run lint`.
- Run `npm run build` because this task adds frontend route/components and server actions.
- Manually verify the page structure and action wiring where practical with local data or code review; emulator-backed workflow tests remain TASK-013.
