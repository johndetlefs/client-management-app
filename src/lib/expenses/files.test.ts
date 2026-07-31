import assert from "node:assert/strict";
import test from "node:test";

import {
  createExpenseExportStoragePath,
  createExpenseStoragePath,
  normalizeSourceAccountKey,
  normalizeSourceAccountLabel,
  sanitizeExpenseFileName,
  validateExpenseUpload,
  validateGeneratedExpenseExport,
} from "./files";

test("validates CSV, QIF, PDF, and receipt signatures", () => {
  const csv = validateExpenseUpload({
    bytes: Buffer.from("Date,Description,Debit\n29/07/2026,Hosting,10.00\n"),
    originalFileName: "statement.csv",
    declaredMimeType: "text/csv",
    purpose: "source",
  });
  const qif = validateExpenseUpload({
    bytes: Buffer.from("!Type:Bank\nD29/07/2026\nT-10.00\nPHosting\n^\n"),
    originalFileName: "statement.qif",
    declaredMimeType: "application/octet-stream",
    purpose: "source",
  });
  const pdf = validateExpenseUpload({
    bytes: Buffer.from("%PDF-1.7\nsynthetic"),
    originalFileName: "statement.pdf",
    declaredMimeType: "application/pdf",
    purpose: "source",
  });
  const png = validateExpenseUpload({
    bytes: Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]),
    originalFileName: "receipt.png",
    declaredMimeType: "image/png",
    purpose: "receipt",
  });

  assert.equal(csv.sourceFormat, "csv");
  assert.equal(qif.sourceFormat, "qif");
  assert.equal(pdf.sourceFormat, "pdf");
  assert.equal(png.mimeType, "image/png");
  assert.match(csv.checksumSha256, /^[a-f0-9]{64}$/);
});

test("rejects extension, MIME, signature, binary text, and empty mismatches", () => {
  assert.throws(
    () =>
      validateExpenseUpload({
        bytes: Buffer.from("not a pdf"),
        originalFileName: "statement.pdf",
        declaredMimeType: "application/pdf",
        purpose: "source",
      }),
    /signature/,
  );
  assert.throws(
    () =>
      validateExpenseUpload({
        bytes: Buffer.from("Date,Amount\n"),
        originalFileName: "statement.csv",
        declaredMimeType: "application/pdf",
        purpose: "source",
      }),
    /content type/,
  );
  assert.throws(
    () =>
      validateExpenseUpload({
        bytes: Buffer.from([0x44, 0x61, 0x74, 0x65, 0x00]),
        originalFileName: "statement.csv",
        purpose: "source",
      }),
    /NUL/,
  );
  assert.throws(
    () =>
      validateExpenseUpload({
        bytes: Buffer.alloc(0),
        originalFileName: "statement.csv",
        purpose: "source",
      }),
    /empty/,
  );
});

test("creates tenant-owned paths and sanitizes caller labels", () => {
  assert.equal(
    createExpenseStoragePath({
      tenantId: "tenant_test",
      fileId: "file_test",
      purpose: "source",
      extension: "csv",
    }),
    "tenants/tenant_test/expenses/sources/file_test/original.csv",
  );
  assert.equal(
    createExpenseExportStoragePath({
      tenantId: "tenant_test",
      exportId: "export_test",
    }),
    "tenants/tenant_test/expenses/exports/export_test/accountant-export.xlsx",
  );
  assert.equal(sanitizeExpenseFileName("../../statement.csv"), "statement.csv");
  assert.equal(normalizeSourceAccountKey(" Personal-Visa "), "personal-visa");
  assert.equal(
    normalizeSourceAccountLabel(" Personal   Visa ending 1234 "),
    "Personal Visa ending 1234",
  );
  assert.throws(
    () =>
      createExpenseStoragePath({
        tenantId: "../other",
        fileId: "file_test",
        purpose: "source",
        extension: "csv",
      }),
    /safe path segment/,
  );
});

test("accepts only bounded XLSX containers for generated exports", () => {
  const result = validateGeneratedExpenseExport(
    Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]),
  );
  assert.equal(result.sizeBytes, 5);
  assert.throws(
    () => validateGeneratedExpenseExport(Buffer.from("not-xlsx")),
    /XLSX/,
  );
});
