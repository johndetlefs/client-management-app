# Requirements

## Overview

- Goal (in user terms): Give the business a reliable way to export, preserve, inspect, and restore Firebase-backed client-management data if live data is damaged, accidentally deleted, or needs to be moved between environments.
- Primary user(s): Business owner/developer-admin responsible for maintaining the app and recovering tenant data.
- Desired outcome: The app has a repeatable backup/import workflow for all Firebase app data, with versioned snapshots, migration support for older data shapes, and enough safeguards to avoid making a bad data situation worse.

## User Story

As an owner/developer-admin, I want to export all Firebase app data into versioned timestamped backup snapshots and import a selected snapshot back into Firebase with migration, validation, and safety checks, so that I can recover client, job, invoice, quote, and tenant records even as the app's data shape changes over time.

## In Scope

- Back up Firestore app data for the current data model, including root `users`, `tenants`, tenant `users`, `clients`, `jobs`, `jobItems`, `invoices`, `quotes`, `settings`, and `counters`.
- Export the whole app database across all accounts/tenants, not only the currently signed-in user or active tenant.
- Support both Firebase emulator data and live Firebase project data, with an explicit environment target so the operator cannot accidentally import into the wrong environment.
- Produce timestamped, inspectable backup snapshots with a manifest that records `backupFormatVersion`, `appSchemaVersion`, source project/environment, tenant IDs, collection counts, creation time, and checksum/hash information.
- Provide import/restore capability from a selected snapshot, including schema/shape validation, tenant-scope validation, and dry-run output before writes occur.
- Support imports from older snapshot/schema versions by applying explicit, version-controlled data migrations before validation and restore.
- Preserve Firestore data types needed by the app, including timestamps, document IDs, nested objects, arrays, nullable fields, and minor-unit currency values.
- Prevent accidental commits of sensitive customer data by keeping real backup snapshots outside normal git tracking by default.

## Out of Scope

- Customer-facing backup/restore UI.
- Automated scheduled cloud backups or long-term retention infrastructure.
- Destructive mirror/replace restore that deletes live documents missing from a snapshot.
- Full accounting/audit product export workflows beyond operational backup and restore.
- Direct tax lodgement, BAS preparation, or bookkeeping integrations.
- Firebase Authentication account export/import unless explicitly added after scope confirmation.
- Firebase Storage object backup/import unless app usage or a future requirement makes it necessary.
- Automated migration of arbitrary unknown backup shapes that do not declare a supported version.

## Requirements

List requirements as outcomes/expectations, not implementation details.

### Functional Requirements

- An operator can create a full-project backup snapshot from either emulator data or live Firebase data by intentionally selecting the target environment.
- Backup output includes all current Firestore app collections needed to reconstruct tenant data relationships and document identity.
- Backup output includes a manifest with `backupFormatVersion`, `appSchemaVersion`, source metadata, collection/document counts, tenant coverage, timestamp, and integrity information.
- Backup snapshots are stored in a location that is ignored by git by default, while any safe templates/docs needed to operate the workflow can be version controlled.
- An operator can list or inspect available backup snapshots before selecting one for import.
- An operator can run an import dry-run that validates snapshot shape, target environment, tenant IDs, collection counts, and potentially destructive changes without writing data.
- Import reads snapshot version metadata and either confirms it is already current or applies a deterministic migration path from the snapshot version to the current app schema version.
- Migration code is version controlled, ordered, and testable with safe fixture data so old snapshots remain restorable after app data shape changes.
- Import refuses unsupported future versions, unknown versions, or snapshots whose migration path is missing.
- Import dry-run reports any migrations that will be applied before reporting creates/updates/skips and confirming that no deletes are planned.
- Import never mutates the original snapshot while migrating; any transformed data is produced as a derived working copy or in-memory transformation for the restore run.
- An operator can import a validated snapshot into emulator data for recovery testing.
- An operator can import a validated snapshot into live Firebase only after an explicit confirmation step that names the target project/environment.
- Import behavior protects against accidental data loss by staying non-destructive in this task; unsupported replace/delete flags fail before writes.
- The workflow reports clear success/failure output, including counts of created, updated, skipped, and failed documents.
- The workflow preserves tenant isolation and does not allow one tenant backup to overwrite another tenant unless explicitly selected and validated.
- The workflow does not automatically delete old snapshots; retention is manual for the first version.

### Non-Functional Requirements

- Performance / latency: Backup and import should handle the app's expected MVP tenant data size without timing out in local admin/developer use; large collections should report progress.
- Security / permissions: Live Firebase operations require admin credentials, must avoid logging secrets, and must keep raw customer data out of git by default.
- Accessibility: Not applicable for the first CLI/admin workflow; any future UI must follow app accessibility standards.
- Maintainability: Every app data shape change that affects backup/import compatibility should either add a migration step or explicitly document why no migration is required.
- Observability (logs/metrics/audit expectations): Backup/import runs should emit a local run summary that can be retained with the snapshot manifest without exposing secrets.

## Acceptance Criteria

- AC1: A backup run can export all emulator Firestore app data into a timestamped snapshot containing root app metadata plus every tenant's subcollections for users, clients, jobs, jobItems, invoices, quotes, settings, and counters.
- AC2: A backup run can export all live Firebase Firestore app data only when the operator explicitly selects the live environment/project.
- AC3: Each snapshot includes a manifest with `backupFormatVersion`, `appSchemaVersion`, source environment/project, timestamp, tenant IDs, document counts by collection, and integrity/checksum data.
- AC4: Real backup snapshot files are excluded from git by default, while operational documentation and safe examples can be committed.
- AC5: A dry-run import validates a selected snapshot and reports the target environment, tenant coverage, collection counts, migrations, creates/updates/skips, and confirmation that no destructive operations are planned before any write occurs.
- AC6: Import into emulator can restore a selected snapshot and the restored data can be viewed through the local app or Firebase Emulator UI.
- AC7: Import into live Firebase requires an explicit confirmation naming the target project/environment and cannot run silently.
- AC8: Import behavior is non-destructive for this task; any attempted delete/replace mode fails before writes with a clear unsupported-mode message.
- AC9: Imported records preserve document IDs, timestamps, nested data, arrays, counters, invoice/quote numbering state, line item snapshots, public tokens, and job item invoice lock/status fields.
- AC10: Failed or partially failed imports produce actionable output showing which document(s) failed and do not report success unless all intended writes are complete.
- AC11: Importing a snapshot with an older supported `appSchemaVersion` applies the required migration steps before validation and reports the migration path in dry-run output.
- AC12: Importing a snapshot with an unknown, unsupported future, or missing schema version fails safely before writes and explains the compatibility problem.
- AC13: At least one safe fixture validates the migration framework by transforming an older backup shape into the current expected import shape.
- AC14: The migration framework leaves the original backup snapshot unchanged.

## Assumptions

- First implementation should be an admin/developer-operated workflow, likely a local script/CLI, rather than product UI.
- The app is currently personal/single-operator, but the backup format should not assume single-tenant or single-user data because the app may become monetized later.
- Firestore is the recovery priority because the app currently stores business records there; Firebase Storage is configured but no active app storage usage was found in code.
- Raw live customer data should not be committed to git. If version-controlled fixtures are needed, they should be redacted, synthetic, or encrypted by a separate explicit decision.
- Firebase Auth export/import is a separate concern from Firestore app data because Auth user records are outside Firestore and have different tooling/security behavior.
- Initial version numbers can start at `backupFormatVersion: 1` and `appSchemaVersion: 1`; future data-shape changes should increment `appSchemaVersion` when old snapshots need migration.

## Open Questions

- None.

## Decisions Log

- Decision: Treat raw customer backup snapshots as non-git artifacts by default.
  - Context: The user wants backup/version-control safety, but the data includes client and invoice information.
  - Options considered: Commit raw snapshots; commit only redacted fixtures/docs; store real snapshots outside git with manifests/checksums.
  - Chosen: Store real snapshots outside git by default and version-control only safe workflow files/docs.
  - Why: Prevents accidental exposure of client/business data while still giving rollback and verification artifacts.
- Decision: Start with an admin/developer recovery workflow rather than customer-facing UI.
  - Context: The request is urgent operational data safety.
  - Options considered: Product UI; local/admin script; scheduled managed backup system.
  - Chosen: Local/admin workflow first.
  - Why: Faster, safer, and avoids exposing destructive restore operations in the app before requirements are mature.
- Decision: Export the full app database rather than user-scoped data.
  - Context: The app is currently for one operator, but the data is stored in a multi-tenant shape and may later support monetization.
  - Options considered: Current user only; active tenant only; full app database.
  - Chosen: Full app database.
  - Why: Backup/import is an admin disaster-recovery workflow, so it must capture root metadata and all tenants/accounts to be useful.
- Decision: Version every snapshot and support migration-on-import for older data shapes.
  - Context: The app data model will change as features are added, removed, or expanded.
  - Options considered: Raw snapshots only; versioned snapshots with manual migration notes; versioned snapshots with explicit import migrations.
  - Chosen: Versioned snapshots with explicit import migrations.
  - Why: It keeps old backups restorable and makes data-shape changes deliberate rather than accidental restore failures.
- Decision: Exclude Firebase Auth user export/import from this first task.
  - Context: Firestore contains the business records that need immediate operational recovery; Firebase Auth user data has different tooling and security characteristics.
  - Options considered: Firestore only; Firestore plus Firebase Auth.
  - Chosen: Firestore only.
  - Why: Covers the urgent client/job/invoice/quote/settings data while keeping the first recovery workflow smaller and safer.
- Decision: Keep imports non-destructive in this first task.
  - Context: Destructive mirror restore is useful for true rollback, but it can also delete valid live data if the wrong snapshot or target is selected.
  - Options considered: Non-destructive create/update only; explicit destructive replace mode.
  - Chosen: Non-destructive create/update only.
  - Why: Safer first implementation; destructive restore can be added later with stronger safeguards after the basic workflow is proven.
- Decision: Store live backup snapshots in a local gitignored location for the first task.
  - Context: The immediate need is reliable manual recovery, and raw backup data is sensitive.
  - Options considered: Local gitignored folder only; local folder plus encrypted archive target.
  - Chosen: Local gitignored folder only.
  - Why: Reduces setup complexity and leakage risk for the first version while still supporting manual copying to an external drive if needed.
- Decision: Use manual snapshot retention for the first task.
  - Context: Current data volume is expected to be small and the app is personal/single-operator for now.
  - Options considered: Keep all snapshots until manually deleted; keep a fixed number of recent snapshots.
  - Chosen: Keep all snapshots until manually deleted.
  - Why: Avoids accidentally deleting the only useful restore point before retention needs are clearer.

## Validation Plan (User-Facing)

- How the user will verify "done":
  - AC1 -> Run backup against emulator data and confirm snapshot files include root metadata and every tenant's subcollection data.
  - AC2 -> Attempt live backup and confirm the command requires explicit live environment/project selection.
  - AC3 -> Open the generated manifest and verify version metadata, source metadata, timestamp, tenant IDs, counts, and checksum/integrity fields.
  - AC4 -> Run `git status --short` after generating a real snapshot and confirm raw backup data is not shown as a commit candidate.
  - AC5 -> Run import dry-run against a selected snapshot and confirm it reports target environment, tenant coverage, collection counts, migrations, creates/updates/skips, and no destructive operations without writing.
  - AC6 -> Clear emulator data, import a snapshot into emulator, then verify restored clients/jobs/invoices/quotes through the app or Firebase Emulator UI.
  - AC7 -> Attempt live import and confirm it requires explicit target-project/environment confirmation before writes.
  - AC8 -> Attempt an unsupported delete/replace import mode and confirm it fails before writes with a clear unsupported-mode message.
  - AC9 -> Spot-check restored invoices, quotes, counters, public tokens, timestamps, and job item lock/status fields against the backup source.
  - AC10 -> Run or simulate a failure case and confirm output identifies failed document paths and does not report full success.
  - AC11 -> Import a supported older-version fixture into emulator and confirm dry-run reports the migration path before validation/import.
  - AC12 -> Try importing an unsupported/missing-version fixture and confirm it fails before writes with a clear compatibility message.
  - AC13 -> Run the migration fixture validation and confirm the transformed output matches the current expected shape.
  - AC14 -> Confirm the original snapshot files are byte-for-byte unchanged after dry-run/import.
- Rollout notes (if any): Validate thoroughly in emulator with a fresh backup before allowing any live import run.
