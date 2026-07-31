# Requirements

## Summary

- Task: TASK-004
- Epic: EPIC-001 Business Expenses Import and Tax Reporting
- Title: Build occurrence-aware transaction fingerprinting and idempotency for repeat uploads, overlapping periods, exact duplicates, and possible duplicate warnings
- Last updated: 2026-06-11

## Overview

This task makes CSV imports safe to repeat. The TASK-003 parser already creates deterministic transaction fingerprints and occurrence indexes for rows within one CSV. This task uses those fields across existing tenant candidates and confirmed expenses so re-uploading the same file, or uploading an overlapping statement period, does not create duplicate review work or duplicate expense records.

## User Story

As a business owner, I want repeated or overlapping bank CSV uploads to import only net-new transaction occurrences, so that I can safely upload exports without cleaning up duplicate expense candidates.

## Goal

Add idempotency to the CSV import path by comparing parsed transaction fingerprints and occurrence indexes against existing tenant expense candidates and confirmed expenses before writing new candidates.

## Non-Goals

- Do not build the browser upload UI in this task.
- Do not build the candidate review workspace in this task.
- Do not confirm candidates into expenses in this task.
- Do not build merchant learning, recurring/subscription detection, accountant exports, BAS summaries, QIF parsing, or PDF parsing in this task.
- Do not attempt fuzzy AI matching or paid third-party enrichment.
- Do not commit real bank data or customer data.

## Users & Context

- Primary user: business owner importing personal bank/card CSV exports that can overlap previous imports.
- Context: the bank CSV does not provide a stable transaction ID, so exact idempotency relies on deterministic fingerprints plus occurrence indexes.
- Context: repeated same-day transactions with identical merchant and amount are legitimate separate occurrences and must not be collapsed.
- Context: all duplicate checks must stay scoped under `tenants/{tenantId}` and must respect owner/staff access enforcement already present in the import action.

## Requirements (Outcome-Focused)

- Detect exact already-imported rows by matching `transactionFingerprint` and `occurrenceIndex` against existing tenant expense candidates and confirmed expenses.
- Skip writing new candidate documents for exact matches while preserving counts that explain how many rows were parsed, created, and skipped as duplicates.
- Treat repeated identical transactions as occurrence-counted rows: if one occurrence already exists and a later overlapping CSV has two identical occurrences, only the second occurrence is created.
- Keep new net-new rows as `unreviewed`, `active`, and `new`.
- Flag likely duplicates as `possible_duplicate` when a new row has the same date, direction, and amount as an existing candidate or expense but a different transaction fingerprint.
- Link possible duplicate candidates to the best available existing candidate or confirmed expense using the existing duplicate reference fields.
- Return import result metadata that allows a future UI to report skipped exact duplicates and possible duplicate warnings.
- Keep all reads and writes tenant-scoped under `tenants/{tenantId}`.

## Acceptance Criteria (Verifiable)

- Re-uploading the same parsed CSV skips every already-imported transaction occurrence and creates no new candidate documents.
- Uploading an overlapping period, such as January followed by January-February, creates candidates only for transaction occurrences not already represented by existing candidates or expenses.
- Two identical transactions in one import are represented as separate occurrence indexes and are not collapsed into one candidate when both are net-new.
- A parsed row matching an existing confirmed expense by fingerprint and occurrence index is skipped instead of creating another candidate.
- A parsed row matching an existing candidate by fingerprint and occurrence index is skipped instead of creating another candidate.
- A parsed row with the same posted date, direction, and amount as an existing record but a different fingerprint is created with `duplicateStatus: "possible_duplicate"` and a reference to the matched candidate or expense where available.
- Import counts report created candidates and skipped exact duplicates accurately.
- The import path still calls the owner/staff access guard before any duplicate reads or writes.
- `npm run lint` passes or any failure is reported with scope.

## Open Questions (Answer Needed)

- None blocking for this task. Future UI copy for duplicate summaries belongs with the upload/review workspace.

## Decisions (Resolved)

- Exact idempotency uses `transactionFingerprint` plus `occurrenceIndex`.
- Possible duplicate warnings are deterministic and local: same tenant, same date, same direction, same amount, different fingerprint.
- Exact duplicate rows are skipped rather than persisted as additional candidate documents.
- Existing confirmed expenses take precedence over existing candidates when both match the same occurrence.

## Validation Plan

- Add or run parser/import-level validation using redacted rows that cover repeat upload, overlapping upload, repeated identical transactions, existing candidate match, existing expense match, and possible duplicate warning cases.
- Run `npm run lint`.
- Run `npm run build` if TypeScript/server-action changes are broad enough that lint is insufficient.
