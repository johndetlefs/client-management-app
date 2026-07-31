# Decomposition Plan

## Summary

- Epic: EPIC-001
- Status: Approved by parent requirements envelope
- Authority source: Parent REQUIREMENTS.md Owner Approval
- Source requirements identity: sha256:51bbf1195a3c6b59ceda71b82b8e6ecde223beedb1b07a2f1265928fe24a27c5
- Last updated: 2026-07-29

## Authorized Child Rows

| ID | Title | Parent ACs | Source |
|---|---|---|---|
| TASK-002 | Establish tenant-scoped expense import, candidate, confirmed expense, merchant rule, category, file, and export data models with server-side owner/staff permissions | AC13, AC14 | Legacy adoption approved by parent requirements envelope |
| TASK-003 | Build the CSV import pipeline for the observed bank format and create tenant-scoped import batches plus reviewable candidates | AC1 | Legacy adoption approved by parent requirements envelope |
| TASK-004 | Build occurrence-aware transaction fingerprinting and idempotency for repeat uploads, overlapping periods, exact duplicates, and possible duplicate warnings | AC2, AC3, AC4 | Legacy adoption approved by parent requirements envelope |
| TASK-005 | Build the expense review workspace where candidates can be marked Business, Personal, Mixed use, or Ignore before confirmation | AC5, AC13, AC14 | Legacy adoption approved by parent requirements envelope |
| TASK-006 | Build confirmed expense persistence with accountant fields including minor-unit amounts, business-use percentage, claimable amount, category, GST treatment, tax invoice/receipt status, subscription/recurring flags, notes, and source metadata | AC6, AC7, AC8 | Legacy adoption approved by parent requirements envelope |
| TASK-007 | Build merchant rule learning so reviewed merchants can pre-fill future category, GST treatment, subscription flag, recurring flag, and business-use percentage suggestions | AC9 | Legacy adoption approved by parent requirements envelope |
| TASK-008 | Build recurring and subscription detection using merchant rules and repeated transaction patterns | AC10 | Legacy adoption approved by parent requirements envelope |
| TASK-009 | Build accountant-ready Excel export for confirmed expenses, income/outgoing summaries, GST details, mixed-use adjustments, review-needed rows, and source metadata | AC11 | Legacy adoption approved by parent requirements envelope |
| TASK-010 | Build BAS preparation summaries by configurable period while keeping the feature limited to preparation support, not lodgement or tax advice | AC12 | Legacy adoption approved by parent requirements envelope |
| TASK-011 | Build source file handling and privacy controls for CSV/QIF/PDF uploads, generated exports, and personal/non-business candidate retention | AC6, AC15 | Legacy adoption approved by parent requirements envelope |
| TASK-012 | Add optional QIF import support only where it improves coverage beyond CSV, and keep PDF ingestion as a fallback/source-evidence path | AC15 | Legacy adoption approved by parent requirements envelope |
| TASK-013 | Add validation coverage for parsing, idempotency, tenant scoping, permissions, review transitions, merchant rules, exports, and BAS summaries | AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC12, AC13, AC14 | Legacy adoption approved by parent requirements envelope |

## Authority Rules

- Matching rows inside this plan may be approved and scaffolded without separate per-row owner approval.
- Rows outside this plan require an approved amendment before gated lifecycle movement.
- Matching is by ID, title, and parent AC coverage.
