# Epic Retro

- Epic: EPIC-001
- Title: Business Expenses Import and Tax Reporting
- Last updated: 2026-07-29

## Lessons

- Deterministic CSV/QIF parsing plus tenant-scoped MCP-style actions is
  sufficient for this workflow; no paid AI extraction service is needed for
  the supported formats.
- Import idempotency must be transaction-identity and occurrence aware, not
  based on filename, import range, or whole-file hash.
- GST registration, BAS accounting basis, and reporting cadence are separate
  explicit settings. Unsupported evidence states must remain visible and fail
  closed.
- Personal transaction detail can be minimised after 90 days without losing
  duplicate protection when the complete dedupe identity is preserved.
- Responsive QA must inspect root document width as well as the intended local
  scroll container.

## Follow-up Tasks

- Add dated invoice payment events before supporting cash-basis sales and net
  GST for a period.
- Address the current 19 `npm audit --omit=dev` findings in a separate,
  regression-tested dependency upgrade.
- Consider malware scanning and automatic receipt matching only if usage
  justifies the additional service and operational cost.

## Deferrals

- Automatic PDF transaction extraction/OCR.
- Automatic receipt matching.
- BAS lodgement, ATO integration, and tax advice.
- Broader QIF dialect support beyond observed evidence.

## Missed In-Scope Work

- None.
