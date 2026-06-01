import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GeoPoint, Timestamp } from "firebase-admin/firestore";
import { migrateSnapshotToCurrent } from "../migrations/index.mjs";

export const BACKUP_FORMAT_VERSION = 1;
export const APP_SCHEMA_VERSION = 1;
export const DEFAULT_BACKUP_DIR = "backups/firestore";
const TYPE_KEY = "__firestoreBackupType";

export function stableStringify(value) {
  return JSON.stringify(sortForJson(value));
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function documentsChecksum(documents) {
  return sha256(stableStringify(sortDocuments(documents)));
}

export function sortDocuments(documents) {
  return [...documents].sort((a, b) => a.path.localeCompare(b.path));
}

export function createManifest({ source, documents, createdAt = new Date().toISOString() }) {
  const sortedDocuments = sortDocuments(documents);
  const manifest = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    appSchemaVersion: APP_SCHEMA_VERSION,
    createdAt,
    source,
    documentCount: sortedDocuments.length,
    tenantIds: tenantIdsFromDocuments(sortedDocuments),
    collectionCounts: collectionCountsFromDocuments(sortedDocuments),
    checksum: {
      algorithm: "sha256",
      documents: documentsChecksum(sortedDocuments),
    },
    migrationsApplied: [],
  };

  return manifest;
}

export function encodeFirestoreValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return {
      [TYPE_KEY]: "timestamp",
      seconds: Math.floor(value.getTime() / 1000),
      nanoseconds: (value.getTime() % 1000) * 1000000,
      iso: value.toISOString(),
    };
  }

  if (typeof value.toDate === "function" && typeof value.toMillis === "function") {
    const seconds = typeof value.seconds === "number" ? value.seconds : value._seconds;
    const nanoseconds =
      typeof value.nanoseconds === "number" ? value.nanoseconds : value._nanoseconds;
    return {
      [TYPE_KEY]: "timestamp",
      seconds,
      nanoseconds,
      iso: value.toDate().toISOString(),
    };
  }

  if (value.constructor?.name === "GeoPoint") {
    return {
      [TYPE_KEY]: "geopoint",
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (value.constructor?.name === "DocumentReference" && typeof value.path === "string") {
    return {
      [TYPE_KEY]: "documentReference",
      path: value.path,
    };
  }

  if (Buffer.isBuffer(value) || value.constructor?.name === "Bytes") {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value.toUint8Array());
    return {
      [TYPE_KEY]: "bytes",
      base64: bytes.toString("base64"),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => encodeFirestoreValue(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, encodeFirestoreValue(entry)])
  );
}

export function decodeFirestoreValue(value, db) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => decodeFirestoreValue(item, db));
  }

  if (value[TYPE_KEY] === "timestamp") {
    return new Timestamp(value.seconds, value.nanoseconds ?? 0);
  }

  if (value[TYPE_KEY] === "geopoint") {
    return new GeoPoint(value.latitude, value.longitude);
  }

  if (value[TYPE_KEY] === "documentReference") {
    return db.doc(value.path);
  }

  if (value[TYPE_KEY] === "bytes") {
    return Buffer.from(value.base64, "base64");
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, decodeFirestoreValue(entry, db)])
  );
}

export async function writeSnapshot({ outputDir, snapshotId, manifest, documents }) {
  const snapshotDir = path.resolve(outputDir, snapshotId);
  await fs.mkdir(snapshotDir, { recursive: false });

  const sortedDocuments = sortDocuments(documents);
  await fs.writeFile(
    path.join(snapshotDir, "documents.json"),
    `${JSON.stringify(sortedDocuments, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(snapshotDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  return snapshotDir;
}

export async function loadSnapshot(snapshotDir) {
  const resolvedDir = path.resolve(snapshotDir);
  const [manifestRaw, documentsRaw] = await Promise.all([
    fs.readFile(path.join(resolvedDir, "manifest.json"), "utf8"),
    fs.readFile(path.join(resolvedDir, "documents.json"), "utf8"),
  ]);

  const snapshot = {
    dir: resolvedDir,
    manifest: JSON.parse(manifestRaw),
    documents: JSON.parse(documentsRaw),
  };

  validateStoredSnapshot(snapshot);
  return snapshot;
}

export function prepareSnapshotForImport(snapshot) {
  const migrated = migrateSnapshotToCurrent(snapshot, {
    currentAppSchemaVersion: APP_SCHEMA_VERSION,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
  });

  validateCurrentSnapshot(migrated);
  return migrated;
}

export function validateStoredSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Snapshot could not be loaded.");
  }
  if (!snapshot.manifest || typeof snapshot.manifest !== "object") {
    throw new Error("Snapshot is missing manifest.json.");
  }
  if (!Array.isArray(snapshot.documents)) {
    throw new Error("Snapshot documents.json must contain an array.");
  }
  if (snapshot.manifest.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Unsupported backupFormatVersion ${String(snapshot.manifest.backupFormatVersion)}.`
    );
  }
  if (typeof snapshot.manifest.appSchemaVersion !== "number") {
    throw new Error("Snapshot manifest is missing numeric appSchemaVersion.");
  }

  validateDocumentList(snapshot.documents);

  const expectedChecksum = snapshot.manifest.checksum?.documents;
  if (expectedChecksum) {
    const actualChecksum = documentsChecksum(snapshot.documents);
    if (actualChecksum !== expectedChecksum) {
      throw new Error(
        `Snapshot checksum mismatch. Expected ${expectedChecksum}, got ${actualChecksum}.`
      );
    }
  }
}

export function validateCurrentSnapshot(snapshot) {
  validateStoredSnapshot(snapshot);

  if (snapshot.manifest.appSchemaVersion !== APP_SCHEMA_VERSION) {
    throw new Error(
      `Snapshot appSchemaVersion ${snapshot.manifest.appSchemaVersion} was not migrated to ${APP_SCHEMA_VERSION}.`
    );
  }
}

export function validateDocumentList(documents) {
  const seen = new Set();
  for (const document of documents) {
    if (!document || typeof document !== "object") {
      throw new Error("Snapshot document entries must be objects.");
    }
    if (!isValidDocumentPath(document.path)) {
      throw new Error(`Invalid Firestore document path in snapshot: ${String(document.path)}`);
    }
    if (seen.has(document.path)) {
      throw new Error(`Duplicate Firestore document path in snapshot: ${document.path}`);
    }
    seen.add(document.path);
    if (!document.data || typeof document.data !== "object" || Array.isArray(document.data)) {
      throw new Error(`Snapshot document data must be an object: ${document.path}`);
    }
  }
}

export function recalculateManifest(manifest, documents, migrationsApplied) {
  const sortedDocuments = sortDocuments(documents);
  return {
    ...manifest,
    appSchemaVersion: APP_SCHEMA_VERSION,
    documentCount: sortedDocuments.length,
    tenantIds: tenantIdsFromDocuments(sortedDocuments),
    collectionCounts: collectionCountsFromDocuments(sortedDocuments),
    checksum: {
      algorithm: "sha256",
      documents: documentsChecksum(sortedDocuments),
    },
    migrationsApplied,
  };
}

export function tenantIdsFromDocuments(documents) {
  const tenantIds = new Set();
  for (const document of documents) {
    const segments = document.path.split("/");
    if (segments[0] === "tenants" && segments[1]) {
      tenantIds.add(segments[1]);
    }
  }
  return [...tenantIds].sort();
}

export function collectionCountsFromDocuments(documents) {
  const counts = {};
  for (const document of documents) {
    const collectionPath = collectionPathFromDocumentPath(document.path);
    counts[collectionPath] = (counts[collectionPath] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function collectionPathFromDocumentPath(documentPath) {
  const segments = documentPath.split("/");
  return segments.slice(0, -1).join("/");
}

export function isValidDocumentPath(documentPath) {
  if (typeof documentPath !== "string" || documentPath.trim() !== documentPath) {
    return false;
  }
  const segments = documentPath.split("/");
  return segments.length >= 2 && segments.length % 2 === 0 && segments.every(Boolean);
}

export function createSnapshotId({ now = new Date(), target, projectId }) {
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const safeProjectId = projectId.replace(/[^A-Za-z0-9_-]+/g, "-");
  return `${timestamp}-${target}-${safeProjectId}`;
}

function sortForJson(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortForJson(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortForJson(entry)])
    );
  }
  return value;
}
