# Constitution

## Mission

- Help small agencies run client work, quoting, invoicing, and expense tracking from one place with less admin effort and fewer billing mistakes.
- Make quote-to-invoice workflows trustworthy by preventing duplicate billing and preserving clear billable history.
- Support multi-tenant operations so each business can work securely and independently.

## Target Users

- Primary users: small agencies that deliver client services and need quoting, invoicing, and expense visibility.
- Secondary users: operations/finance staff who prepare quotes/invoices and business owners who track profitability and compliance reporting.
- External users: end clients who receive quotes and view public invoice links.

## Core Outcomes

- Faster path from scoped work (quote) to invoiced and paid work.
- Fewer invoice errors, especially duplicate or missing billable items.
- Clear auditability of client work, item states, quote/invoice lifecycle, and expense records.
- Reliable capture and categorization of business expenses to support profit/loss visibility.
- Export-ready financial data for BAS and end-of-year accounting workflows.
- Safer collaboration within each business through role-aware access and tenant isolation.

## Non-Goals

- Full bookkeeping/tax platform replacement (e.g., direct tax lodgement, payroll, or full general ledger operations).
- Marketplace, CRM automation, or advanced marketing workflows.
- Enterprise-grade custom workflow engines and complex multi-role hierarchies beyond core owner/staff needs.

## Product Principles

- Accuracy over speed: prevent incorrect billing even if it adds a validation step.
- Clarity by default: users should always understand quote status, invoice status, expense status, and next actions.
- Tenant trust first: users must never see or affect data outside their own business scope.
- Progressive capability: deliver the smallest set of features that reliably supports end-to-end quote, invoice, and expense workflows.

## Success Signals

- Teams can complete client/job/item setup, issue a quote, and convert work to an invoice without support.
- Users report reduced manual reconciliation during invoice preparation.
- Users can maintain expense records and generate accounting exports without spreadsheet-heavy rework.
- Duplicate-billing incidents are rare and trend toward zero.
- Public invoice recipients can access invoices reliably with minimal support requests.
- Owners can confidently track quote and invoice states (draft, issued, accepted, paid/voided where applicable).

## Decision Filters

- Prefer options that reduce billing risk and improve trust in invoice totals.
- Prefer features that shorten time from quote creation to invoice issuance for common workflows.
- Prefer capabilities that improve profitability visibility and accounting handoff quality.
- Prefer simpler UX when two options produce similar business outcomes.
- Defer work that adds complexity without improving billing accuracy, speed, or tenant trust.

## Assumptions & Risks

- Assumption: small agencies prefer a lightweight operating workflow over all-in-one ERP complexity.
- Assumption: owner/staff role separation is sufficient for MVP and near-term growth.
- Risk: unclear quote and invoice lifecycle language may cause user confusion and support load.
- Risk: poor expense categorization quality can reduce trust in profitability reporting and exports.
- Risk: if public invoice access is unreliable or hard to use, payment cycles may slow.
- Risk: growth in tenant size and process complexity may require future role and workflow expansion.

## Change Log

- 2026-03-03: Created initial constitution focused on mission, target users, product outcomes, principles, and decision criteria.
- 2026-03-03: Refined scope for small agencies and added outcomes for expenses, accounting exports, and expanded quote/invoice lifecycle.
