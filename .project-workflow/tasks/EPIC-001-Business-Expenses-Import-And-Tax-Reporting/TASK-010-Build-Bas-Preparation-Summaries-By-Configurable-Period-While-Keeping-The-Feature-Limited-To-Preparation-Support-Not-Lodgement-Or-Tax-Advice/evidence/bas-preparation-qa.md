# TASK-010 BAS Preparation QA

Date: 2026-07-29

## Automated Evidence

- `npm run test:expenses`: 43/43 tests passed. BAS coverage includes monthly
  and quarterly boundaries, registered non-cash reconciliation, cash-basis
  fail-closed behavior, non-registered operational summaries, registration
  drift, review buckets, and unsafe-money rejection.
- The synthetic emulator probe proved owner configuration, staff reads,
  owner-only writes, outsider denial, registered reconciliation, and the
  non-registered boundary:
  `{"ownerConfigured":true,"staffRead":true,"staffWriteDenied":true,"outsiderReadDenied":true,"nonRegisteredStatus":"not_registered","registeredG1":22000,"registeredReviewGst":500,"cashSalesUnavailable":true}`.
- The full synthetic epic matrix independently reconciled quarterly BAS totals
  and denied staff configuration mutation.

## Rendered Evidence

- `expenses-bas-desktop-1280x720.png` shows explicit Cash and Quarterly
  settings, a selected calendar quarter, the preparation-only warning, and
  reconciled operational and GST-review cards.
- `expenses-bas-mobile-390x844.png` shows the same controls in the mobile
  layout. The document width equalled the 390px viewport and browser console
  output contained no warnings or errors.
- The rendered cash-basis summary exposed operational income and purchases but
  withheld BAS labels and net GST because invoice payment events are undated.
  This is the required fail-closed behavior, not an implementation gap.

## Verification Gates

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with only the package's stale
  `baseline-browser-mapping` data advisory.
- `npm run build`: passed with all expense API routes and the workspace page.
- Proof boundary: local tests, emulators, and rendered checks do not constitute
  tax advice, BAS lodgement, accountant approval, or production deployment.
