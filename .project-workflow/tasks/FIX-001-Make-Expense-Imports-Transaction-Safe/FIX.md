# Fix

## Summary

- Fix: FIX-001
- Title: Make expense imports transaction-safe
- Status: Complete
- Created: 2026-07-29

## Report

- Observed or requested: TASK-004 resolves existing occurrences, then writes import batches and candidates later through non-transactional batches. Concurrent identical/overlapping imports can both classify an occurrence as new before either write is visible.
- Expected: Candidate occurrence creation is atomic, repeat/concurrent uploads cannot overwrite candidate provenance, and returned/import-batch counts reflect actual created versus skipped occurrences.
- Affected users or systems: Business owners importing bank CSVs and later confirmed-expense workflows that depend on candidate identity and provenance.
- Delivered baseline: EPIC-001 TASK-004 is Complete and uses deterministic candidate IDs plus pre-write duplicate queries.
- Report evidence: `src/lib/expenses/idempotency.ts:63-117` and `src/app/workspace/expenses/actions.ts:97-116,223-309`.

## Routing

- Decision: Fix
- Rationale: This is one bounded data-integrity correction to completed TASK-004 behavior; it adds no new user outcome or product decision.
- Related work state: Completed
- Bounded correction: Atomically create candidate occurrences and reconcile import results to transaction outcomes.
- New outcome or material decisions: No
- Independent work items: One

## Classification

- Type: Defect
- Mode: Normal
- Severity: High
- Impact: Concurrent imports can produce inaccurate batch counts and last-writer candidate provenance before accountant records are created.
- Urgency: Resolve before TASK-006 persists confirmed expenses from candidates.
- Owner: Codex

## Related Work

- Originating work: EPIC-001
- External links: None

## Risk

- Risk level: Medium
- Risks: Transaction retries or partial import failures could leave a batch in a non-final status; count reconciliation must not misclassify possible duplicates.
- Rollback or containment: Revert the scoped import persistence refactor; deterministic candidate IDs preserve the prior retry behavior.

## Fix Plan

- Scope: Create each deterministic candidate document through a Firestore transaction, skip an occurrence if the document already exists at commit time, and update the import batch/result counts from actual transaction outcomes.
- Non-goals: Do not change CSV parsing/fingerprints, add a new occurrence registry, build upload UI, or solve future confirmed-expense/candidate-deletion coordination.
- Affected target: Expense CSV server action and candidate persistence helper.
- Primary repo: .
- Repos touched: .
- Branch, PR, and evidence links: Current working tree; evidence to be recorded below.
- Verification plan: Run lint/build, then use Firebase emulators to invoke two concurrent identical imports and verify one candidate occurrence per deterministic ID plus reconciled batch/result counts.

### Repository Links

| Repo | Branch | PR | Evidence |
|---|---|---|---|
| . | `codex/fix-client-detail-jobs-list` | None | Firebase emulator concurrent-import result recorded below |

## Verification

- Delivered scope: Candidate occurrence documents are now created through Firestore transactions; transaction-time conflicts become skipped duplicate results, and import batch/result counts are reconciled to actual writes.
- Verification result: Pass on 2026-07-29.
- Adjacent behavior checked: Deterministic candidate IDs, owner authorization, possible-duplicate result filtering, import-batch final status, and source batch provenance.
- Original acceptance criteria result: Not applicable because this post-completion concurrency defect was not covered by a stable child AC in the legacy TASK-004 artifact.
- Regression evidence: Passed simultaneous identical-import verification against the real server action and Firebase emulators.
  - `npm run lint`: pass.
  - `npm run build`: pass.
  - Two simultaneous real server-action imports of the same two-row synthetic CSV returned one `candidateRows=2, skippedRows=0` result and one `candidateRows=0, skippedRows=2` result.
  - Firestore emulator inspection found exactly two candidate documents, both linked to the winning batch, plus two `ready_for_review` batches with reconciled `2/0` candidate counts.
  - The temporary QA probe route was removed after verification.
- Residual risk: Future confirmed-expense creation and candidate deletion must preserve occurrence identity; that coordination remains owned by TASK-006/TASK-011 and does not weaken candidate-level import reservation.

## Outcome

- Disposition: Fixed
- Decision: Candidate occurrences are transactionally reserved and concurrent import results reconcile to actual writes.
- Closed by: Codex QA with owner continuation authority
- Closed date: 2026-07-29
- Promoted to: None
