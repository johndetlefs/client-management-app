## User Story

As an owner/developer-admin, I want to export all Firebase app data into versioned timestamped backup snapshots and import a selected snapshot back into Firebase with migration, validation, and safety checks, so that I can recover client, job, invoice, quote, and tenant records even as the app's data shape changes over time.

## Goal

- Deliver an admin/developer-operated Firestore backup and import workflow that exports the whole app database, stores real snapshots outside git, validates and migrates versioned snapshots before import, and restores safely into emulator or live Firebase with explicit live-project confirmation.

## Approach

- Build the workflow as local TypeScript/Node tooling under `scripts/` with shared backup modules, npm command aliases, safe fixture data, and documentation.
- Treat emulator backup/import as the proof path before live use.
- Keep the first version Firestore-only, non-destructive on import, local/gitignored for real snapshots, and manually retained.
- Use manifest-driven backup format versioning plus app schema versioning so older snapshots can be migrated before restore.

## Phases

### Phase 1

- Changes: Define backup snapshot structure, manifest shape, gitignored snapshot location, safe fixtures, migration registry, and validation helpers.
- Validation: Confirm fixtures are safe to commit; generated snapshot directories are ignored by git; version metadata is required and unsupported versions fail validation.
- Tracker updates: Keep story at `Analysing` until implementation starts; move to `In Progress` when the first work item is implemented.

### Phase 2

- Changes: Implement full-project Firestore export for emulator and live targets, including root collections and tenant subcollections with manifest counts and checksums.
- Validation: Export seeded emulator data and verify manifest/document counts; confirm live export requires explicit live target/project selection.
- Tracker updates: Remain `In Progress` during implementation.

### Phase 3

- Changes: Implement dry-run import, migration-on-import, non-destructive write planning, emulator restore, and failure reporting.
- Validation: Dry-run current and older fixture snapshots; restore into a clean emulator; verify restored app data through Firestore/emulator UI or app flows.
- Tracker updates: Move to `Testing` after implementation and validation have run.

### Phase 4

- Changes: Add live import guardrails, operator docs, and command-level safety checks for unsupported destructive modes.
- Validation: Verify live import refuses to run without explicit target confirmation; verify destructive mode fails before writes; run lint/build if code changes warrant it.
- Tracker updates: Do not move to `Complete` until validation is confirmed and the user explicitly asks.

## Tasks

|  ID | Title | Description | Acceptance Criteria | User Verification | Status |
| --: | ----- | ----------- | ------------------- | ----------------- | ------ |
|   1 | Define backup format and safety boundaries | Establish versioned snapshot structure, manifest schema, gitignored output directory, safe fixture location, and npm/script command names without touching live data. | - Manifest supports `backupFormatVersion`, `appSchemaVersion`, source metadata, tenant IDs, counts, and checksum fields (AC3).<br>- Real snapshot directory is ignored by git (AC4).<br>- Safe fixtures can be committed without real customer data (AC13). | - Inspect manifest/fixture docs and `.gitignore` updates.<br>- Run a fixture validation command and confirm raw snapshot output is not listed by `git status --short`. | Complete |
|   2 | Build full-project Firestore export | Create the export path that reads root `users`, `tenants`, and every tenant's `users`, `clients`, `jobs`, `jobItems`, `invoices`, `quotes`, `settings`, and `counters` into a timestamped snapshot. | - Emulator export captures all app collections for all tenants (AC1).<br>- Live export requires explicit live environment/project selection (AC2).<br>- Export preserves document IDs, timestamps, nested values, arrays, counters, tokens, and lock/status fields in backup representation (AC9). | - Seed emulator data, run export, inspect snapshot files and manifest counts.<br>- Attempt live export without explicit live selection and confirm it refuses to run. | Complete |
|   3 | Add migration and snapshot validation framework | Implement version detection, ordered migration registry, unsupported-version failures, immutable snapshot handling, and safe older-version fixture tests. | - Older supported snapshot versions migrate before validation and report their migration path (AC11).<br>- Missing/unknown/future versions fail before writes (AC12).<br>- Fixture proves an old shape transforms into current import shape (AC13).<br>- Original snapshot files are unchanged after migration/dry-run (AC14). | - Run migration fixture validation.<br>- Run dry-run against supported old, missing-version, and future-version fixtures and compare output. | Complete |
|   4 | Implement non-destructive import dry-run | Create the import planner that validates a snapshot, applies migrations, compares against the target, and reports creates/updates/skips while rejecting delete/replace modes. | - Dry-run reports target environment, tenant coverage, collection counts, migrations, creates/updates/skips, and no destructive operations before writes (AC5).<br>- Attempted delete/replace mode fails before writes (AC8).<br>- Failure output identifies compatibility or document-path issues (AC10). | - Run dry-run against a current snapshot.<br>- Run dry-run with unsupported destructive mode and confirm it fails before writes.<br>- Run a malformed fixture and confirm actionable failure output. | Complete |
|   5 | Restore validated snapshots into emulator | Add the write path for non-destructive import into emulator and verify restored data is usable through existing app/emulator views. | - Emulator import restores a selected snapshot (AC6).<br>- Restored records preserve IDs, timestamps, counters, public tokens, quote/invoice data, and job item lock/status fields (AC9).<br>- Partial failures do not report full success and include failed document paths (AC10). | - Clear emulator data, import a snapshot, and inspect clients/jobs/invoices/quotes/settings in Firebase Emulator UI or the app.<br>- Spot-check counters and item lock/status fields. | Complete |
|   6 | Add live import guardrails and operator docs | Document the workflow and add explicit confirmation requirements for live imports, including target project naming and emulator-first rollout guidance. | - Live import requires explicit confirmation naming the target project/environment (AC7).<br>- Docs explain backup, inspect, dry-run, emulator restore, live guardrails, manual retention, and exclusions for Auth/Storage/destructive restore.<br>- Live commands avoid logging secrets and keep raw snapshots outside git (AC4). | - Attempt live import without exact confirmation and confirm it refuses to run.<br>- Review docs and run the documented emulator backup/dry-run/import path end-to-end. | Complete |

## Files / Areas Likely to Change

- `.gitignore`
- `package.json`
- `scripts/backup-firestore.ts` or `scripts/data-backup/firestore-backup.ts`
- `scripts/data-backup/` shared backup/import modules
- `scripts/data-backup/migrations/` versioned migration steps
- `scripts/data-backup/fixtures/` safe redacted/synthetic fixtures
- `scripts/data-backup/README.md` or `docs/data-backup.md`
- `.project-workflow/tasks/CMA-002-Backup-And-Import-Data/REQUIREMENTS.md`
- `.project-workflow/tasks/CMA-002-Backup-And-Import-Data/IMPLEMENTATION.md`

## Data / Storage / Compatibility

- Real snapshots should default to a gitignored local path such as `backups/firestore/`.
- Backup format should start at `backupFormatVersion: 1`.
- Current app schema should start at `appSchemaVersion: 1`.
- Future data-shape changes that affect restore compatibility must add a migration step or document why no migration is required.
- Import should transform older snapshots into a current-shape working copy without mutating the original snapshot.

## Risks & Mitigations

- Risk: Raw customer/client data is committed accidentally.<br>Mitigation: Default real snapshot path is gitignored; only safe fixtures/docs are committed.
- Risk: Operator imports into the wrong live Firebase project.<br>Mitigation: Live commands require explicit environment/project selection and target-name confirmation.
- Risk: Old backups become unreadable as schema changes.<br>Mitigation: Version every snapshot and maintain ordered migration steps with fixtures.
- Risk: Import makes live data worse.<br>Mitigation: Dry-run first, non-destructive writes only, emulator restore proof before live use, and failure reporting by document path.
- Risk: Firestore-only backup misses future Auth or Storage needs.<br>Mitigation: Auth/Storage are explicitly out of scope for this first task and should become separate tracked tasks when app usage requires them.
