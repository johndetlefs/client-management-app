# Firestore Backup And Import

This is the admin recovery workflow for `CMA-002`.

It exports the whole Firestore app database, not only the current user or active tenant. The first version is Firestore-only, local-only, non-destructive on import, and manually retained.

## Snapshot Location

Real snapshots default to:

```bash
backups/firestore/
```

That directory is ignored by git. Do not commit real backup snapshots or live client/invoice data. Only safe fixtures under `scripts/data-backup/fixtures/` are intended for source control. Compatibility failure fixtures live under `scripts/data-backup/fixtures-invalid/`.

## Commands

Export emulator data:

```bash
npm run backup:firestore:export -- --target emulator
```

List local snapshots:

```bash
npm run backup:firestore:list
```

Inspect a snapshot manifest:

```bash
npm run backup:firestore:inspect -- --snapshot backups/firestore/<snapshot-id>
```

Dry-run an emulator import:

```bash
npm run backup:firestore:dry-run -- --target emulator --snapshot backups/firestore/<snapshot-id>
```

Import into the emulator:

```bash
npm run backup:firestore:import -- --target emulator --snapshot backups/firestore/<snapshot-id>
```

Validate committed migration fixtures:

```bash
npm run backup:firestore:validate-fixtures
```

## Live Firebase Guardrails

Live export, dry-run, and import require an explicit project confirmation:

```bash
npm run backup:firestore:export -- --target live --project-id invoicing-prod-e7da8 --confirm-project invoicing-prod-e7da8
```

The command refuses to run if `--confirm-project` does not exactly match the resolved project ID.

Live mode also requires Firebase Admin credentials through either:

- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `FIREBASE_ADMIN_CLIENT_EMAIL` plus `FIREBASE_ADMIN_PRIVATE_KEY`

The backup CLI loads `.env.local` automatically when present, while preserving any credentials already set in the shell.

## Versioning And Migrations

Each snapshot manifest includes:

- `backupFormatVersion`
- `appSchemaVersion`
- source environment/project
- tenant IDs
- document counts
- document checksum

Imports read these versions first. Older supported `appSchemaVersion` snapshots are migrated in memory before validation and import. The original snapshot files are not changed. Missing, unknown, or future schema versions fail before writes.

When the app data shape changes in a way that affects backup/import compatibility, add a migration under `scripts/data-backup/migrations/` or explicitly document why no migration is required.

## Current Exclusions

- Firebase Auth export/import
- Firebase Storage backup/import
- destructive mirror/replace restore
- scheduled cloud backups or retention automation

Those should be separate tracked tasks when needed.
