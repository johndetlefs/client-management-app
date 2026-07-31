# TASK-012 QIF Import QA

Date: 2026-07-29

## Input-Dialect Evidence

- The owner-supplied QIF was inspected in place without copying raw rows or
  transaction values into the repository.
- Structure-only comparison found 111 terminated records. All observed dates
  normalized to ISO dates, all amounts converted to valid minor units, every
  record supplied a usable description and direction, and occurrence indexes
  remained positive.
- The implementation supports the observed `!Type:Bank` records with day-first
  `D`, signed `T`, payee/memo fallback, repeated category hints, and `^`
  terminators. Unsupported split records and malformed dates fail closed.

## Automated And Emulator Evidence

- QIF parser tests prove deterministic shared row output, CSV-compatible
  occurrence fingerprints, and strict malformed-record rejection.
- The synthetic emulator probe passed:
  `{"qifBatchAndCandidatePersisted":true,"sameQifIdempotent":true,"csvQifOverlapIdempotent":true,"malformedQifWroteNothing":true,"outsiderDenied":true,"pdfEvidenceCreatedNoCandidates":true}`.
- The broader expense suite passed 43/43 tests.

## Rendered Evidence

- A synthetic browser QIF imported one candidate under the explicit account
  identity `Browser QA Card ending 9999`; the candidate was reviewed,
  confirmed, and retained with its source metadata.
- Browser-uploaded QIF files are accepted only when the `.qif` extension and
  validated text signature agree, including the browser's generic
  `application/octet-stream` MIME.
- `expenses-qif-desktop-1280x720.png` records the resulting rendered Expenses
  workspace. Browser console output contained no warnings or errors.
- Synthetic PDF upload created source evidence and no transaction candidates.

## Verification Gates And Boundary

- `npx tsc --noEmit`, `npm run lint`, and `npm run build` passed.
- QIF is an optional deterministic parser, not an AI or paid-service
  dependency. PDF remains evidence-only and does not claim transaction
  extraction.
