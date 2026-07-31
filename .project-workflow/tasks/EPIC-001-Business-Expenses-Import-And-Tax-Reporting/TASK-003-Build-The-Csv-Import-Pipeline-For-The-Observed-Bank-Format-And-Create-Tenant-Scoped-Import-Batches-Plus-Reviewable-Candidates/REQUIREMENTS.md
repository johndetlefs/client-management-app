# Requirements

## Summary

- Task: TASK-003
- Epic: EPIC-001 Business Expenses Import and Tax Reporting
- Title: Build the CSV import pipeline for the observed bank format and create tenant-scoped import batches plus reviewable candidates
- Last updated: 2026-06-03

## Overview

This task makes CSV the first working input path for the expenses epic. It should parse the observed bank CSV structure, create an import batch, and persist reviewable candidate transaction rows under the tenant. It should use the TASK-002 expense types and access guard.

## User Story

As a business owner, I want to submit my bank's CSV transaction export and have it converted into reviewable expense candidates, so that I can later mark which transactions are business, personal, mixed use, or ignored without manually retyping the statement.

## Goal

Create a deterministic CSV import pipeline for the observed bank export format: `Date`, `Description`, `Debit`, `Credit`, `Category`, `SubCategory`.

## Non-Goals

- Do not build the browser upload UI in this task.
- Do not build cross-import idempotency or duplicate suppression in this task; populate fingerprint fields for TASK-004 instead.
- Do not build candidate review/confirmation UI in this task.
- Do not build merchant rules, recurring detection, accountant export, BAS summary, QIF parsing, or PDF parsing in this task.
- Do not commit the real bank CSV or any real transaction fixture to git.

## Users & Context

- Primary user: business owner importing a personal bank/card CSV that contains mixed personal and business transactions.
- Context: the observed CSV has six columns: `Date`, `Description`, `Debit`, `Credit`, `Category`, `SubCategory`.
- Context: the CSV lacks a stable bank transaction ID, so this task must generate deterministic transaction fingerprints and occurrence indexes for later idempotency handling.
- Context: imported candidates are sensitive because they may include personal spending.

## Requirements (Outcome-Focused)

- Add a reusable CSV parser for the observed bank format that handles UTF-8 BOMs, CRLF line endings, quoted fields, dates, debit/credit amounts, categories, and subcategories.
- Normalise parsed rows into expense candidate input data with ISO dates, raw descriptions, normalised merchant names, minor-unit amounts, currency, transaction direction, bank category hints, transaction fingerprints, and occurrence indexes.
- Add a server action or server-side import function that verifies owner/staff tenant access before creating an import batch and candidate documents.
- Persist import batches under `tenants/{tenantId}/expenseImportBatches` and candidates under `tenants/{tenantId}/expenseCandidates`.
- Set new candidates to `unreviewed`, `active`, and `new` duplicate status.
- Record import counts and parser version on the import batch.
- Return an import result containing the import batch ID and counts so a future UI can navigate to review.

## Acceptance Criteria (Verifiable)

- The parser accepts the observed CSV header exactly and returns parsed rows with no row-width, date, or amount failures for a redacted fixture shaped like the provided bank export.
- The parser rejects missing required headers, rows with both debit and credit populated, rows with neither debit nor credit populated, invalid dates, and invalid amounts.
- Debit rows become `direction: "debit"` and credit rows become `direction: "credit"`.
- Amount values are converted to integer minor units.
- Each parsed row receives a deterministic transaction fingerprint and an occurrence index among identical fingerprints in the import.
- The import function creates one import batch and one candidate document per parsed row under `tenants/{tenantId}`.
- The import function calls the TASK-002 owner/staff access guard before writing.
- No real CSV, bank statement, customer data, secrets, or live Firebase export is added to git.
- `npm run lint` passes or any failure is reported with scope.

## Open Questions (Answer Needed)

- None blocking for this task. Cross-import duplicate suppression remains TASK-004.

## Decisions (Resolved)

- CSV is the first input path.
- The observed CSV format is the first supported parser format.
- This task may accept CSV text plus source metadata server-side; browser upload/file storage belongs to a later task.
- Transaction fingerprints are generated now, but existing-record dedupe is deferred to TASK-004.
- Candidate rows should remain unreviewed until the review workspace is built.

## Validation Plan

- Add a redacted in-code test fixture or local-only validation sample that matches the observed CSV shape without containing real transaction data.
- Run parser-level validation for success and failure cases where practical.
- Run `npm run lint`.
- Run `npm run build` if the changes touch broad Next.js compile paths or if lint is insufficient to catch type errors.
