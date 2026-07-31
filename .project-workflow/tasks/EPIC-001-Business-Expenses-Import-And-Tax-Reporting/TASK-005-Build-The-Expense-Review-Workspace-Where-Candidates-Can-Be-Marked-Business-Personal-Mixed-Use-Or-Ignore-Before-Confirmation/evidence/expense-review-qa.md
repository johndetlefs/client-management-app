# TASK-005 Expense Review QA

- Date: 2026-07-29
- Source baseline: `764e333c69bf4dbde53aad355bf03422cbd8fc08` plus the current uncommitted TASK-005 working tree
- Runtime target: `http://localhost:3001/workspace/expenses`
- Runtime source: this repository's `npm run dev` process with Firebase Auth and Firestore emulators

## Automated Validation

- `npm run lint`: pass
- `npm run build`: pass, including TypeScript and `/workspace/expenses` route generation
- `git diff --check`: pass

## Owner Flow

- Signed in through the Firebase Auth emulator as synthetic owner `expenses.owner@example.test`.
- Loaded two tenant-scoped synthetic candidates.
- Confirmed the required date, merchant, raw description, bank hints, amount, direction, status, and review controls were rendered.
- Confirmed one `possible_duplicate` candidate displayed a visible warning.
- Marked the Adobe candidate as Business.
- Observed the workspace update from `2 unreviewed / Business 0` to `1 unreviewed / Business 1`.
- Read the emulator document and confirmed `reviewStatus=business`, populated timestamps, and `reviewedBy`/`updatedBy` equal the verified owner UID.

## Authorization

- Signed in as synthetic outsider `expenses.outsider@example.test`.
- The outsider profile pointed to the QA tenant, but the user had no `tenants/{tenantId}/users/{uid}` membership document.
- Candidate listing returned `User is not a member of this tenant` and rendered no candidate data.
- A temporary local QA probe called the real review server action for a known candidate; mutation returned the same membership error.
- The temporary probe route was removed after the check.

## Responsive Visual Behavior

- Desktop context: 1280x900; summary, filters, candidate fields, duplicate warning, and all review controls were visible without overlap.
- Mobile context: 390x844; summary and filters reflowed without document-level horizontal overflow.
- The fixed-width review table remained inside its horizontal scroll container; scrolling exposed the Business, Personal, Mixed use, and Ignore controls.

## Artifacts

- `expense-review-desktop.jpg`
  - SHA-256: `ae9a856e3b31af88a05a815f093eb4e1c61f8c650ad9d566e3b529f330607488`
- `expense-review-mobile.jpg`
  - SHA-256: `b2b59657a64c6afcf98a979a6d23b5f983816cc83d0bd7d01164605cafbfefb6`
- `expense-review-mobile-actions.jpg`
  - SHA-256: `c585819c0e75a9ad195bf53ea48a0acbc347e4c7784887e5911f994774e1a6f3`

## Proof Boundary

- This proves the local emulator-backed TASK-005 review workflow and current working-tree UI.
- It does not prove production deployment, live Firebase configuration, or the separate import idempotency transaction boundary.
