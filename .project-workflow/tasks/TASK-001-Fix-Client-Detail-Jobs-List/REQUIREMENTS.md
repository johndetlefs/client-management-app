# Requirements

## Summary

- Task: TASK-001
- Title: Fix Client Detail Jobs List
- Last updated: 2026-06-01

## Goal

Client detail pages must show the jobs that belong to that client, consistent with the global Jobs tab.

## Non-Goals

- Changing job creation, editing, deletion, invoice generation, or client assignment workflows.
- Changing Firestore data shape unless required to read the existing shape safely.

## Users & Context

Users reviewing a client expect the client detail page to surface that client's jobs. The global Jobs tab already lists jobs and shows their associated client, so the missing client-page list appears to be a client detail data/query/rendering bug.

## Requirements (Outcome-Focused)

- The client detail Jobs section shows all existing jobs associated with the viewed client.
- The global Jobs tab remains unchanged and continues to list jobs with their client context.
- The fix respects tenant scoping and does not introduce cross-tenant reads.
- Empty-state messaging remains available only when a client genuinely has no jobs.

## Acceptance Criteria (Verifiable)

- AC1: Given a client with one or more jobs, opening that client's detail page displays those jobs in the Jobs section.
- AC2: The client detail Jobs section uses the same client-job relationship as the global Jobs tab, so records are not missed because of mismatched field names or stale assumptions.
- AC3: Given a client with no jobs, the client detail page displays the existing no-jobs empty state.
- AC4: Lint passes after the change.

## Open Questions (Answer Needed)

- None. The user confirmed the jobs exist in the global Jobs tab and should appear on the client page.

## Decisions (Resolved)

- Treat this as a bug fix in the existing client detail surface, not a broader redesign.
- Verify locally in the browser while the app is running.

## Validation Plan

- Reproduce locally by opening the app, comparing global Jobs tab data with the affected client detail page, applying the fix, and rechecking the client Jobs section.
- Run `npm run lint`.
