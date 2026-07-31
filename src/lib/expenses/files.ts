import { createHash } from "node:crypto";

import type {
  ExpenseSourceFormat,
  ExpenseStoredFilePurpose,
} from "@/types/expense";

const MIB = 1024 * 1024;
export const EXPENSE_SOURCE_TEXT_MAX_BYTES = 5 * MIB;
export const EXPENSE_SOURCE_PDF_MAX_BYTES = 15 * MIB;
export const EXPENSE_RECEIPT_MAX_BYTES = 10 * MIB;
export const EXPENSE_EXPORT_MAX_BYTES = 25 * MIB;

export interface ValidatedExpenseUpload {
  originalFileName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  sourceFormat?: ExpenseSourceFormat;
}

export function validateExpenseUpload(input: {
  bytes: Uint8Array;
  originalFileName: string;
  declaredMimeType?: string;
  purpose: ExpenseStoredFilePurpose;
}): ValidatedExpenseUpload {
  const bytes = Buffer.from(input.bytes);
  const originalFileName = sanitizeExpenseFileName(input.originalFileName);
  const extension = fileExtension(originalFileName);
  if (bytes.length === 0) {
    throw new Error("Uploaded file is empty");
  }

  const result =
    input.purpose === "source"
      ? validateSource(bytes, extension, input.declaredMimeType)
      : validateReceipt(bytes, extension, input.declaredMimeType);

  return {
    originalFileName,
    ...result,
    sizeBytes: bytes.length,
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export function createExpenseStoragePath(input: {
  tenantId: string;
  fileId: string;
  purpose: ExpenseStoredFilePurpose;
  extension: string;
}): string {
  assertPathSegment("tenantId", input.tenantId);
  assertPathSegment("fileId", input.fileId);
  if (!/^[a-z0-9]{2,5}$/.test(input.extension)) {
    throw new Error("File extension is invalid");
  }
  const folder = input.purpose === "source" ? "sources" : "receipts";
  return `tenants/${input.tenantId}/expenses/${folder}/${input.fileId}/original.${input.extension}`;
}

export function createExpenseExportStoragePath(input: {
  tenantId: string;
  exportId: string;
}): string {
  assertPathSegment("tenantId", input.tenantId);
  assertPathSegment("exportId", input.exportId);
  return `tenants/${input.tenantId}/expenses/exports/${input.exportId}/accountant-export.xlsx`;
}

export function normalizeSourceAccountKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(normalized)) {
    throw new Error(
      "Source account ID must use 2-64 lowercase letters, numbers, hyphens, or underscores",
    );
  }
  return normalized;
}

export function normalizeSourceAccountLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 120) {
    throw new Error("Source account label must contain 1-120 characters");
  }
  return normalized;
}

export function sanitizeExpenseFileName(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("Original filename is invalid");
  }
  return normalized.slice(0, 180);
}

export function validateGeneratedExpenseExport(bytes: Uint8Array): {
  sizeBytes: number;
  checksumSha256: string;
} {
  const buffer = Buffer.from(bytes);
  if (buffer.length === 0 || buffer.length > EXPENSE_EXPORT_MAX_BYTES) {
    throw new Error("Generated export exceeds the 25 MiB limit");
  }
  if (buffer.subarray(0, 2).toString("ascii") !== "PK") {
    throw new Error("Generated export is not a valid XLSX container");
  }
  return {
    sizeBytes: buffer.length,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

function validateSource(
  bytes: Buffer,
  extension: string,
  declaredMimeType?: string,
): Pick<
  ValidatedExpenseUpload,
  "extension" | "mimeType" | "sourceFormat"
> {
  if (extension === "pdf") {
    assertSize(bytes, EXPENSE_SOURCE_PDF_MAX_BYTES, "Source PDF");
    assertDeclaredMime(declaredMimeType, ["application/pdf"]);
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("PDF signature does not match the file extension");
    }
    return {
      extension: "pdf",
      mimeType: "application/pdf",
      sourceFormat: "pdf",
    };
  }

  if (extension !== "csv" && extension !== "qif") {
    throw new Error("Source files must be CSV, QIF, or PDF");
  }
  assertSize(bytes, EXPENSE_SOURCE_TEXT_MAX_BYTES, "Source text file");
  if (bytes.includes(0)) {
    throw new Error("CSV/QIF source contains binary NUL bytes");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("CSV/QIF source must be valid UTF-8");
  }
  if (!text.trim()) {
    throw new Error("CSV/QIF source is empty");
  }

  if (extension === "csv") {
    assertDeclaredMime(declaredMimeType, [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "text/plain",
    ]);
    if (!text.split(/\r?\n/, 1)[0]?.includes(",")) {
      throw new Error("CSV source does not contain a comma-delimited header");
    }
    return {
      extension: "csv",
      mimeType: "text/csv; charset=utf-8",
      sourceFormat: "csv",
    };
  }

  assertDeclaredMime(declaredMimeType, [
    "application/qif",
    "application/x-qif",
    "application/octet-stream",
    "text/qif",
    "text/plain",
  ]);
  if (!text.replace(/^\uFEFF/, "").trimStart().startsWith("!Type:")) {
    throw new Error("QIF source must begin with a !Type header");
  }
  return {
    extension: "qif",
    mimeType: "application/qif; charset=utf-8",
    sourceFormat: "qif",
  };
}

function validateReceipt(
  bytes: Buffer,
  extension: string,
  declaredMimeType?: string,
): Pick<ValidatedExpenseUpload, "extension" | "mimeType"> {
  assertSize(bytes, EXPENSE_RECEIPT_MAX_BYTES, "Receipt");
  if (extension === "pdf") {
    assertDeclaredMime(declaredMimeType, ["application/pdf"]);
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error("Receipt PDF signature is invalid");
    }
    return { extension: "pdf", mimeType: "application/pdf" };
  }
  if (extension === "png") {
    assertDeclaredMime(declaredMimeType, ["image/png"]);
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    if (!bytes.subarray(0, 8).equals(pngSignature)) {
      throw new Error("Receipt PNG signature is invalid");
    }
    return { extension: "png", mimeType: "image/png" };
  }
  if (extension === "jpg" || extension === "jpeg") {
    assertDeclaredMime(declaredMimeType, ["image/jpeg"]);
    if (
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8 ||
      bytes.at(-2) !== 0xff ||
      bytes.at(-1) !== 0xd9
    ) {
      throw new Error("Receipt JPEG signature is invalid");
    }
    return { extension: "jpg", mimeType: "image/jpeg" };
  }
  throw new Error("Receipts must be PDF, JPEG, or PNG");
}

function assertSize(bytes: Buffer, max: number, label: string): void {
  if (bytes.length > max) {
    throw new Error(`${label} exceeds the ${Math.floor(max / MIB)} MiB limit`);
  }
}

function assertDeclaredMime(
  declared: string | undefined,
  allowed: string[],
): void {
  const normalized = declared?.split(";", 1)[0]?.trim().toLowerCase();
  if (normalized && !allowed.includes(normalized)) {
    throw new Error("Declared content type does not match the file extension");
  }
}

function fileExtension(fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() || "";
}

function assertPathSegment(name: string, value: string): void {
  if (!value || value.includes("/") || value.includes("\\")) {
    throw new Error(`${name} must be a safe path segment`);
  }
}
