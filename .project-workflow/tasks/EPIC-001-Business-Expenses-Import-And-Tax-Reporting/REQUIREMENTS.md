# Requirements

## Summary

- Task: EPIC-001
- Title: Business Expenses Import and Tax Reporting
- Last updated: 2026-07-29

## Owner Approval

- Requirements reviewed by owner: Yes
- Acceptance criteria reviewed by owner: Yes
- Approved for decomposition: Yes
- Approved for implementation: No
- Approved scope envelope: Yes
- Approved by: John Detlefs
- Approval date: 2026-07-29
- Approval note / source: Codex owner approval on 2026-07-29: happy to use the recommended retention, receipt, income export, and BAS configuration decisions
- Approved artifact identity: sha256:579ad26467842489bd75f503aed2bfa00593e3a6e43618d3d3c3191fe7e1bd3b

## Goal

Make it easy for the business owner to import personal bank/credit-card transaction exports, identify which transactions are business expenses, classify them for accountant and GST/BAS purposes, learn recurring merchant decisions, and export useful income/outgoing reports for tax preparation.

The regular operating loop should be: import transactions, review candidates, confirm business expenses, learn merchant rules, and export accountant-ready spreadsheets.

## Non-Goals

- Do not build a tax advice engine or replace accountant judgement.
- Do not require paid AI, OCR, or third-party extraction services for the MVP.
- Do not make PDF parsing the primary ingestion path while structured exports are available.
- Do not permanently store personal transactions unless there is an explicit retention decision.
- Do not build live bank feeds or direct bank account integrations in the first epic.
- Do not change invoice revenue workflows except where income/outgoing export needs read-only summary data.

## Users & Context

- Primary user: business owner importing a personal card/bank export that contains both personal and business transactions.
- Secondary user: accountant receiving an Excel export with enough categorisation, GST treatment, and notes to prepare tax and BAS work efficiently.
- Context: this is a multi-tenant SaaS; all expense data, import batches, merchant rules, files, and exports must stay scoped under `tenants/{tenantId}`.
- Context: uploaded source files and parsed rows can contain sensitive personal spending data, so privacy and minimisation are part of the product outcome.

## Requirements (Outcome-Focused)

- Establish tenant-scoped expense import, candidate, confirmed expense, merchant rule, category, file, and export data models with server-side owner/staff permissions.
- Build the CSV import pipeline for the observed bank format and create tenant-scoped import batches plus reviewable candidates.
- Build occurrence-aware transaction fingerprinting and idempotency for repeat uploads, overlapping periods, exact duplicates, and possible duplicate warnings.
- Build the expense review workspace where candidates can be marked Business, Personal, Mixed use, or Ignore before confirmation.
- Build confirmed expense persistence with accountant fields including minor-unit amounts, business-use percentage, claimable amount, category, GST treatment, tax invoice/receipt status, subscription/recurring flags, notes, and source metadata.
- Build merchant rule learning so reviewed merchants can pre-fill future category, GST treatment, subscription flag, recurring flag, and business-use percentage suggestions.
- Build recurring and subscription detection using merchant rules and repeated transaction patterns.
- Build accountant-ready Excel export for confirmed expenses, income/outgoing summaries, GST details, mixed-use adjustments, review-needed rows, and source metadata.
- Build BAS preparation summaries by configurable period while keeping the feature limited to preparation support, not lodgement or tax advice.
- Build source file handling and privacy controls for CSV/QIF/PDF uploads, generated exports, and personal/non-business candidate retention.
- Add optional QIF import support only where it improves coverage beyond CSV, and keep PDF ingestion as a fallback/source-evidence path.
- Add validation coverage for parsing, idempotency, tenant scoping, permissions, review transitions, merchant rules, exports, and BAS summaries.

## Acceptance Criteria (Verifiable)

- AC1: A user can upload the sample May 2026 bank CSV and see all valid rows parsed into an import batch with dates, descriptions, debit/credit amounts, bank category hints, and no row-width/date/amount parse failures.
- AC2: Re-uploading the same CSV does not create duplicate candidates or duplicate confirmed expenses.
- AC3: Uploading an overlapping CSV period, such as January followed by January-February, imports only the net-new transaction occurrences and links previously imported occurrences to their existing records.
- AC4: Repeated same-day transactions with identical merchant and amount are treated as counted occurrences, not blindly collapsed into one transaction.
- AC5: A user can review imported candidates and mark each one as Business, Personal, Mixed use, or Ignore.
- AC6: Only Business and Mixed use rows can become long-term confirmed expenses; Personal and Ignore rows follow the selected retention/minimisation policy.
- AC7: A confirmed expense stores money in minor units and computes claimable amount and GST amount without floating-point currency arithmetic.
- AC8: A user can set or correct expense category, GST treatment, business-use percentage, tax invoice/receipt status, subscription flag, recurring flag, and notes.
- AC9: A user can save merchant rules from reviewed expenses and future imports apply those rules as suggestions rather than irreversible automatic classifications.
- AC10: The system flags recurring/subscription-like candidates based on merchant rule matches and repeated transaction patterns.
- AC11: Accountant export produces an Excel workbook with confirmed expenses, income/outgoing summaries, GST/BAS-oriented summaries, missing evidence/review-needed rows, and source import metadata.
- AC12: BAS summary groups expenses into configurable monthly or quarterly periods and separates claimable GST from non-claimable or review-needed items.
- AC13: All Firestore reads and writes for import batches, candidates, expenses, merchant rules, categories, files, and export records are scoped under `tenants/{tenantId}`.
- AC14: Server actions or route handlers authenticate the caller and enforce owner/staff access before import, review, mutation, export, or source-file access.
- AC15: Source CSV/QIF/PDF files and generated exports are stored outside git and associated with tenant-scoped metadata.

## Open Questions (Answer Needed)

- None.

## Deferred Decisions (Resolve Before Child Readiness)

- None.

## Decisions (Resolved)

- CSV import is the preferred first ingestion path because the bank export is clean and cheaper/more reliable than PDF extraction.
- The observed CSV has useful columns and parses cleanly, but it does not include a stable bank transaction ID.
- Idempotency must be occurrence-aware. The importer must compare transaction fingerprints and counts across existing tenant records so repeated uploads and overlapping periods do not double-create records.
- The observed QIF export is usable but not preferred because it has no stable transaction ID and covers a slightly different transaction count/date range than the CSV.
- OFX/QFX should be considered later if available, because a stable transaction identifier such as `FITID` would improve dedupe.
- PDF import should be treated as fallback/source evidence, not the default path for MVP ingestion.
- The MVP should use deterministic parsing and rules rather than paid AI/API calls.
- Merchant learning should pre-fill suggestions but must not overwrite existing accountant/tax decisions on re-import.
- Confirmed expenses are business-level records, not client-specific records.
- Money must be stored in minor units.
- BAS support should prepare structured summaries and review evidence, not lodge BAS or provide tax advice.
- Personal and ignored candidates retain their full transaction details for 90 days after finalisation, then minimise to the metadata required for occurrence-aware deduplication and audit traceability.
- Receipt and tax-invoice files can be attached manually in this epic. Automatic receipt matching is deferred.
- Income export uses the application's invoice and payment records only. Imported bank credits do not create income or adjustment rows in this epic.
- Each tenant must explicitly choose cash or non-cash GST accounting basis and monthly or quarterly BAS cadence. The system must infer neither setting.
- GST registration is an effective-dated tenant setting independent of BAS basis and cadence. Non-GST-registered tenants can use expense and income summaries without the product representing them as BAS liabilities or GST credits.
- The initial accountant expense category set and manual expense creation are included as completed under TASK-006.

## Validation Plan

- Use a redacted fixture shaped like the provided May 2026 CSV to verify parsing, normalisation, amount handling, and row counts.
- Add unit coverage for CSV parsing, QIF parsing if implemented, transaction fingerprinting, occurrence-aware idempotency, and duplicate edge cases.
- Add server-side tests or emulator-backed checks proving tenant-scoped writes for import batches, candidates, expenses, merchant rules, and export records.
- Add permission tests showing unauthorised users cannot import, mutate, export, or access another tenant's expense data/files.
- Add workflow tests for candidate review transitions: unreviewed candidate to Business, Personal, Mixed use, and Ignore.
- Add tests for merchant rule suggestion behaviour and protection against overwriting confirmed expense decisions during re-import.
- Add export validation that generated Excel totals reconcile to confirmed expenses, claimable amounts, GST summaries, and review-needed rows.
- Run `npm run lint` for implementation tasks and `npm run build` before shipping broad app changes when practical.

## Legacy Adoption

- Adopted legacy work: Yes
- Adopted by: John Detlefs
- Adoption date: 2026-07-29
- Adoption source: Codex task owner messages: 'all of that looks fine. I agree with everything' and 'build out this Expenses feature as a full epic'
- Evidence refreshed after adoption: No
- Evidence trust note: Pre-adoption inferred evidence is untrusted until refreshed.
