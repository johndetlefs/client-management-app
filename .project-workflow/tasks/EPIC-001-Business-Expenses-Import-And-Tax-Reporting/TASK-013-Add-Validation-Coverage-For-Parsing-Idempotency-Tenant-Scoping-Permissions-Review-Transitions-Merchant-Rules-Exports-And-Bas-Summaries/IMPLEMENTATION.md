## User Story

As the business owner, I want the complete expense epic tested against its
actual risk boundaries, so that I can rely on imports, classifications,
accountant exports, BAS preparation, and privacy controls.

## Parent AC Coverage

- AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12, AC13, AC14

## Child Charter

### Inherited Invariants

- Authenticate the server caller; never authorize from a client-supplied user ID.
- Scope all expense data and file metadata under `tenants/{tenantId}`.
- Use transactions for consistency-sensitive imports and occurrence allocation.
- Store currency in minor units and avoid floating-point arithmetic.
- Treat merchant rules as suggestions that cannot overwrite confirmed accountant decisions.
- Preserve source privacy and do not commit personal bank data, source statements, or generated exports.
- Keep CSV as the deterministic primary input; QIF and PDF remain optional/fallback paths.

### Invalid Substitutes

- A successful lint or build does not prove authenticated server authorization, tenant isolation, Firestore transaction behavior, or visible browser behavior.
- Client-supplied tenant or user identifiers do not prove the caller's identity or authorization.
- Code inspection or an HTTP 200 response does not prove the review workspace renders correctly or that review actions work.
- Unit fixtures do not replace emulator-backed cross-tenant and idempotency evidence.
- Export generation alone does not prove accountant totals, GST calculations, or workbook reconciliation.
- BAS summaries do not constitute tax advice, lodgement, or accountant approval.

### Artifact Targets

- Tenant-scoped expense models and authenticated server access helpers.
- Deterministic CSV import batches and reviewable candidate records.
- Transaction-safe occurrence-aware idempotency.
- Rendered expense review workspace with protected review transitions.
- Confirmed expense records and accountant-controlled classification fields.
- Merchant suggestion rules and recurring/subscription detection.
- Reconciled Excel accountant export and GST/BAS preparation summaries.
- Tenant-scoped source-file/privacy controls and focused automated/emulator evidence.

### Parent AC Proof Ownership

- AC1: owner `TASK-003, TASK-013`; required evidence: Redacted bank-shaped fixture parse evidence with row/date/amount assertions.
- AC2: owner `TASK-004, TASK-013`; required evidence: Repeat-import evidence showing no additional candidate or expense records.
- AC3: owner `TASK-004, TASK-013`; required evidence: Overlapping-period evidence showing only net-new occurrences.
- AC4: owner `TASK-004, TASK-013`; required evidence: Same-day identical transaction occurrence-count evidence.
- AC5: owner `TASK-005, TASK-013`; required evidence: In-app Browser review transitions plus persisted emulator state.
- AC6: owner `TASK-006, TASK-011, TASK-013`; required evidence: Confirmation/retention policy tests for Business, Mixed use, Personal, and Ignore.
- AC7: owner `TASK-006, TASK-013`; required evidence: Minor-unit claimable/GST calculation tests including rounding cases.
- AC8: owner `TASK-006, TASK-013`; required evidence: Persisted accountant-field mutation evidence.
- AC9: owner `TASK-007, TASK-013`; required evidence: Merchant-rule suggestion and non-overwrite regression evidence.
- AC10: owner `TASK-008, TASK-013`; required evidence: Rule-match and repeated-pattern detection tests.
- AC11: owner `TASK-009, TASK-013`; required evidence: Workbook inspection and total reconciliation evidence.
- AC12: owner `TASK-010, TASK-013`; required evidence: Monthly/quarterly BAS-period and GST-bucket reconciliation evidence.
- AC13: owner `TASK-002, TASK-005, TASK-013`; required evidence: Emulator-backed tenant-path and cross-tenant isolation evidence.
- AC14: owner `TASK-002, TASK-005, TASK-013`; required evidence: Verified-token owner/staff authorization and unauthorized-call evidence.

## Acceptance Criteria

- [x] AC1: Parsing and persisted idempotency cover parent AC1-AC4.
- [x] AC2: Review, confirmation, accountant fields, calculations, and retention cover parent AC5-AC8.
- [x] AC3: Merchant suggestions and recurrence cover parent AC9-AC10.
- [x] AC4: Workbook and BAS reconciliation cover parent AC11-AC12.
- [x] AC5: Tenant isolation, authorization, and rendered behavior cover parent AC13-AC14.

## Validation

- AC1: Expense tests plus concurrent/repeat/overlap emulator matrix.
- AC2: Review/accounting/retention emulator matrix plus browser journey.
- AC3: Merchant and recurrence tests plus persisted suggestion checks.
- AC4: ExcelJS workbook inspection plus BAS basis/cadence/registration matrix.
- AC5: Auth role/cross-tenant matrix plus desktop/mobile in-app Browser checks.

## Task List

| ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
| 1 | Build full emulator matrix | Refresh persisted parsing, idempotency, review, accounting, access, file, export, and BAS proof with synthetic data. | AC1, AC2, AC3, AC4, AC5 | Inspect machine-readable outcomes and emulator state. | Complete |
| 2 | Run rendered workspace journey | Exercise import, review, confirmation, receipt, export, BAS, files/privacy, and responsive layout. | AC2, AC4, AC5 | Inspect desktop/mobile screenshots, console, and network results. | Complete |
| 3 | Run repository gates | Run tests, type-check, lint, build, privacy scan, workflow doctor, and acceptance audit. | AC1, AC2, AC3, AC4, AC5 | Review exact command results and residual risks. | Complete |
| 4 | Complete QA and closeout evidence | Map every parent AC to dated artifacts, conduct code review, and capture retro inputs. | AC1, AC2, AC3, AC4, AC5 | Inspect QA verdict and epic acceptance audit. | Complete |

## Parent AC Evidence

- AC1: Parser and persisted normalized-row evidence.
- AC2: Exact and concurrent repeat-import evidence.
- AC3: CSV/CSV and CSV/QIF overlap evidence.
- AC4: Same-day occurrence-index evidence.
- AC5: Review-transition and confirmation evidence.
- AC6: Source identity and 90-day retention evidence.
- AC7: Minor-unit amount and GST reconciliation evidence.
- AC8: Persisted accountant-field mutation evidence.
- AC9: Merchant suggestion and non-overwrite evidence.
- AC10: Recurring/subscription pattern and conflict evidence.
- AC11: ExcelJS workbook inspection and reconciliation evidence.
- AC12: BAS period, basis, cadence, registration, and GST-bucket evidence.
- AC13: Firestore/Storage tenant-path and cross-tenant denial evidence.
- AC14: Verified owner/staff and denied unauthorised access evidence.
- Shared artifact: `evidence/epic-validation-qa.md` records the full synthetic
  automated/emulator/browser/build matrix. The 15 passing `EVIDENCE.json`
  records map each parent AC plus responsive behavior to dated, hashed
  working-tree evidence.

## QA & Code Review

- Date: 2026-07-29
- Verdict: Pass with follow-up.
- Evidence: 43 expense tests; three synthetic emulator matrices; ExcelJS
  workbook reconciliation; structure-only QIF comparison; complete desktop and
  mobile in-app Browser journey with clean console; exact 390px mobile document
  measurement; TypeScript; lint; production build; diff and privacy scans; and
  passing structured evidence.
- Findings: QA identified and fixed page-level mobile overflow caused by the
  visually hidden receipt input. Review also confirmed route/action token
  verification, tenant path construction, transactional import/confirmation,
  integer money handling, private file headers, and fail-closed BAS behavior.
- Follow-up: `npm audit --omit=dev` reports 19 repository-wide findings
  (1 critical, 9 high, 8 moderate, 1 low) across Next.js, Firebase/Google Cloud,
  and transitive packages. A separate tested dependency-upgrade cycle is
  required; broad upgrades are outside this epic.
- Proof boundaries: local working-tree, emulator, and rendered evidence does
  not prove production deployment/configuration, accountant acceptance,
  Microsoft Excel-specific rendering, tax advice, or BAS lodgement.

## Retro

- Date: 2026-07-29
- Reusable lessons: Root document width must be measured separately from a
  table's intended local scroll width. Expected denial logs need machine
  assertions and a zero exit code before they can count as fail-closed proof.
- Conventions or agent assets updated: Added bounded hidden-input and QIF MIME
  rules to `.project-workflow/guidance.md`; refreshed legacy parent-evidence
  links for TASK-002 through TASK-004.
- Follow-up tasks: Run a separate tested dependency-upgrade task for the 19
  current production audit findings.
- Missed in-scope work: None.

## Notes

- Task: TASK-013
- Title: Add validation coverage for parsing, idempotency, tenant scoping, permissions, review transitions, merchant rules, exports, and BAS summaries
- Created: 2026-07-29
