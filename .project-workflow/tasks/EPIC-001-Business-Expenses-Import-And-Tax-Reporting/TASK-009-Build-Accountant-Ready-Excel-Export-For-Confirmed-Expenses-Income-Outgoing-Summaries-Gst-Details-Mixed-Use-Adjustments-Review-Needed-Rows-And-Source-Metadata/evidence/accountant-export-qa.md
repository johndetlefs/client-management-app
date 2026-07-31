# TASK-009 Accountant Export QA

## Source

- Revision: `764e333c69bf4dbde53aad355bf03422cbd8fc08+working-tree`
- Runtime: Next.js development server on `http://localhost:3000`
- Data services: Firebase Auth and Firestore emulators
- Data: dedicated synthetic tenant only

## Workbook Reconciliation

- `npm run test:expenses`: 26 passing tests.
- The accountant export round-trip test loaded generated XLSX bytes with
  ExcelJS and found the expected five sheets: Overview, Expenses, Income,
  Review Needed, and Import Sources.
- The fixture reconciled two expenses to gross 23,345, claimable 17,845,
  private adjustment 5,500, potential GST 500, and claimable GST zero minor
  units.
- The fixture reconciled two issued invoices to total 33,000, GST 3,000,
  cumulative paid 22,000, and outstanding 11,000 minor units.
- Deterministic ordering, mixed-use values, source metadata, missing evidence,
  and undated cumulative payment review rows were inspected after workbook
  reload.

## Authenticated Runtime

- The synthetic owner received HTTP 200 and a 12,054-byte XLSX response.
- The response had XLSX content type, attachment filename, private no-store
  cache policy, `nosniff`, and ZIP/XLSX `PK` signature.
- The returned workbook contained the synthetic $110 mixed-use expense, $220
  issued invoice, GST-registration-change review row, payment-timing review
  row, and referenced import batch.
- An unauthenticated request received HTTP 403.
- An authenticated outsider requesting the owner's tenant received HTTP 403.

## Rendered Workspace

- The in-app Browser loaded the authenticated Expenses workspace and displayed
  explicit start/end dates plus the Export Excel command on the Confirmed tab.
- The browser-triggered route completed with HTTP 200 in the Next.js server log.
- At 390x844, both date inputs and the export command rendered full-width,
  readable, and without overlap; the confirmed-expense table remained
  horizontally scrollable.
- At 1280x900, all three export controls stayed within the 1280-pixel viewport.
  Document `scrollWidth` equalled `clientWidth` at 1280 pixels.
- Browser console inspection returned no warnings or errors.
- The browser backend did not surface the programmatic object-URL download as a
  download event. Binary response and workbook validity are therefore proven by
  the authenticated route probe rather than that event.

## Static Validation

- `npx tsc --noEmit`: pass.
- `npm run lint`: pass, with only the existing stale
  `baseline-browser-mapping` data notice.
- `npm run build`: pass; the export route is emitted as a dynamic Node route.
- `git diff --check`: pass.
- ExcelJS transitive `uuid`, `tmp`, and `brace-expansion` packages are
  overridden to patched releases; the focused workbook and build checks pass
  with those versions.
- `npm audit --omit=dev` still reports 19 findings in the repository's wider
  Next.js/Firebase dependency tree. No remaining reported finding resolves
  through the ExcelJS override subtree.

## Boundaries

- Local/emulator evidence does not prove production Firebase configuration,
  production load, Microsoft Excel-specific rendering, accountant acceptance,
  or persisted private export files. Private export persistence belongs to
  TASK-011.
