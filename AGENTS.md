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
2. Task: use `.agents/skills/project-task/SKILL.md` to create one task folder and tracker row.
3. Requirements: use `.agents/skills/project-requirements/SKILL.md` to capture user story, scope, acceptance criteria, decisions, and validation.
4. Planner: use `.agents/skills/project-planner/SKILL.md` to turn confirmed requirements into testable work items.
5. Clarify: use `.agents/skills/project-clarify/SKILL.md` to resolve conflicts before implementation.
6. Implement: use `.agents/skills/project-implement/SKILL.md` to make scoped code changes, validate, and update tracker status.
7. QA review: use `.agents/skills/project-qa-review/SKILL.md` after implementation reaches Testing.
8. Retro: use `.agents/skills/project-retro/SKILL.md` after a task is complete to capture durable lessons.
- Epics: use `.agents/skills/project-epic/SKILL.md` for proposal-first epic setup, decomposition, approval, and child task scaffolding.
- Delegate: use `.agents/skills/project-delegate/SKILL.md` when coordinating multiple planned work items.

## Workflow Skill Map

- If the user asks to create, update, review, or align the product constitution, use `.agents/skills/project-constitution/SKILL.md`.
- If the user asks to create a task, story, feature folder, tracker row, or tracked project-workflow item, use `.agents/skills/project-task/SKILL.md`.
- If a legacy scaffold workflow is requested, use `.agents/skills/project-scaffold/SKILL.md` as the alias for project-task.
- If the user asks to capture requirements, define scope, write acceptance criteria, record open questions, or prepare a validation plan, use `.agents/skills/project-requirements/SKILL.md`.
- If the user asks to plan implementation, break requirements into phases, or create testable work items, use `.agents/skills/project-planner/SKILL.md`.
- If the user asks to resolve ambiguity, reconcile conflicting requirements, or decide between unclear options, use `.agents/skills/project-clarify/SKILL.md`.
- If the user asks to implement a planned project-workflow item, use `.agents/skills/project-implement/SKILL.md`.
- If the user asks to create or manage an epic, use `.agents/skills/project-epic/SKILL.md`.
- If the user asks to delegate multiple project-workflow work items, use `.agents/skills/project-delegate/SKILL.md`.
- If the user asks for QA review, code review gate, or acceptance validation review, use `.agents/skills/project-qa-review/SKILL.md`.
- If the user asks for a retro, retrospective, convention update, or post-completion cleanup, use `.agents/skills/project-retro/SKILL.md`.

## CLI Requirements

- Treat `.project-workflow/cli/workflow` as the authoritative way to perform workflow operations it supports.
- Use the CLI for task scaffolding and tracker-safe task creation.
- Run project-workflow CLI commands from the repository root.
- If a selected skill documents a CLI command, run that command instead of recreating its behavior manually.
- If the CLI does not support the selected workflow step, follow the selected skill and update the relevant Markdown files directly.
- If the CLI command fails, stop and report the failure before attempting a manual fallback.

## Status Rules

- New scaffolded tasks start as `To Do` unless requirements capture begins immediately.
- Set the tracker row to `Analysing` while requirements are being captured.
- Set the tracker row to `In Progress` before implementation work begins.
- Set the tracker row to `Testing` after implementation and validation have run.
- Set the tracker row to `Review` during QA/code review when that gate is used.
- Set the tracker row to `Complete` only after validation/review is confirmed and the user explicitly asks.

## Validation

- Run the most relevant available tests, type checks, linters, or manual verification steps for the changed work.
- If broad validation fails for unrelated pre-existing reasons, run the narrowest meaningful checks and report the limitation.

<!-- project-workflow:start -->
## Project Workflow

This repository uses project-workflow. Keep workflow state in `.project-workflow/BACKLOG.md`, `.project-workflow/TRACKER.md`, and `.project-workflow/tasks/`.

- Read repo-specific workflow guidance from `.project-workflow/guidance.md`.
- Use `.project-workflow/BACKLOG.md` for optional future intent before work is promoted into task or epic execution state. Promoted rows stay in the backlog; active execution status belongs in trackers and task/epic docs.
- Read task ID namespace and generation config from `.project-workflow/config.json`.
- To initialize a new repository, run `uvx --from project-workflow==0.2.0 project init` from the repository root with `--agent codex`, `--agent cursor`, `--agent claude-code`, or `--agent github-copilot`.
- To upgrade an existing repository, run `uvx --from project-workflow==0.2.0 project upgrade` with its agent mode. Authorized non-interactive agents add `--yes`; human invocation confirms before upgrade applies managed assets plus repository schema together. Do not run init first.
- Use `./.project-workflow/cli/workflow` for supported backlog, Fix, task, epic, and validation commands.
- Route one bounded post-completion correction to a Fix, new outcomes or multiple independent items to a Task, and coordinated workstreams to an Epic. The user's label is evidence, not a binding classification. Fixes use one `FIX.md`, the shared tasks directory, and the global tracker; do not create a separate Fix tracker.
- Before planning, record one owner approval envelope with `task approve-requirements` or `epic approve-requirements`; unchanged work inside that envelope should proceed without repeated approval prompts, while drift, stale requirements, or evidence gaps must be fixed or amended.
- After requirements approval, run Planner, post-plan Clarify, `task ready`, and move new tasks to `Ready` autonomously unless material drift or exceptional risk requires owner input. `Plan Confirmed` remains legacy-compatible.
- For pre-existing work, use `task adopt` or `epic adopt`; pre-adoption inferred evidence stays untrusted until refreshed.
- For epics, `epic decompose` writes `DECOMPOSITION.md`; child rows must match that plan before approval, scaffold, readiness, or status advancement.
- Use `epic amend` for owner-approved mid-epic child rows outside the decomposition plan; direct tracker edits outside decomposition/amendment authority remain blocked.
- New/adopted epics require non-placeholder `EPIC-CONTRACT.md` before decomposition, child approval/scaffolding, or movement into Ready/In Progress.
- If requirements or claims trigger visual/reference, external contract, deployed artifact, runtime target/source, or responsive visual proof, fill child-local `EVIDENCE.json`; QA prose, tests, builds, or surrogate artifacts are invalid substitutes.
- Use `./.project-workflow/cli/workflow task status --id <TASK-ID> --to <STATUS>` for tracker lifecycle changes.
- Keep version command ownership explicit: init creates a new installation, Doctor diagnoses without mutation, and canonical UVX upgrade refreshes managed assets and transforms repository schema in one reviewed transaction. Use `upgrade --plan` and fingerprinted apply for automation.
- For a sanitized client handoff, use canonical `project smoke-bomb` from a clean dedicated worktree to review exact removal, run explicit validations, preserve useful client agent guidance, and export a ZIP without Git or workflow internals.
- Run `./.project-workflow/cli/workflow doctor` after tracker or task-doc changes.
<!-- project-workflow:end -->
