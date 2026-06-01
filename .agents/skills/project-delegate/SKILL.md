---
name: project-delegate
description: Use when coordinating multiple project-workflow implementation work items through project-implement.
---

# Project Delegate

Coordinate delegated execution of planned work items.

## Invocation Rules

- Use this skill whenever the user asks to delegate, batch, parallelize, or coordinate multiple project-workflow work items.
- Read `AGENTS.md` first and follow its Workflow Skill Map and CLI Requirements.
- Delegation routes each work item through `project-implement`; it does not replace requirements, planning, or implementation rules.

## Inputs

- Task ID
- Work item IDs
- Mode: `sequential` or `parallel`
- Dependency map, if any
- Worker limit for parallel mode, default `4`

## Workflow

1. Confirm the task and work items exist in `IMPLEMENTATION.md`.
2. Default to `sequential` if the user does not specify a mode.
3. In `sequential` mode, run one work item at a time in the requested order.
4. In `parallel` mode, validate dependencies before starting:
   - no unknown item IDs
   - no self-dependencies
   - no cycles
5. Launch only eligible work items whose prerequisites are complete.
6. On first work-item failure, stop launching new items, let in-progress items finish, and mark unstarted blocked items as `halted` in the report.
7. Report each item status and a final aggregate summary with completed, failed, and halted items.

## Guardrails

- Do not start implementation when requirements or planning are missing.
- Do not mark a task complete unless validation has passed and the user explicitly asks.
- Keep tracker updates consistent with `project-implement`.
