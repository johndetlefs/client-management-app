# TASK-013 Epic Validation QA

Date: 2026-07-29
Source state: `764e333c69bf4dbde53aad355bf03422cbd8fc08+working-tree`

## Automated Gates

- `npm run test:expenses`: 43/43 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with only the package's stale
  `baseline-browser-mapping` data advisory.
- `npm run build`: passed. Next.js compiled, type-checked, generated all static
  pages, and registered all three expense file/export routes.

## Persisted Emulator Matrix

The synthetic workflow matrix passed:

`{"concurrentImportCreatedOneSet":true,"exactRepeatCreatedNothing":true,"overlapCreatedOnlyNetNew":true,"sameDayOccurrencesPreserved":true,"recurringPatternPersisted":true,"allReviewTransitionsPersisted":true,"personalIgnoreRetentionSet":true,"personalConfirmationDenied":true,"concurrentConfirmationCreatedOneExpense":true,"minorUnitsAndGstReconciled":true,"accountantFieldsUpdated":true,"merchantSuggestionDidNotOverwriteExpense":true,"quarterlyBasReconciled":true,"staffBasMutationDenied":true,"outsiderEmptyTokenCrossTenantDenied":true}`

Expected denial logs accompanied rejected Personal confirmation,
already-confirmed concurrency, unauthenticated access, outsider access, and
cross-tenant access. The script assertions passed and exited zero.

The synthetic file lifecycle matrix passed:

`{"sourceStoredAtTenantPath":true,"storageChecksumMatched":true,"staffDownload":true,"outsiderDenied":true,"crossTenantDenied":true,"mismatchedUploadDenied":true,"receiptReplaceAndUnlink":true,"exportPersistDownloadDelete":true,"personalDetailsMinimized":true,"minimizedCandidateStillDedupes":true,"accountingRecordsSurviveFileDeletion":true}`

The synthetic QIF/PDF matrix passed:

`{"qifBatchAndCandidatePersisted":true,"sameQifIdempotent":true,"csvQifOverlapIdempotent":true,"malformedQifWroteNothing":true,"outsiderDenied":true,"pdfEvidenceCreatedNoCandidates":true}`

## Rendered Browser Journey

- Imported a synthetic QIF, reviewed its candidate as Business, confirmed the
  expense with accountant fields, and attached a synthetic private PDF receipt.
- Verified source-account identity, private file controls, 90-day retention
  disclosure, and the receipt replacement state.
- Prepared a quarterly cash-basis summary and verified the explicit
  preparation-only caveat plus unavailable sales/net-GST boundary.
- Captured desktop evidence for the workspace, files/privacy view, and BAS
  view, plus mobile evidence for BAS, files/privacy, and the confirmed table.
- Browser console output contained no warnings or errors.
- QA found the visually hidden receipt input expanding the mobile document to
  1168px. The input is now bounded to its relative label. The repeated
  measurement was exactly 390px document width for a 390px viewport while the
  1180px table retained its own horizontal scroller.

## Acceptance Coverage

- Parent AC1-AC4: parser tests plus concurrent, repeat, overlap, and same-day
  persisted import evidence.
- Parent AC5-AC8: persisted review transitions, denied Personal confirmation,
  concurrent confirmation, integer money/GST reconciliation, accountant-field
  mutation, retention, and rendered workflow.
- Parent AC9-AC10: suggestion non-overwrite assertion and deterministic
  recurring/subscription tests.
- Parent AC11-AC12: ExcelJS workbook reconciliation from TASK-009 and the
  registered/non-registered, cash/non-cash, monthly/quarterly BAS matrix.
- Parent AC13-AC14: verified owner/staff authorization and denied
  unauthenticated, outsider, and cross-tenant operations through actions,
  routes, Firestore, and Storage.

## Proof Boundary

This is local working-tree, in-app Browser, and Firebase emulator evidence. It
does not prove production deployment, production Firebase configuration,
accountant acceptance, BAS lodgement, Microsoft Excel-specific rendering, or
tax advice.
