import fs from "node:fs/promises";
import path from "node:path";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  createManifest,
  createSnapshotId,
  decodeFirestoreValue,
  encodeFirestoreValue,
  prepareSnapshotForImport,
  sortDocuments,
  stableStringify,
  writeSnapshot,
} from "./snapshot.mjs";

export async function withFirestoreTarget(options, callback) {
  const target = options.target ?? "emulator";
  const projectId = resolveProjectId(options, target);
  enforceLiveConfirmation({ target, projectId, confirmProject: options.confirmProject });
  const emulatorHost =
    options.host ?? process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";

  if (target === "emulator") {
    process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
    process.env.GCLOUD_PROJECT = projectId;
  }

  const appName = `data-backup-${target}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const app =
    target === "emulator"
      ? initializeApp({ projectId }, appName)
      : initializeApp(
          {
            credential: cert(resolveServiceAccount(projectId)),
            projectId,
          },
          appName
        );

  try {
    const db = getFirestore(app);
    if (target === "emulator") {
      db.settings({ host: emulatorHost, ssl: false });
    }
    return await callback(db, { target, projectId, host: emulatorHost });
  } finally {
    await deleteApp(app);
  }
}

export async function exportFirestoreProject(db, source, outputDir) {
  const documents = [];
  const rootCollections = await db.listCollections();

  for (const collection of rootCollections.sort((a, b) => a.path.localeCompare(b.path))) {
    await collectCollectionDocuments(collection, documents);
  }

  const sortedDocuments = sortDocuments(documents);
  const createdAt = new Date().toISOString();
  const manifest = createManifest({ source, documents: sortedDocuments, createdAt });
  const snapshotId = createSnapshotId({ target: source.target, projectId: source.projectId });
  const snapshotDir = await writeSnapshot({
    outputDir,
    snapshotId,
    manifest,
    documents: sortedDocuments,
  });

  return {
    snapshotDir,
    manifest,
  };
}

export async function createImportPlan(db, snapshot) {
  const migratedSnapshot = prepareSnapshotForImport(snapshot);
  const actions = [];
  const summary = {
    create: 0,
    update: 0,
    skip: 0,
    total: migratedSnapshot.documents.length,
  };

  for (const document of migratedSnapshot.documents) {
    const ref = db.doc(document.path);
    const existing = await ref.get();
    if (!existing.exists) {
      actions.push({ type: "create", path: document.path, document });
      summary.create += 1;
      continue;
    }

    const existingEncoded = encodeFirestoreValue(existing.data() ?? {});
    if (stableStringify(existingEncoded) === stableStringify(document.data)) {
      actions.push({ type: "skip", path: document.path, document });
      summary.skip += 1;
      continue;
    }

    actions.push({ type: "update", path: document.path, document });
    summary.update += 1;
  }

  return {
    snapshot: migratedSnapshot,
    actions,
    summary,
  };
}

export async function applyImportPlan(db, plan) {
  const failures = [];
  const applied = {
    create: 0,
    update: 0,
    skip: 0,
  };

  for (const action of plan.actions) {
    if (action.type === "skip") {
      applied.skip += 1;
      continue;
    }

    try {
      await db.doc(action.path).set(decodeFirestoreValue(action.document.data, db), { merge: true });
      applied[action.type] += 1;
    } catch (error) {
      failures.push({
        path: action.path,
        action: action.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { applied, failures };
}

export async function listSnapshots(outputDir) {
  try {
    const entries = await fs.readdir(outputDir, { withFileTypes: true });
    const snapshots = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const snapshotDir = path.join(outputDir, entry.name);
      try {
        const manifest = JSON.parse(
          await fs.readFile(path.join(snapshotDir, "manifest.json"), "utf8")
        );
        snapshots.push({ id: entry.name, dir: snapshotDir, manifest });
      } catch {
        snapshots.push({ id: entry.name, dir: snapshotDir, manifest: null });
      }
    }
    return snapshots.sort((a, b) => a.id.localeCompare(b.id));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function enforceNonDestructiveMode(mode) {
  if (!mode || mode === "merge") {
    return;
  }
  throw new Error(
    `Unsupported import mode "${mode}". CMA-002 only supports non-destructive merge imports.`
  );
}

export function enforceLiveConfirmation({ target, projectId, confirmProject }) {
  if (target !== "live") {
    return;
  }
  if (confirmProject !== projectId) {
    throw new Error(
      `Live Firebase operations require --confirm-project ${projectId}. Refusing to continue.`
    );
  }
}

async function collectCollectionDocuments(collectionRef, documents) {
  const snapshot = await collectionRef.get();

  for (const document of snapshot.docs.sort((a, b) => a.ref.path.localeCompare(b.ref.path))) {
    documents.push({
      path: document.ref.path,
      data: encodeFirestoreValue(document.data()),
    });

    const subcollections = await document.ref.listCollections();
    for (const subcollection of subcollections.sort((a, b) => a.path.localeCompare(b.path))) {
      await collectCollectionDocuments(subcollection, documents);
    }
  }
}

function resolveProjectId(options, target) {
  if (options.projectId) {
    return options.projectId;
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  }
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  return target === "emulator" ? "demo-project" : "";
}

function resolveServiceAccount(projectId) {
  if (!projectId) {
    throw new Error("Live Firebase target requires --project-id or FIREBASE_PROJECT_ID.");
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }

  if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    return {
      projectId,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  throw new Error(
    "Live Firebase target requires FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_ADMIN_CLIENT_EMAIL/FIREBASE_ADMIN_PRIVATE_KEY."
  );
}

export function assertNoExistingFirebaseApps() {
  if (getApps().length > 0) {
    throw new Error("Data backup tooling expected to own Firebase Admin app initialization.");
  }
}
