## User Story

As an owner or staff user, I want to create and manage a quote based on a job and send it to a client as either a PDF or shareable link, so that I can provide a formal pre-invoice pricing document through a workflow that feels consistent with invoices.

## Goal

- Deliver an MVP quote workflow that mirrors invoice UX patterns: users can find Quotes in navigation, create/update quotes from existing job items, use separate quote numbering, and share quotes via PDF and tokenized public link with view tracking.

## Approach

- Build in vertical slices: first internal quote management (navigation, list/detail, create/update), then external delivery (PDF/public link + viewed tracking), while reusing proven invoice/public-link patterns and maintaining strict tenant/role controls.

## Phases

### Phase 1

- Changes: Add Quotes navigation + quote list/detail/create/update flow with data scoped to tenant and line items sourced from existing job items only; introduce quote numbering sequence independent from invoices.
- Validation: Owner/staff can create and edit quotes from job context; quote list/detail is reachable from header; numbering does not collide with invoice numbering; no acceptance actions shown.
- Tracker updates: Keep story at `Analysing` while plan is drafted/confirmed; move to `Plan Confirmed` only after explicit user confirmation.

### Phase 2

- Changes: Add quote PDF rendering and tokenized public quote page with read-only access and viewed-event tracking consistent with invoice public links.
- Validation: Quote is printable/exportable as PDF; public link opens read-only quote view; viewed tracking event is recorded.
- Tracker updates: Move to `In Progress` when implementation starts; move to `Testing` for end-to-end validation; only move to `Complete` after user-confirmed validation.

## Task List (for IMPLEMENTATION.md)

|  ID | Title                                | Description                                                                                                                                          | Acceptance Criteria                                                                                                                                                                                                                                                                                                                                                                                                      | User Verification                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Status |
| --: | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
|   1 | Add Quotes navigation and listing    | Users can discover and open a dedicated Quotes area from workspace header, with tenant-scoped quote records visible for internal users.              | - Quotes appears as a top-level workspace header item (AC1).<br>- Selecting Quotes opens a tenant-scoped list view showing existing quotes (AC1).<br>- Owner/staff permissions are enforced and no cross-tenant quote data is visible.                                                                                                                                                                                   | - Sign in as owner/staff and confirm Quotes appears beside existing top-level links.<br>- Open Quotes and confirm only current-tenant quote data is shown.                                                                                                                                                                                                                                                                                                            | To Do  |
|   2 | Create quote from job items          | Users can create a quote from job context using existing job items only, and saved quotes persist with an independent quote numbering sequence.      | - User can create and save a quote tied to an existing client/job (AC2).<br>- Quote item selection source is existing job items only (AC8).<br>- Quote receives numbering from a sequence independent from invoices (AC7).<br>- Selecting items for quotes does not alter invoice item locking/status (`open`/`selected`/`invoiced`) (AC9).<br>- Quote item amounts are snapshotted into quote data at save time (AC10). | - From a job workflow, create a quote and save it.<br>- Confirm selected line items come from existing job items and no manual-only item path is required.<br>- Create an invoice and quote in same tenant and confirm numbering sequences are distinct.<br>- After quote creation, inspect related job items and confirm invoice lock/status fields are unchanged.<br>- Change a job item value after quote save and confirm existing quote values remain unchanged. | To Do  |
|   3 | Edit quote details after creation    | Internal users can reopen existing quotes, update quote details, and persist changes while quote remains editable, with no acceptance UI introduced. | - Existing quote can be opened and updated with persisted changes (AC3).<br>- No quote acceptance action or acceptance status controls are shown in this phase (AC6).                                                                                                                                                                                                                                                    | - Open an existing quote, change at least one field/value, save, then refresh and confirm updates persist.<br>- Confirm there is no accept/approve action in internal quote UI.                                                                                                                                                                                                                                                                                       | To Do  |
|   4 | Generate quote PDF output            | Users can produce a printable/exportable quote representation suitable for sending to clients.                                                       | - Quote detail provides PDF/print output path (AC4).<br>- PDF output includes core quote data needed by client (client, items, totals, quote number).                                                                                                                                                                                                                                                                    | - Open a saved quote and use the print/export action.<br>- Confirm PDF opens/prints and includes expected quote details.                                                                                                                                                                                                                                                                                                                                              | To Do  |
|   5 | Publish tokenized public quote links | Users can share a tokenized read-only quote link externally, and quote view events are tracked similarly to public invoice behavior.                 | - System provides tokenized public quote link for sharing (AC5).<br>- Public quote page is read-only and displays quote details (AC5).<br>- Opening the public link records a viewed event in server-side tracking/log path (AC5).<br>- Users can manually revoke/regenerate a quote public token; old token stops working and new token works (AC11).                                                                   | - Copy the generated share link and open in a separate browser session.<br>- Confirm quote is viewable read-only.<br>- Confirm viewed tracking/event is recorded via existing admin/log view or trace mechanism.<br>- Revoke/regenerate the public link, then confirm old URL fails and new URL succeeds.                                                                                                                                                             | To Do  |

## Files / Areas Likely to Change

- `src/app/workspace/layout.tsx`
- `src/components/layout/AppHeader.tsx`
- `src/app/workspace/quotes/page.tsx` (new)
- `src/app/workspace/quotes/actions.ts` (new)
- `src/app/workspace/quotes/[id]/page.tsx` (new)
- `src/app/workspace/quotes/[id]/print/...` (new)
- `src/app/public/quote/[token]/page.tsx` (new)
- `src/app/public/quote/[token]/actions.ts` (new)
- `src/types/quote.ts` (new)
- `src/lib/invoice-utils.ts` or new quote utility module for numbering/format reuse

## Data / RLS / RPC / Migrations

- Add tenant-scoped `quotes` collection under `tenants/{tenantId}/quotes` with server-side role enforcement matching invoice patterns.
- Add quote numbering counter strategy separate from invoice counters, implemented transactionally to preserve uniqueness under concurrency.
- Reuse tokenized public-document pattern for quote links with viewed-event recording.
- No SQL/RLS/RPC migrations expected (Firestore-backed app).

## Risks & Mitigations

- Risk: Quote and invoice logic divergence creates inconsistent UX or bugs.<br>Mitigation: Reuse existing invoice patterns/components/actions where behavior should match.
- Risk: Numbering collisions or race conditions under concurrent quote creation.<br>Mitigation: Use Firestore transactions for quote counter increments and persistence.
- Risk: Public link exposure across tenants.<br>Mitigation: Enforce token lookup + tenant scoping in server actions and return read-only serialized output only.
- Risk: Scope creep into acceptance or quote-to-invoice conversion.<br>Mitigation: Keep AC6 explicit in task validation and defer extra lifecycle features to later stories.
