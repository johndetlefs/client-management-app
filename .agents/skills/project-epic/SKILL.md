---
name: project-epic
description: Use when managing project-workflow epic setup, decomposition, approval, and child task scaffolding.
---

# Project Epic

Manage epic lifecycle operations through the local workflow CLI.

## Invocation Rules

- Use this skill whenever the user asks for a project-workflow epic, epic decomposition, epic child approval, or epic child task scaffolding.
- Read `AGENTS.md` first and follow its Workflow Skill Map and CLI Requirements.
- Use the local workflow CLI for supported epic operations.
- Do not scaffold child folders from an epic until the relevant epic tracker row is `Approved`.

## Workflow

1. Infer the requested action: `init`, `decompose`, `approve`, or `scaffold-child`. Ask one clarifying question if ambiguous.
2. For `init`, require a concrete epic title and run:

```bash
./.project-workflow/cli/workflow epic init --title "<TITLE>"
```

3. Before `decompose`, verify the epic `REQUIREMENTS.md` has concrete non-placeholder requirements or acceptance criteria.
4. For `decompose`, run:

```bash
./.project-workflow/cli/workflow epic decompose --epic-id <EPIC_ID> --limit <LIMIT> --type <TYPE>
```

5. For `approve`, run:

```bash
./.project-workflow/cli/workflow epic approve --epic-id <EPIC_ID> --id <ROW_ID>
```

6. For `scaffold-child`, run:

```bash
./.project-workflow/cli/workflow epic scaffold-child --epic-id <EPIC_ID> --id <ROW_ID>
```

With a child branch:

```bash
./.project-workflow/cli/workflow epic scaffold-child --epic-id <EPIC_ID> --id <ROW_ID> --create-branch --epic-branch <EPIC_BRANCH> --branch-prefix <PREFIX>
```

7. Report the command run, resulting files/folders, tracker updates, and next gate.

## Guardrails

- Decomposition is proposal-first: it writes Proposed rows and does not scaffold child folders.
- Only Approved rows can be scaffolded.
- If branch creation is requested, the epic branch must already exist; do not silently fall back to another branch.
- Ask at most one clarifying question at a time.
