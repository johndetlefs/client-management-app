# Fix

## Summary

- Fix: FIX-002
- Title: Accept cents-only bank CSV amounts
- Status: Complete
- Created: 2026-07-29

## Report

- Observed or requested: The owner-supplied bank CSV contains valid debit
  amounts `.54`, `.36`, and `.01`; `parseExpenseBankCsv` rejects them.
- Expected: Unsigned cents-only amounts with one or two decimal digits parse as
  positive minor-unit values while malformed and non-positive amounts remain
  invalid.
- Affected users or systems: Expense CSV imports from banks that omit the zero
  before a decimal amount.
- Delivered baseline: `bank-csv-v1` requires one or more digits before the
  decimal point.
- Report evidence: Aggregate inspection of the owner-supplied 102-row CSV found
  96 debits, 6 credits, and three rejected legitimate cents-only debits.

## Routing

- Decision: Fix
- Rationale: One accepted input representation is missing from the delivered
  deterministic CSV parser; no product decision or independent outcome is
  required.
- Related work state: EPIC-001 AC1; originating CSV import child.
- Bounded correction: Update one money parser and add focused regression tests.
- New outcome or material decisions: No
- Independent work items: One

## Classification

- Type: Defect
- Mode: Normal
- Severity: High
- Impact: Legitimate bank transactions are omitted from the import candidate
  set, preventing complete reconciliation.
- Urgency: Resolve before Epic-wide validation and accountant export work.
- Owner: Codex

## Related Work

- Originating work: EPIC-001 CSV import child
- External links: None

## Risk

- Risk level: Low
- Risks: Over-broad numeric acceptance could admit malformed, signed, zero, or
  unsafe amounts.
- Rollback or containment: Revert the parser expression and its regression
  test; imports remain fail-closed.

## Fix Plan

- Scope: Accept `.d` and `.dd` positive amounts as 1-99 minor units and prove
  the owner CSV parses all 102 transactions.
- Non-goals: Signed amount formats, more than two decimal places, CSV upload UI,
  QIF/PDF parsing, or changes to transaction identity.
- Affected target: `src/lib/expenses/csv.ts` and focused parser tests.
- Primary repo: .
- Repos touched: .
- Branch, PR, and evidence links: Branch
  `codex/fix-client-detail-jobs-list`; local evidence in this Fix.
- Verification plan: Focused parser tests for accepted and rejected forms;
  complete expense suite; local aggregate parse of the supplied bank CSV; type
  check, lint, build, and `git diff --check`.

### Repository Links

| Repo | Branch | PR | Evidence |
|---|---|---|---|
| . | `codex/fix-client-detail-jobs-list` | None | `FIX.md` verification section |

## Verification

- Delivered scope: `parseMoneyToMinor` accepts positive `.d` and `.dd` values;
  two focused tests cover debit/credit acceptance and malformed/non-positive
  rejection.
- Verification result: Pass. The owner-supplied file parsed 102/102 rows: 96
  debits, 6 credits, with cents-only values 1, 36, and 54 minor units.
- Adjacent behavior checked: `0.01`, `$.99`, malformed `.`, excess precision
  `.000`, signed `-.54`, and non-positive `.00`; occurrence identity and
  direction remained unchanged.
- Original acceptance criteria result: EPIC-001 AC1 parser completeness is
  restored for the supplied bank CSV; final Epic proof remains owned by
  TASK-013.
- Regression evidence: `npm run test:expenses` passed 17/17; `npx tsc
  --noEmit`, `npm run lint`, `npm run build`, and `git diff --check` passed.
- Residual risk: Bank formats outside the approved six-column CSV contract
  remain unsupported. Full numeric safe-boundary coverage remains a TASK-013
  validation concern.

## Outcome

- Disposition: Fixed
- Decision: Accept positive cents-only bank amounts with focused regression coverage; owner CSV parses 102 of 102 rows
- Closed by: Codex
- Closed date: 2026-07-29
- Promoted to: None
