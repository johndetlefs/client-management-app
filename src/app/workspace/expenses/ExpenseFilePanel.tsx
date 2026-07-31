"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import type {
  ExpenseExportFileRow,
  ExpenseFileRow,
} from "./file-actions";

export function ExpenseSourceUploadPanel({
  uploading,
  onUpload,
}: {
  uploading: boolean;
  onUpload: (input: {
    file: File;
    sourceAccountKey: string;
    sourceAccountLabel: string;
  }) => Promise<boolean>;
}) {
  const [sourceAccountKey, setSourceAccountKey] = useState("");
  const [sourceAccountLabel, setSourceAccountLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    const form = event.currentTarget;
    const succeeded = await onUpload({
      file,
      sourceAccountKey,
      sourceAccountLabel,
    });
    if (succeeded) {
      setFile(null);
      form.reset();
    }
  }

  return (
    <Card className="mb-6 p-4">
      <form
        onSubmit={(event) => void submit(event)}
        className="grid gap-4 lg:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1fr)_minmax(260px,1.4fr)_auto] lg:items-end"
      >
        <label className="text-sm font-medium text-foreground">
          Source account ID
          <input
            required
            value={sourceAccountKey}
            onChange={(event) => setSourceAccountKey(event.target.value)}
            placeholder="personal-visa"
            pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,63}"
            className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm font-medium text-foreground">
          Account label
          <input
            required
            value={sourceAccountLabel}
            onChange={(event) => setSourceAccountLabel(event.target.value)}
            placeholder="Personal Visa ending 1234"
            className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm font-medium text-foreground">
          Bank export
          <input
            required
            type="file"
            accept=".csv,.qif,.pdf,text/csv,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:border-0 file:bg-transparent file:font-medium dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <Button
          type="submit"
          disabled={uploading || !file || !sourceAccountKey.trim()}
          className="min-h-10 whitespace-nowrap"
        >
          {uploading ? "Uploading..." : "Upload statement"}
        </Button>
      </form>
      <p className="mt-3 text-xs text-zinc-500">
        CSV imports transactions now. QIF is supported as an alternate import.
        PDF is retained as private source evidence only.
      </p>
    </Card>
  );
}

export function ExpenseFilesPanel({
  files,
  exports,
  busyId,
  minimizing,
  onDownloadFile,
  onDeleteFile,
  onDownloadExport,
  onDeleteExport,
  onMinimize,
}: {
  files: ExpenseFileRow[];
  exports: ExpenseExportFileRow[];
  busyId: string | null;
  minimizing: boolean;
  onDownloadFile: (file: ExpenseFileRow) => Promise<void>;
  onDeleteFile: (file: ExpenseFileRow) => Promise<void>;
  onDownloadExport: (record: ExpenseExportFileRow) => Promise<void>;
  onDeleteExport: (record: ExpenseExportFileRow) => Promise<void>;
  onMinimize: () => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Personal transaction retention
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Personal and ignored descriptions are kept for 90 days, then
              reduced to the fields required to prevent duplicate imports.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={minimizing}
            onClick={() => void onMinimize()}
            className="min-h-10 whitespace-nowrap"
          >
            {minimizing ? "Minimising..." : "Minimise due details"}
          </Button>
        </div>
      </Card>

      <FileTable
        title="Statements and receipts"
        emptyMessage="No source statements or receipts have been stored."
        rows={files.map((file) => ({
          id: file.id,
          name: file.originalFileName,
          detail:
            file.purpose === "receipt"
              ? `Receipt${file.linkedExpenseId ? ` for ${file.linkedExpenseId}` : ""}`
              : `${(file.sourceFormat || "source").toUpperCase()} statement | ${
                  file.sourceAccountLabel ||
                  file.sourceAccountKey ||
                  "Account not recorded"
                }`,
          sizeBytes: file.sizeBytes,
          status: file.retentionStatus,
          createdAt: file.createdAt,
          onDownload: () => onDownloadFile(file),
          onDelete: () => onDeleteFile(file),
        }))}
        busyId={busyId}
      />

      <FileTable
        title="Accountant exports"
        emptyMessage="No accountant exports have been generated."
        rows={exports.map((record) => ({
          id: record.id,
          name: record.fileName,
          detail:
            record.periodStartDate && record.periodEndDate
              ? `${record.periodStartDate} to ${record.periodEndDate}`
              : "Accountant workbook",
          sizeBytes: record.sizeBytes,
          status: record.retentionStatus,
          createdAt: record.createdAt,
          onDownload: () => onDownloadExport(record),
          onDelete: () => onDeleteExport(record),
        }))}
        busyId={busyId}
      />
    </div>
  );
}

interface FileTableRow {
  id: string;
  name: string;
  detail: string;
  sizeBytes?: number;
  status: string;
  createdAt?: string;
  onDownload: () => Promise<void>;
  onDelete: () => Promise<void>;
}

function FileTable({
  title,
  emptyMessage,
  rows,
  busyId,
}: {
  title: string;
  emptyMessage: string;
  rows: FileTableRow[];
  busyId: string | null;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((row) => {
            const available = row.status !== "deleted";
            return (
              <div
                key={row.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="break-words text-sm font-medium text-foreground">
                    {row.name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {row.detail}
                    {row.sizeBytes !== undefined
                      ? ` | ${formatFileSize(row.sizeBytes)}`
                      : ""}
                    {row.createdAt
                      ? ` | ${new Date(row.createdAt).toLocaleString("en-AU")}`
                      : ""}
                  </div>
                  {!available && (
                    <div className="mt-1 text-xs font-medium text-zinc-500">
                      File deleted; audit metadata retained
                    </div>
                  )}
                </div>
                {available && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={busyId === row.id}
                      onClick={() => void row.onDownload()}
                      className="px-3 py-2 text-xs"
                    >
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busyId === row.id}
                      onClick={() => void row.onDelete()}
                      className="px-3 py-2 text-xs text-red-700 dark:text-red-300"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
