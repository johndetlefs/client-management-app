## User Story

As a user viewing a client, I want the client page Jobs section to list that client's jobs, so that I can review work for the client without switching to the global Jobs tab.

## Goal

Fix the data/query/rendering path that leaves jobs missing from the client detail page while preserving the working global Jobs tab.

## Approach

Trace the existing client detail Jobs section and the global Jobs tab, identify the mismatch in how client-linked jobs are loaded or filtered, then make the smallest scoped change to align the client page with the existing job relationship.

## Phases

1. Reproduce and trace the jobs/client data flow locally.
2. Patch the client detail jobs loading/rendering path.
3. Validate with browser checks and lint.

## Tasks

|  ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
|   1 | Show client jobs on client detail | Make the client detail Jobs section render jobs associated with the viewed client using the app's existing tenant-scoped job/client relationship. | - Client with jobs displays those jobs on the client detail page (AC1).<br>- Global Jobs tab behavior is unchanged (AC2).<br>- Client with no jobs still gets an empty state (AC3).<br>- Lint passes (AC4). | - Open local app, compare Jobs tab to affected client detail Jobs section, and run `npm run lint`. | Complete |

## Notes

- Task: TASK-001
- Title: Fix Client Detail Jobs List
- Created: 2026-06-01
