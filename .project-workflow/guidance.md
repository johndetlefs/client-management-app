# Project Workflow Guidance

This is a multi-tenant client management and invoicing SaaS built with Next.js App Router, TypeScript, Tailwind CSS, Firebase Auth, Firestore, and Storage.

## Validation

- Use `npm run lint` for the default static validation loop.
- Use `npm run build` before shipping broad app changes when practical.
- Use `npm run dev` for the local app plus Firebase emulators.
- Use `npm run dev:live` only when intentionally testing against live Firebase.
- Match proof to the claim: browser evidence is required for visible behaviour, and deployment evidence is required for hosted state.

## Technical Constraints

- Scope Firestore reads and writes under `tenants/{tenantId}` unless a task explicitly defines a safe cross-tenant operation.
- Authenticate the server caller and enforce owner/staff access before mutations. Client-supplied user IDs and client-side hiding are not authorization.
- Use `firebase-admin` for server-side Firestore work and Node runtime for Firestore-touching routes/actions when needed.
- Use Firestore transactions for consistency-sensitive imports, counters, restores, and rollback-sensitive writes.
- Store money in minor units and avoid floating-point currency arithmetic.
- Determine expense GST-credit eligibility from explicit effective-dated GST registration, never from invoice tax defaults, an ABN, bank categories, or merchant inference.
- Store potential GST included separately from GST currently claimable so registration or evidence review never rewrites the underlying purchase economics.
- Use deterministic confirmed-expense identity from the tenant candidate and link the candidate and expense in one Firestore transaction.
- Learn merchant rules only from confirmed owner decisions; apply them as editable suggestions that never change review state or overwrite existing candidates or expenses.
- Re-read an active merchant rule inside the candidate-creation transaction, and preserve creation, application, and unknown future metadata when relearning it.
- Treat recurrence as versioned suggestion evidence: require at least three distinct dates, collapse same-day occurrences, and keep explicit user-rule flags authoritative.
- Bound recurring-history analysis in the Firestore query as well as in memory, and store aggregate cadence evidence instead of historical transaction IDs.
- Reconcile accountant exports in minor units before workbook rendering; expose
  cumulative invoice payments without inventing payment dates, and recompute
  GST-registration drift against current effective-dated settings at export
  time.
- Require explicit BAS basis and cadence. Keep GST registration separate, and
  fail closed on cash-basis sales or net GST until dated payment events exist.
- Validate browser-uploaded QIF by extension, UTF-8 content, and `!Type:`
  signature; browsers may declare a valid QIF as
  `application/octet-stream`.
- Keep file inputs inside wide table cells bounded to a relative label. A
  generic visually-hidden input can expand the document root even when the
  table itself has a correct horizontal scroller.
- Preserve date, direction, minor-unit amount, account identity, fingerprint,
  and occurrence index when minimising personal transaction detail so later
  imports remain idempotent without retaining descriptions.
- Serialize Firestore `Timestamp` values before returning data to client components.
- Keep secrets, service-account data, live Firebase exports, and customer data out of git unless a task explicitly approves an encrypted fixture.

## Repository Handling

- Inspect runtime declarations, lockfiles, package scripts, local Codex environment, and required ignored files before implementation or validation.
- Verify the repository root, branch, worktree state, remote relationship, and active workflow item before mutations.
- Preserve unrelated user changes in a dirty worktree.
- Use the repository CLI for supported workflow operations and stop if a documented CLI operation fails.
- Set tracker status to `Complete` only after validation/review is confirmed and the owner explicitly asks.
