import { FieldValue } from "firebase-admin/firestore";
import type { WithFieldValue } from "firebase-admin/firestore";

import {
  createExpenseExportStoragePath,
  createExpenseStoragePath,
  validateExpenseUpload,
  validateGeneratedExpenseExport,
} from "@/lib/expenses/files";
import {
  expenseExportRef,
  expenseRef,
  expenseSourceFileRef,
  tenantExpenseCollectionRefs,
} from "@/lib/expenses/firestore";
import { adminDb, adminStorage } from "@/lib/firebase-admin";
import type {
  Expense,
  ExpenseExport,
  ExpenseExportTotals,
  ExpenseSourceFile,
  ExpenseStoredFilePurpose,
} from "@/types/expense";

export interface StoredExpenseFileResult {
  id: string;
  purpose: ExpenseStoredFilePurpose;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  sourceFormat?: ExpenseSourceFile["sourceFormat"];
  sourceAccountKey?: string;
  sourceAccountLabel?: string;
  linkedExpenseId?: string;
}

export async function storeExpenseFile(input: {
  tenantId: string;
  userId: string;
  bytes: Uint8Array;
  originalFileName: string;
  declaredMimeType?: string;
  purpose: ExpenseStoredFilePurpose;
  sourceAccountKey?: string;
  sourceAccountLabel?: string;
  linkedExpenseId?: string;
}): Promise<StoredExpenseFileResult> {
  if (input.purpose === "receipt" && !input.linkedExpenseId) {
    throw new Error("Receipt uploads require a confirmed expense");
  }
  if (
    input.purpose === "source" &&
    (!input.sourceAccountKey || !input.sourceAccountLabel)
  ) {
    throw new Error("Source account ID and label are required");
  }
  const validated = validateExpenseUpload(input);
  const metadataRef = tenantExpenseCollectionRefs(input.tenantId).sourceFiles.doc();
  const storagePath = createExpenseStoragePath({
    tenantId: input.tenantId,
    fileId: metadataRef.id,
    purpose: input.purpose,
    extension: validated.extension,
  });
  const object = expenseStorageBucket().file(storagePath);
  await object.save(Buffer.from(input.bytes), {
    resumable: false,
    validation: "crc32c",
    metadata: {
      contentType: validated.mimeType,
      cacheControl: "private, no-store, max-age=0",
      contentDisposition: "attachment",
      metadata: {
        tenantId: input.tenantId,
        fileId: metadataRef.id,
        purpose: input.purpose,
        checksumSha256: validated.checksumSha256,
      },
    },
  });

  try {
    await adminDb.runTransaction(async (transaction) => {
      let linkedExpense: Expense | undefined;
      if (input.linkedExpenseId) {
        const linkedRef = expenseRef(input.tenantId, input.linkedExpenseId);
        const linkedSnapshot = await transaction.get(linkedRef);
        if (!linkedSnapshot.exists) {
          throw new Error("Confirmed expense not found");
        }
        linkedExpense = linkedSnapshot.data();
        if (input.purpose !== "receipt") {
          throw new Error("Only receipt files can link to an expense");
        }
      }

      const timestamp = FieldValue.serverTimestamp();
      transaction.set(
        metadataRef,
        omitUndefined({
          id: metadataRef.id,
          tenantId: input.tenantId,
          purpose: input.purpose,
          originalFileName: validated.originalFileName,
          storagePath,
          mimeType: validated.mimeType,
          sizeBytes: validated.sizeBytes,
          checksumSha256: validated.checksumSha256,
          sourceFormat: validated.sourceFormat,
          sourceAccountKey: input.sourceAccountKey,
          sourceAccountLabel: input.sourceAccountLabel,
          linkedExpenseId: input.linkedExpenseId,
          retentionStatus: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: input.userId,
          updatedBy: input.userId,
        }) as WithFieldValue<ExpenseSourceFile>,
      );
      if (input.linkedExpenseId) {
        const linkedRef = expenseRef(input.tenantId, input.linkedExpenseId);
        transaction.update(linkedRef, {
          receiptFileId: metadataRef.id,
          taxInvoiceStatus: "attached",
          updatedAt: timestamp,
          updatedBy: input.userId,
        });
        if (
          linkedExpense?.receiptFileId &&
          linkedExpense.receiptFileId !== metadataRef.id
        ) {
          transaction.set(
            expenseSourceFileRef(
              input.tenantId,
              linkedExpense.receiptFileId,
            ),
            {
              linkedExpenseId: FieldValue.delete(),
              updatedAt: timestamp,
              updatedBy: input.userId,
            },
            { merge: true },
          );
        }
      }
    });
  } catch (error) {
    await object.delete({ ignoreNotFound: true });
    throw error;
  }

  return {
    id: metadataRef.id,
    purpose: input.purpose,
    originalFileName: validated.originalFileName,
    mimeType: validated.mimeType,
    sizeBytes: validated.sizeBytes,
    checksumSha256: validated.checksumSha256,
    sourceFormat: validated.sourceFormat,
    sourceAccountKey: input.sourceAccountKey,
    sourceAccountLabel: input.sourceAccountLabel,
    linkedExpenseId: input.linkedExpenseId,
  };
}

export async function readExpenseFile(input: {
  tenantId: string;
  fileId: string;
}): Promise<{
  bytes: Buffer;
  originalFileName: string;
  mimeType: string;
}> {
  const snapshot = await expenseSourceFileRef(
    input.tenantId,
    input.fileId,
  ).get();
  if (!snapshot.exists) {
    throw new Error("Expense file not found");
  }
  const metadata = snapshot.data() as ExpenseSourceFile;
  if (
    metadata.retentionStatus === "deleted" ||
    !metadata.storagePath ||
    !isTenantExpensePath(input.tenantId, metadata.storagePath)
  ) {
    throw new Error("Expense file is no longer available");
  }
  const [bytes] = await expenseStorageBucket()
    .file(metadata.storagePath)
    .download();
  return {
    bytes,
    originalFileName: metadata.originalFileName,
    mimeType: metadata.mimeType || "application/octet-stream",
  };
}

export async function deleteExpenseFile(input: {
  tenantId: string;
  userId: string;
  fileId: string;
}): Promise<void> {
  const metadataRef = expenseSourceFileRef(input.tenantId, input.fileId);
  const snapshot = await metadataRef.get();
  if (!snapshot.exists) {
    throw new Error("Expense file not found");
  }
  const metadata = snapshot.data() as ExpenseSourceFile;
  if (
    metadata.storagePath &&
    !isTenantExpensePath(input.tenantId, metadata.storagePath)
  ) {
    throw new Error("Expense file path is invalid");
  }
  if (metadata.storagePath) {
    await expenseStorageBucket()
      .file(metadata.storagePath)
      .delete({ ignoreNotFound: true });
  }
  await adminDb.runTransaction(async (transaction) => {
    const fresh = await transaction.get(metadataRef);
    const current = fresh.data() as ExpenseSourceFile | undefined;
    const timestamp = FieldValue.serverTimestamp();
    if (current?.linkedExpenseId) {
      const linkedRef = expenseRef(input.tenantId, current.linkedExpenseId);
      const expenseSnapshot = await transaction.get(linkedRef);
      if (
        expenseSnapshot.exists &&
        expenseSnapshot.get("receiptFileId") === input.fileId
      ) {
        transaction.update(linkedRef, {
          receiptFileId: FieldValue.delete(),
          taxInvoiceStatus: "missing",
          updatedAt: timestamp,
          updatedBy: input.userId,
        });
      }
    }
    transaction.set(
      metadataRef,
      {
        storagePath: FieldValue.delete(),
        linkedExpenseId: FieldValue.delete(),
        retentionStatus: "deleted",
        deletedAt: timestamp,
        deletedBy: input.userId,
        updatedAt: timestamp,
        updatedBy: input.userId,
      },
      { merge: true },
    );
  });
}

export async function storeGeneratedExpenseExport(input: {
  tenantId: string;
  userId: string;
  bytes: Uint8Array;
  fileName: string;
  periodStartDate: string;
  periodEndDate: string;
  totals: ExpenseExportTotals;
}): Promise<string> {
  const validated = validateGeneratedExpenseExport(input.bytes);
  const exportRef = tenantExpenseCollectionRefs(input.tenantId).exports.doc();
  const storagePath = createExpenseExportStoragePath({
    tenantId: input.tenantId,
    exportId: exportRef.id,
  });
  const object = expenseStorageBucket().file(storagePath);
  await object.save(Buffer.from(input.bytes), {
    resumable: false,
    validation: "crc32c",
    metadata: {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      cacheControl: "private, no-store, max-age=0",
      contentDisposition: "attachment",
      metadata: {
        tenantId: input.tenantId,
        exportId: exportRef.id,
        checksumSha256: validated.checksumSha256,
      },
    },
  });
  try {
    const timestamp = FieldValue.serverTimestamp();
    await exportRef.set({
      id: exportRef.id,
      tenantId: input.tenantId,
      exportType: "accountant_workbook",
      status: "ready",
      periodStartDate: input.periodStartDate,
      periodEndDate: input.periodEndDate,
      storagePath,
      fileName: input.fileName,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: validated.sizeBytes,
      checksumSha256: validated.checksumSha256,
      retentionStatus: "active",
      totals: input.totals,
      generatedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: input.userId,
      updatedBy: input.userId,
    });
  } catch (error) {
    await object.delete({ ignoreNotFound: true });
    throw error;
  }
  return exportRef.id;
}

export async function readGeneratedExpenseExport(input: {
  tenantId: string;
  exportId: string;
}): Promise<{ bytes: Buffer; fileName: string; mimeType: string }> {
  const snapshot = await expenseExportRef(
    input.tenantId,
    input.exportId,
  ).get();
  if (!snapshot.exists) {
    throw new Error("Expense export not found");
  }
  const metadata = snapshot.data() as ExpenseExport;
  if (
    metadata.status === "deleted" ||
    !metadata.storagePath ||
    !isTenantExpensePath(input.tenantId, metadata.storagePath)
  ) {
    throw new Error("Expense export is no longer available");
  }
  const [bytes] = await expenseStorageBucket()
    .file(metadata.storagePath)
    .download();
  return {
    bytes,
    fileName: metadata.fileName || "accountant-export.xlsx",
    mimeType:
      metadata.mimeType ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

export async function deleteGeneratedExpenseExport(input: {
  tenantId: string;
  userId: string;
  exportId: string;
}): Promise<void> {
  const exportRef = expenseExportRef(input.tenantId, input.exportId);
  const snapshot = await exportRef.get();
  if (!snapshot.exists) {
    throw new Error("Expense export not found");
  }
  const metadata = snapshot.data() as ExpenseExport;
  if (
    metadata.storagePath &&
    !isTenantExpensePath(input.tenantId, metadata.storagePath)
  ) {
    throw new Error("Expense export path is invalid");
  }
  if (metadata.storagePath) {
    await expenseStorageBucket()
      .file(metadata.storagePath)
      .delete({ ignoreNotFound: true });
  }
  const timestamp = FieldValue.serverTimestamp();
  await exportRef.set(
    {
      status: "deleted",
      retentionStatus: "deleted",
      storagePath: FieldValue.delete(),
      deletedAt: timestamp,
      deletedBy: input.userId,
      updatedAt: timestamp,
      updatedBy: input.userId,
    },
    { merge: true },
  );
}

function isTenantExpensePath(tenantId: string, path: string): boolean {
  return path.startsWith(`tenants/${tenantId}/expenses/`);
}

function expenseStorageBucket() {
  const bucketName =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebasestorage.app`
      : "");
  if (!bucketName) {
    throw new Error("Firebase Storage bucket is not configured");
  }
  return adminStorage.bucket(bucketName);
}

function omitUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}
