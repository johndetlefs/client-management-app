import { recalculateManifest, sortDocuments } from "../lib/snapshot.mjs";

const migrations = [
  {
    from: 0,
    to: 1,
    id: "schema-000-to-001-customers-to-clients",
    migrate(snapshot) {
      return {
        ...snapshot,
        documents: snapshot.documents.map((document) => ({
          ...document,
          path: document.path.replace(/(^|\/)customers\//g, "$1clients/"),
        })),
      };
    },
  },
];

export function migrateSnapshotToCurrent(snapshot, { currentAppSchemaVersion, backupFormatVersion }) {
  if (snapshot.manifest.backupFormatVersion !== backupFormatVersion) {
    throw new Error(
      `Unsupported backupFormatVersion ${String(snapshot.manifest.backupFormatVersion)}.`
    );
  }

  const startingVersion = snapshot.manifest.appSchemaVersion;
  if (typeof startingVersion !== "number") {
    throw new Error("Snapshot manifest is missing numeric appSchemaVersion.");
  }
  if (startingVersion > currentAppSchemaVersion) {
    throw new Error(
      `Snapshot appSchemaVersion ${startingVersion} is newer than supported version ${currentAppSchemaVersion}.`
    );
  }

  let working = {
    dir: snapshot.dir,
    manifest: structuredClone(snapshot.manifest),
    documents: structuredClone(snapshot.documents),
  };
  const applied = [...(working.manifest.migrationsApplied ?? [])];

  while (working.manifest.appSchemaVersion < currentAppSchemaVersion) {
    const migration = migrations.find((item) => item.from === working.manifest.appSchemaVersion);
    if (!migration) {
      throw new Error(
        `No migration path from appSchemaVersion ${working.manifest.appSchemaVersion} to ${currentAppSchemaVersion}.`
      );
    }

    working = migration.migrate(working);
    working.documents = sortDocuments(working.documents);
    applied.push(migration.id);
    working.manifest = recalculateManifest(
      {
        ...working.manifest,
        appSchemaVersion: migration.to,
      },
      working.documents,
      applied
    );
  }

  if (applied.length > 0) {
    working.manifest.migrationSource = {
      appSchemaVersion: startingVersion,
      snapshotDir: snapshot.dir,
    };
  }

  return working;
}
