#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  applyImportPlan,
  assertNoExistingFirebaseApps,
  createImportPlan,
  enforceNonDestructiveMode,
  exportFirestoreProject,
  listSnapshots,
  withFirestoreTarget,
} from "./lib/firestore-backup.mjs";
import {
  DEFAULT_BACKUP_DIR,
  loadSnapshot,
  prepareSnapshotForImport,
} from "./lib/snapshot.mjs";

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

try {
  await loadLocalEnvFiles([".env.local"]);
  assertNoExistingFirebaseApps();
  await run(command, args);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function run(selectedCommand, options) {
  switch (selectedCommand) {
    case "export":
      await runExport(options);
      return;
    case "list":
      await runList(options);
      return;
    case "inspect":
      await runInspect(options);
      return;
    case "dry-run":
      await runDryRun(options);
      return;
    case "import":
      await runImport(options);
      return;
    case "validate-fixtures":
      await runValidateFixtures(options);
      return;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      return;
    default:
      throw new Error(`Unknown command "${selectedCommand}". Run with --help for usage.`);
  }
}

async function runExport(options) {
  const outputDir = path.resolve(options.out ?? DEFAULT_BACKUP_DIR);
  await fs.mkdir(outputDir, { recursive: true });

  await withFirestoreTarget(options, async (db, source) => {
    const result = await exportFirestoreProject(db, source, outputDir);
    console.log(`Created Firestore backup: ${result.snapshotDir}`);
    console.log(`Documents: ${result.manifest.documentCount}`);
    console.log(`Tenants: ${result.manifest.tenantIds.join(", ") || "(none)"}`);
    console.log(`Checksum: ${result.manifest.checksum.documents}`);
  });
}

async function runList(options) {
  const outputDir = path.resolve(options.out ?? DEFAULT_BACKUP_DIR);
  const snapshots = await listSnapshots(outputDir);
  if (snapshots.length === 0) {
    console.log(`No Firestore backups found in ${outputDir}`);
    return;
  }

  for (const snapshot of snapshots) {
    if (!snapshot.manifest) {
      console.log(`${snapshot.id}\t(unreadable manifest)\t${snapshot.dir}`);
      continue;
    }
    console.log(
      [
        snapshot.id,
        snapshot.manifest.source?.target ?? "unknown",
        snapshot.manifest.source?.projectId ?? "unknown",
        `${snapshot.manifest.documentCount ?? 0} docs`,
        snapshot.dir,
      ].join("\t")
    );
  }
}

async function runInspect(options) {
  const snapshotDir = resolveSnapshotArg(options);
  const snapshot = await loadSnapshot(snapshotDir);
  console.log(JSON.stringify(snapshot.manifest, null, 2));
}

async function runDryRun(options) {
  enforceNonDestructiveMode(options.mode);
  const snapshotDir = resolveSnapshotArg(options);
  const snapshot = prepareSnapshotForImport(await loadSnapshot(snapshotDir));

  await withFirestoreTarget(options, async (db, source) => {
    const plan = await createImportPlan(db, snapshot);
    printPlan({ plan, source, dryRun: true });
  });
}

async function runImport(options) {
  enforceNonDestructiveMode(options.mode);
  const snapshotDir = resolveSnapshotArg(options);
  const snapshot = prepareSnapshotForImport(await loadSnapshot(snapshotDir));

  await withFirestoreTarget(options, async (db, source) => {
    const plan = await createImportPlan(db, snapshot);
    printPlan({ plan, source, dryRun: false });
    const result = await applyImportPlan(db, plan);

    console.log("Import result:");
    console.log(JSON.stringify(result, null, 2));

    if (result.failures.length > 0) {
      throw new Error(`Import completed with ${result.failures.length} failed document write(s).`);
    }
  });
}

async function runValidateFixtures(options) {
  const fixturesDir = path.resolve(options.fixtures ?? "scripts/data-backup/fixtures");
  const entries = await fs.readdir(fixturesDir, { withFileTypes: true });
  let validated = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fixtureDir = path.join(fixturesDir, entry.name);
    const beforeManifest = await fs.readFile(path.join(fixtureDir, "manifest.json"), "utf8");
    const beforeDocuments = await fs.readFile(path.join(fixtureDir, "documents.json"), "utf8");
    const snapshot = await loadSnapshot(fixtureDir);
    const prepared = prepareSnapshotForImport(snapshot);

    if (entry.name === "schema-v0-customers") {
      const hasMigratedClient = prepared.documents.some(
        (document) => document.path === "tenants/fixture-tenant/clients/fixture-client"
      );
      const hasLegacyCustomer = prepared.documents.some((document) =>
        document.path.includes("/customers/")
      );
      if (!hasMigratedClient || hasLegacyCustomer) {
        throw new Error("schema-v0-customers fixture did not migrate customers to clients.");
      }
    }

    const afterManifest = await fs.readFile(path.join(fixtureDir, "manifest.json"), "utf8");
    const afterDocuments = await fs.readFile(path.join(fixtureDir, "documents.json"), "utf8");
    if (beforeManifest !== afterManifest || beforeDocuments !== afterDocuments) {
      throw new Error(`Fixture was mutated during validation: ${fixtureDir}`);
    }

    console.log(
      `${entry.name}: ok (${snapshot.manifest.appSchemaVersion} -> ${prepared.manifest.appSchemaVersion}; migrations: ${prepared.manifest.migrationsApplied.join(", ") || "none"})`
    );
    validated += 1;
  }

  if (validated === 0) {
    throw new Error(`No fixture directories found in ${fixturesDir}.`);
  }

  console.log(`Validated ${validated} fixture snapshot(s).`);
}

function printPlan({ plan, source, dryRun }) {
  console.log(dryRun ? "Import dry-run:" : "Import plan:");
  console.log(
    JSON.stringify(
      {
        target: source,
        snapshot: {
          dir: plan.snapshot.dir,
          appSchemaVersion: plan.snapshot.manifest.appSchemaVersion,
          backupFormatVersion: plan.snapshot.manifest.backupFormatVersion,
          migrationsApplied: plan.snapshot.manifest.migrationsApplied,
          tenantIds: plan.snapshot.manifest.tenantIds,
          documentCount: plan.snapshot.manifest.documentCount,
        },
        summary: plan.summary,
        destructiveOperationsPlanned: false,
      },
      null,
      2
    )
  );
}

function parseArgs(rawArgs) {
  const options = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) {
      if (!options._) {
        options._ = [];
      }
      options._.push(arg);
      continue;
    }

    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      options[toCamelCase(key)] = inlineValue;
      continue;
    }

    const next = rawArgs[index + 1];
    if (next && !next.startsWith("--")) {
      options[toCamelCase(key)] = next;
      index += 1;
    } else {
      options[toCamelCase(key)] = true;
    }
  }
  return options;
}

function resolveSnapshotArg(options) {
  const snapshot = options.snapshot ?? options._?.[0];
  if (!snapshot) {
    throw new Error("A snapshot directory is required. Pass --snapshot <path>.");
  }
  return snapshot;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

async function loadLocalEnvFiles(files) {
  for (const file of files) {
    let contents;
    try {
      contents = await fs.readFile(path.resolve(file), "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) {
        continue;
      }
      process.env[match[1]] = parseEnvValue(match[2]);
    }
  }
}

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function printHelp() {
  console.log(`Firestore backup/import tooling

Commands:
  export              Export Firestore to a timestamped snapshot.
  list                List local snapshots.
  inspect             Print a snapshot manifest.
  dry-run             Validate and plan a non-destructive import.
  import              Apply a non-destructive import.
  validate-fixtures   Validate safe migration fixtures.

Common options:
  --target emulator|live             Default: emulator.
  --project-id <id>                  Firebase project id. Emulator defaults to demo-project.
  --confirm-project <id>             Required for live export/import/dry-run.
  --host <host:port>                 Emulator host. Default: 127.0.0.1:8080.
  --out <dir>                        Snapshot root. Default: backups/firestore.
  --snapshot <dir>                   Snapshot directory for inspect/dry-run/import.
  --mode merge                       Only supported import mode for CMA-002.

Examples:
  npm run backup:firestore:export -- --target emulator
  npm run backup:firestore:dry-run -- --snapshot backups/firestore/<snapshot> --target emulator
  npm run backup:firestore:import -- --snapshot backups/firestore/<snapshot> --target emulator
`);
}
