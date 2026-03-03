# Requirements

## Overview

- Goal (in user terms): Let users produce professional quotes from jobs and deliver them to clients in the same core interaction style as invoices.
- Primary user(s): Tenant owner and staff users.
- Desired outcome: Users can create, edit, view, and send quotes (PDF or link) without requiring quote acceptance functionality in this phase.

## User Story

As an owner or staff user, I want to create and manage a quote based on a job and send it to a client as either a PDF or shareable link, so that I can provide a formal pre-invoice pricing document through a workflow that feels consistent with invoices.

## In Scope

- Add Quotes as a top-level workspace navigation destination (similar to Clients, Jobs, Invoices).
- Create a quote from job context/data.
- Edit and update existing quotes.
- Provide user-facing output/share options: printable PDF and shareable link.
- Display quotes for internal users and for recipients via link.

## Out of Scope

- Client-side quote acceptance/approval workflow.
- Quote-to-invoice conversion automation.
- Additional new billing models or payment capture on quotes.

## Requirements

List requirements as outcomes/expectations, not implementation details.

### Functional Requirements

- Users with appropriate workspace access can create a new quote associated to an existing client/job.
- Users can add/update quote content and save changes after initial creation.
- Users can send/share a quote in two ways: as a printable/exportable PDF and as a shareable link.
- Quotes are visible in a dedicated Quotes area reachable from the workspace header navigation.
- The quote creation and management experience should be familiar to users of the invoice flow (similar information architecture and primary actions).
- Users can view quote details after creation and update them while the quote remains editable.

### Non-Functional Requirements

- Performance / latency: Quote list/detail/create/update interactions should feel comparable to existing invoice workflows for typical tenant data sizes.
- Security / permissions: Tenant isolation and role-based access must match existing app rules (owner/staff access only to their tenant data; no cross-tenant exposure).
- Accessibility: New quote pages/actions support keyboard navigation, visible focus states, and baseline form accessibility consistent with current app standards.
- Observability (logs/metrics/audit expectations): Key quote lifecycle actions (create, update, share-link view if implemented similarly to invoices) should be traceable via server-side logs.

## Acceptance Criteria

- AC1: A Quotes entry appears in workspace header navigation and opens a Quotes page for the active tenant.
- AC2: A user can create a quote from job-related context and save it successfully.
- AC3: A user can open an existing quote, edit details, and save updates that persist.
- AC4: A user can generate/view a quote as PDF output.
- AC5: A user can access/share a quote via tokenized link-based read-only view, and quote view events are tracked consistently with public invoices.
- AC6: No quote acceptance action is required or presented in this phase.
- AC7: Quote numbering uses a sequence independent from invoice numbering.
- AC8: Quote line items are sourced from existing job items only.
- AC9: Selecting job items into a quote does not change invoice item locking/status (`open`/`selected`/`invoiced`).
- AC10: Quote item amounts are snapshotted into the quote at save time rather than live-referenced from job items.
- AC11: Public quote links support manual revoke/regenerate token control.

## Assumptions

- Existing invoice patterns can be reused for quote UX and data handling where appropriate.
- Owner/staff role model for quote operations aligns with existing invoice permissions.
- Quote lifecycle states beyond create/update/share are not required in this first phase.

## Open Questions

- None.

## Decisions Log

- Decision: Exclude quote acceptance workflow in this phase.
  - Context: Initial feature scope for CMA-001.
  - Options considered: Include acceptance now; defer acceptance.
  - Chosen: Defer acceptance.
  - Why: User explicitly requested no acceptance yet; focus is create/update/share.
- Decision: Add Quotes as top-level header navigation item.
  - Context: Entry point for quote management.
  - Options considered: Nested under Jobs/Invoices; top-level nav item.
  - Chosen: Top-level nav item.
  - Why: User requested parity with existing top-level links like Clients/Jobs/Invoices.
- Decision: Use a separate quote numbering sequence.
  - Context: Numbering behavior for quote entities.
  - Options considered: Reuse invoice numbering; separate quote numbering; no numbering.
  - Chosen: Separate quote numbering sequence.
  - Why: Keeps quote lifecycle/document identity distinct from invoices.
- Decision: Source quote line items from existing job items only.
  - Context: Scope of “quote from job” in this phase.
  - Options considered: Job items only; manual items only; both.
  - Chosen: Existing job items only.
  - Why: Aligns directly to story intent and constrains MVP complexity.
- Decision: Public quote links mirror public invoice behavior.
  - Context: External client quote visibility.
  - Options considered: Full parity with invoice public links; tokenized read-only without tracking; internal-only.
  - Chosen: Same as public invoices (tokenized read-only + viewed tracking).
  - Why: Consistent user expectations and existing proven pattern.
- Decision: Q1 resolved — no invoice locking/state changes when selecting quote items.
  - Context: Quote creation from existing job items.
  - Options considered: A) no locking changes, B) reuse invoice locking, C) quote soft-lock.
  - Chosen: A) No locking/state change for quotes.
  - Why: Keeps quotes non-billing and avoids interference with invoice locking workflow.
- Decision: Q2 resolved — snapshot quote item amounts at save time.
  - Context: Quote value consistency after job-item changes.
  - Options considered: A) snapshot on save, B) live-reference, C) snapshot + manual refresh.
  - Chosen: A) Snapshot on save.
  - Why: Preserves document stability and client trust for sent quotes.
- Decision: Q3 resolved — manual revoke/regenerate for public quote tokens.
  - Context: Public link lifecycle control.
  - Options considered: A) permanent token, B) manual revoke/regenerate, C) expiring token.
  - Chosen: B) Manual revoke/regenerate.
  - Why: Provides practical security control with lower complexity than expiry configuration.

## Validation Plan (User-Facing)

- How the user will verify "done":
  - AC1 -> Confirm Quotes appears in header and opens the tenant-scoped Quotes page.
  - AC2 -> Create a quote from a job context and confirm save success + quote presence in Quotes list/detail.
  - AC3 -> Edit an existing quote field/value, save, and refresh to confirm persisted changes.
  - AC4 -> Open quote print/export flow and confirm a usable PDF representation is produced.
  - AC5 -> Open the generated tokenized share link in a separate session/window, confirm read-only quote visibility, and confirm viewed tracking is recorded.
  - AC6 -> Confirm no acceptance buttons/status transitions for acceptance are shown in UI.
  - AC7 -> Create at least one quote and invoice in the same tenant and confirm quote numbering is on a separate sequence from invoices.
  - AC8 -> Build a quote from job context and confirm selectable/used quote items are existing job items only.
  - AC9 -> Select items into a quote, then confirm the same job items remain unchanged in invoice locking/status fields.
  - AC10 -> Create/send a quote, change underlying job item values, and confirm existing quote still shows snapshotted values.
  - AC11 -> Revoke/regenerate a public quote token, confirm old link no longer works, and new link opens correctly.
- Rollout notes (if any): MVP rollout for internal users first; acceptance workflow reserved for later story.
