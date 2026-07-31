"use server";

import {
  assertExpenseTenantAccess,
  tenantExpenseCollectionRefs,
} from "@/lib/expenses/firestore";
import type {
  ExpenseExport,
  ExpenseRetentionStatus,
  ExpenseSourceFile,
  ExpenseSourceFormat,
  ExpenseStoredFilePurpose,
  FirestoreTimestampLike,
} from "@/types/expense";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ExpenseFileRow {
  id: string;
  purpose: ExpenseStoredFilePurpose;
  originalFileName: string;
  mimeType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  sourceFormat?: ExpenseSourceFormat;
  sourceAccountKey?: string;
  sourceAccountLabel?: string;
  linkedExpenseId?: string;
  retentionStatus: ExpenseRetentionStatus;
  createdAt?: string;
  deletedAt?: string;
}

export interface ExpenseExportFileRow {
  id: string;
  fileName: string;
  periodStartDate?: string;
  periodEndDate?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  retentionStatus: ExpenseRetentionStatus;
  createdAt?: string;
  deletedAt?: string;
}

export interface ExpenseFilesContext {
  files: ExpenseFileRow[];
  exports: ExpenseExportFileRow[];
}

export async function getExpenseFilesContext(
  tenantId: string,
  idToken: string,
): Promise<ActionResult<ExpenseFilesContext>> {
  try {
    await assertExpenseTenantAccess(tenantId, idToken);
    const refs = tenantExpenseCollectionRefs(tenantId);
    const [fileSnapshot, exportSnapshot] = await Promise.all([
      refs.sourceFiles.orderBy("createdAt", "desc").get(),
      refs.exports.orderBy("createdAt", "desc").get(),
    ]);

    return {
      success: true,
      data: {
        files: fileSnapshot.docs.map((doc) => {
          const file = { ...doc.data(), id: doc.id } as ExpenseSourceFile;
          return {
            id: file.id,
            purpose: file.purpose,
            originalFileName: file.originalFileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            checksumSha256: file.checksumSha256,
            sourceFormat: file.sourceFormat,
            sourceAccountKey: file.sourceAccountKey,
            sourceAccountLabel: file.sourceAccountLabel,
            linkedExpenseId: file.linkedExpenseId,
            retentionStatus: file.retentionStatus,
            createdAt: serializeTimestamp(file.createdAt),
            deletedAt: serializeTimestamp(file.deletedAt),
          };
        }),
        exports: exportSnapshot.docs.map((doc) => {
          const record = { ...doc.data(), id: doc.id } as ExpenseExport;
          return {
            id: record.id,
            fileName: record.fileName || "accountant-export.xlsx",
            periodStartDate: record.periodStartDate,
            periodEndDate: record.periodEndDate,
            sizeBytes: record.sizeBytes,
            checksumSha256: record.checksumSha256,
            retentionStatus:
              record.retentionStatus ||
              (record.status === "deleted" ? "deleted" : "active"),
            createdAt: serializeTimestamp(record.createdAt),
            deletedAt: serializeTimestamp(record.deletedAt),
          };
        }),
      },
    };
  } catch (error) {
    console.error("Error loading expense files:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load expense files",
    };
  }
}

function serializeTimestamp(
  value: FirestoreTimestampLike | undefined,
): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if ("toDate" in value) return value.toDate().toISOString();
  return new Date(
    value.seconds * 1000 + value.nanoseconds / 1_000_000,
  ).toISOString();
}
