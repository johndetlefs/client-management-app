# TASK-011 Source Files And Privacy QA

Date: 2026-07-29

## Emulator Evidence

The synthetic Storage and Firestore lifecycle probe passed:

`{"sourceStoredAtTenantPath":true,"storageChecksumMatched":true,"staffDownload":true,"outsiderDenied":true,"crossTenantDenied":true,"mismatchedUploadDenied":true,"receiptReplaceAndUnlink":true,"exportPersistDownloadDelete":true,"personalDetailsMinimized":true,"minimizedCandidateStillDedupes":true,"accountingRecordsSurviveFileDeletion":true}`

This covers server-generated tenant paths, SHA-256 readback, owner/staff
authorization, denied cross-tenant access, format validation, receipt
replacement, private export persistence, dedupe-preserving minimisation, and
the separation between file deletion and accounting-record deletion.

## Rendered Evidence

- A synthetic QIF source was stored with the user-provided account identity
  `Browser QA Card ending 9999`.
- A synthetic PDF receipt was attached to a confirmed expense and the control
  changed from `Attach receipt` to `Replace receipt`.
- `expenses-files-desktop-1280x720.png` shows the 90-day retention explanation,
  bounded minimisation command, private source and receipt rows, and explicit
  download/delete controls.
- `expenses-files-mobile-390x844.png` shows the same controls without
  page-level horizontal overflow at a 390x844 viewport.
- Browser console output contained no warnings or errors.

## Automated And Static Gates

- File tests cover CSV, QIF, PDF, receipt, and XLSX size, extension, MIME,
  signature, binary-text, server-path, and checksum boundaries.
- Direct client access to the expense Storage prefix is denied by
  `storage.rules`; file operations use authenticated server routes.
- `npm run test:expenses`, `npx tsc --noEmit`, `npm run lint`, and
  `npm run build` passed.
- Repository evidence contains only synthetic transaction fixtures and does
  not include raw owner statements, personal transaction descriptions, or
  generated accountant workbooks.

## Proof Boundary

The emulator proves the implemented authorization and lifecycle logic against
local Firebase services. It does not prove production bucket configuration,
production rules deployment, malware scanning, OCR, or automatic receipt
matching.
