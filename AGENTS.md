# Codex Instructions

This repository uses project-workflow for spec-driven development. Keep workflow artifacts in `.project-workflow/` as the shared source of truth.

## Repository Context

This is a multi-tenant client management and invoicing SaaS built with Next.js App Router, TypeScript, Tailwind CSS, Firebase Auth, Firestore, and Storage.

- Use `npm run lint` for the default static validation loop.
- Use `npm run build` before shipping broad app changes when practical.
- Use `npm run dev` for the local app plus Firebase emulators.
- Use `npm run dev:live` only when intentionally testing against live Firebase.

## Technical Rules

- Scope all Firestore reads and writes under `tenants/{tenantId}` unless a task explicitly defines a safe cross-tenant operation.
- Enforce owner/staff access in server actions before mutations. Client-side hiding is not sufficient.
- Use `firebase-admin` for server-side Firestore work and mark Firestore-touching routes/actions for Node runtime when needed.
- Use Firestore transactions for consistency-sensitive updates such as invoice item locking, numbering counters, imports, restores, or rollback-sensitive writes.
- Store money in minor units. Do not use floating-point arithmetic for currency.
- Serialize Firestore `Timestamp` values before returning data to client components.
- Keep secrets, service account data, live Firebase exports, and customer data out of git unless a task explicitly approves an encrypted fixture.

## Workflow Order

1. Constitution: use `.agents/skills/project-constitution/SKILL.md` to establish or update `.project-workflow/CONSTITUTION.md`.
2. Scaffold: use `.agents/skills/project-scaffold/SKILL.md` to create one task folder and tracker row.
3. Requirements: use `.agents/skills/project-requirements/SKILL.md` to capture user story, scope, acceptance criteria, decisions, and validation.
4. Planner: use `.agents/skills/project-planner/SKILL.md` to turn confirmed requirements into testable work items.
5. Clarify: use `.agents/skills/project-clarify/SKILL.md` to resolve conflicts before implementation.
6. Implement: use `.agents/skills/project-implement/SKILL.md` to make scoped code changes, validate, and update tracker status.
- Epics: use `.agents/skills/project-epic/SKILL.md` for epic setup, decomposition, approval, and child task scaffolding.
- Delegate: use `.agents/skills/project-delegate/SKILL.md` when coordinating multiple planned work items.

## Workflow Skill Map

- If the user asks to create, update, review, or align the product constitution, use `.agents/skills/project-constitution/SKILL.md`.
- If the user asks to create a task, story, feature folder, tracker row, or tracked project-workflow item, use `.agents/skills/project-scaffold/SKILL.md`.
- If the user asks to capture requirements, define scope, write acceptance criteria, record open questions, or prepare a validation plan, use `.agents/skills/project-requirements/SKILL.md`.
- If the user asks to plan implementation, break requirements into phases, or create testable work items, use `.agents/skills/project-planner/SKILL.md`.
- If the user asks to resolve ambiguity, reconcile conflicting requirements, or decide between unclear options, use `.agents/skills/project-clarify/SKILL.md`.
- If the user asks to implement a planned project-workflow item, use `.agents/skills/project-implement/SKILL.md`.
- If the user asks to create or manage an epic, use `.agents/skills/project-epic/SKILL.md`.
- If the user asks to delegate multiple project-workflow work items, use `.agents/skills/project-delegate/SKILL.md`.

## CLI Requirements

- Treat `.project-workflow/cli/workflow` as the authoritative way to perform workflow operations it supports.
- Use the CLI for task scaffolding and tracker-safe task creation.
- Run project-workflow CLI commands from the repository root.
- If a selected skill documents a CLI command, run that command instead of recreating its behavior manually.
- If the CLI command fails, stop and report the failure before attempting a manual fallback.

## Status Rules

- New scaffolded tasks start as `To Do` unless requirements capture begins immediately.
- Set the tracker row to `Analysing` while requirements are being captured.
- Set the tracker row to `In Progress` before implementation work begins.
- Set the tracker row to `Testing` after implementation and validation have run.
- Set the tracker row to `Complete` only after validation is confirmed and the user explicitly asks.

## Validation

- Run the most relevant available tests, type checks, linters, or manual verification steps for the changed work.
- If broad validation fails for unrelated pre-existing reasons, run the narrowest meaningful checks and report the limitation.
