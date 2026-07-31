# Requirements

## Summary

- Task: TASK-002
- Epic: EPIC-001 Business Expenses Import and Tax Reporting
- Title: Establish tenant-scoped expense import, candidate, confirmed expense, merchant rule, category, file, and export data models with server-side owner/staff permissions
- Last updated: 2026-06-02

## Overview

This task establishes the shared data contracts and server-side access helpers that future CSV import, candidate review, merchant learning, export, and BAS-summary work will build on. It should not build the importer UI or parser yet; it should make those tasks safe and predictable.

## User Story

As a business owner, I want expense import records, candidate transactions, confirmed expenses, merchant rules, categories, source files, and exports to have clear tenant-scoped data shapes and access gates, so that CSV imports can be added without risking cross-tenant data leaks, duplicate storage patterns, or inconsistent accounting fields.

## Goal

Create the foundational expense domain model and server-side permission path for the CSV-first expenses epic.

## Non-Goals

- Do not build CSV parsing or upload handling in this task.
- Do not build the expense review UI in this task.
- Do not build accountant Excel export or BAS calculations in this task.
- Do not add live bank feed integrations.
- Do not store real bank/customer data fixtures in git.
- Do not make final tax-accounting category decisions beyond seedable/default-safe enum shapes.

## Users & Context

- Primary user: business owner importing a personal card/bank CSV containing mixed personal and business transactions.
- Secondary user: accountant receiving exported expense/tax information later in the epic.
- Context: all expense-related Firestore records must live under `tenants/{tenantId}`.
- Context: expense candidates may include personal transactions, so candidate metadata must support later retention/minimisation decisions.
- Context: existing server actions commonly accept `tenantId` from the client, so this task should add reusable server-side checks that future expense actions can call before mutating tenant data.

## Requirements (Outcome-Focused)

- Define TypeScript types for expense import batches, imported expense candidates, confirmed expenses, merchant rules, expense categories, source files, export records, GST treatment, review statuses, and retention-related statuses.
- Document the intended Firestore paths under `tenants/{tenantId}` for each expense collection.
- Include source import metadata fields so future importer tasks can link candidates and expenses back to the uploaded file/import batch.
- Include idempotency fields on candidates/import records for future occurrence-aware duplicate detection: source account key, source transaction id when present, transaction fingerprint, occurrence index, and duplicate/re-import status.
- Include accounting fields on confirmed expenses: minor-unit amount, business-use percentage, claimable amount, GST treatment, GST amount, category, tax invoice/receipt status, recurring/subscription flags, notes, and review status.
- Include merchant rule fields for future suggested classification without overwriting confirmed user/accountant decisions.
- Add reusable server-side helper functions for tenant expense collection/document references so future actions do not hand-build inconsistent Firestore paths.
- Add reusable server-side owner/staff access verification that future expense import, mutation, export, and file actions can call before touching tenant-scoped expense data.
- Keep all new model code free of client-only Firebase SDK assumptions when it is intended for server-side actions.

## Acceptance Criteria (Verifiable)

- The codebase has a central expense type module with exported interfaces/types for import batches, candidates, confirmed expenses, merchant rules, categories, files, and exports.
- All expense domain types include `tenantId`, audit timestamps, and user attribution where applicable.
- Monetary fields in expense domain types are represented in minor units, not floating point dollars.
- Candidate/import types include fields needed to support re-import idempotency without relying on a bank transaction ID.
- Confirmed expense types include fields needed by accountant export and BAS preparation.
- Merchant rule types support suggestion confidence/source and do not imply irreversible automatic classification.
- A server-side helper exposes canonical Firestore paths/references under `tenants/{tenantId}` for the expense collections.
- A server-side access helper verifies that a user belongs to the tenant and has role `owner` or `staff` before future expense actions proceed.
- The task introduces no real bank statement, customer, secret, or live Firebase data into git.
- `npm run lint` passes or any failure is reported with scope.

## Open Questions (Answer Needed)

- None blocking for this task. Detailed retention policy, accountant category list, BAS cadence, and receipt matching remain open at the epic level and should be handled by later child tasks.

## Decisions (Resolved)

- CSV is the first input path for the epic.
- This task is the prerequisite for CSV import because the importer needs tenant-scoped records and permission checks before it can safely persist candidate rows.
- Expense records are business-level records and are not tied to individual clients by default.
- Candidate data may contain personal spending, so the model must distinguish unreviewed, personal, ignored, mixed-use, and confirmed business outcomes.
- All persisted money values must use minor units.
- The data model should support future QIF/OFX/PDF source types without making them first-class implementation work in this task.

## Validation Plan

- Review the exported TypeScript types for the acceptance criteria above.
- Run `npm run lint`.
- If lint is blocked by unrelated existing issues, run the narrowest relevant TypeScript/static check available and report the limitation.
