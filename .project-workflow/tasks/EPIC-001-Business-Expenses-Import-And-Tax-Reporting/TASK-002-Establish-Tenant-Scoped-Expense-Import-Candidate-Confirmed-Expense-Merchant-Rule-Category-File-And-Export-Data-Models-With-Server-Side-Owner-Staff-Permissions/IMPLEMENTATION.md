## User Story

As a business owner, I want expense import records, candidate transactions, confirmed expenses, merchant rules, categories, source files, and exports to have clear tenant-scoped data shapes and access gates, so that CSV imports can be added without risking cross-tenant data leaks, duplicate storage patterns, or inconsistent accounting fields.

## Goal

Establish the expense domain contracts and server-side tenant access primitives required before CSV import can safely persist data.

## Approach

Keep this task intentionally foundational. Add shared TypeScript types for the expense domain, add canonical server-side Firestore reference helpers under `tenants/{tenantId}`, and add a reusable owner/staff access guard for future expense server actions. Do not add CSV parsing, UI, exports, or BAS calculations here.

## Phases

1. Domain contracts: define expense import, candidate, confirmed expense, merchant rule, category, source file, and export types with minor-unit money fields and idempotency metadata.
2. Server references: centralise canonical Firestore collection/doc helpers for expense records under `tenants/{tenantId}`.
3. Access guard: add reusable owner/staff verification for future expense mutations and exports.
4. Validation: run lint and record evidence.

## Tasks

|  ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
|   1 | Define expense domain types | Add central TypeScript contracts for import batches, candidates, expenses, merchant rules, categories, source files, exports, statuses, GST treatment, and retention state. | - Types include tenant, audit, source, idempotency, accounting, and review fields from requirements.<br>- Money fields use minor units.<br>- No real bank/customer data is added. | - Review `src/types` expense module.<br>- Run `npm run lint`. | Done |
|   2 | Add tenant-scoped expense Firestore helpers | Add server-side helpers that return canonical Firestore refs/paths for each expense collection under `tenants/{tenantId}`. | - Helpers cover import batches, candidates, expenses, merchant rules, categories, source files, and exports.<br>- No helper points outside `tenants/{tenantId}`.<br>- Helpers use server/admin Firestore APIs. | - Review helper paths.<br>- Run `npm run lint`. | Done |
|   3 | Add owner/staff access guard | Add reusable server-side verification that a user is a member of the tenant with role `owner` or `staff` before expense actions proceed. | - Guard checks `tenants/{tenantId}/users/{userId}`.<br>- Guard accepts owner/staff and rejects missing/other roles.<br>- Future actions can call it without duplicating role lookup code. | - Review guard implementation.<br>- Run `npm run lint`. | Done |

## Validation

- `npm run lint` passed on 2026-06-03 after QA hardening.

## Parent AC Evidence

- AC13: TASK-013 refreshed Firestore and Storage tenant-path evidence and
  outsider/cross-tenant denial in
  `../TASK-013-Add-Validation-Coverage-For-Parsing-Idempotency-Tenant-Scoping-Permissions-Review-Transitions-Merchant-Rules-Exports-And-Bas-Summaries/evidence/epic-validation-qa.md`.
- AC14: TASK-013 refreshed verified owner/staff access plus unauthenticated,
  outsider, cross-tenant, and owner-only mutation denial in the same dated
  evidence bundle.

## QA & Code Review

- Date: 2026-06-03
- Reviewed areas: expense domain types, tenant-scoped Firestore path helpers, owner/staff access guard, scope against TASK-002 requirements.
- Validation evidence: `npm run lint` passed.
- Findings: Path helper hardening was needed so tenant and document IDs cannot contain `/` or be empty before being interpolated into Firestore paths. Fixed in `src/lib/expenses/firestore.ts`.
- Verdict: Pass

## Retro

- Date: 2026-06-03
- Reusable lessons: Tenant-scoped path helpers should validate every dynamic Firestore ID segment before string interpolation, even when existing app patterns pass tenant IDs from trusted workspace context.
- Conventions or agent assets updated: None. Existing `AGENTS.md` already requires tenant scoping and server-side access checks.
- Follow-up tasks: Continue with TASK-003 for CSV import pipeline using the completed expense domain types and access guard.

## Notes

- Task: TASK-002
- Epic: EPIC-001
- Title: Establish tenant-scoped expense import, candidate, confirmed expense, merchant rule, category, file, and export data models with server-side owner/staff permissions
- Created: 2026-06-02
