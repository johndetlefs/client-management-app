"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type {
  ExpenseCandidateReviewStatus,
  ExpenseGstTreatment,
} from "@/types/expense";
import type {
  BasPreparationSettings,
  GstRegistrationSettings,
} from "@/types/tenant";
import type { BasPreparationSummary } from "@/lib/expenses/bas";

import {
  confirmExpenseCandidate,
  getConfirmedExpenses,
  getExpenseAccountingContext,
  saveExpenseCategory,
  saveMerchantRuleFromExpense,
  setMerchantRuleActive,
  updateConfirmedExpense,
  updateExpenseGstRegistration,
  type ConfirmedExpenseRow,
  type ExpenseAccountingContext,
  type MerchantRuleRow,
} from "./accounting-actions";
import {
  ExpenseAccountingForm,
  formatMoney,
  gstCreditStatusLabel,
  type ExpenseAccountingFormValues,
} from "./ExpenseAccountingForm";
import { ExpenseSettingsPanel } from "./ExpenseSettingsPanel";
import { BasPreparationPanel } from "./BasPreparationPanel";
import {
  getBasPreparationContext,
  getBasPreparationSummary,
  saveBasPreparationSettings,
  type BasPreparationContext,
} from "./bas-actions";
import {
  getExpenseCandidatesForReview,
  importExpensesCsv,
  importExpensesQif,
  minimizeExpiredPersonalCandidates,
  reviewExpenseCandidate,
  type ExpenseCandidateReviewRow,
} from "./actions";
import {
  ExpenseFilesPanel,
  ExpenseSourceUploadPanel,
} from "./ExpenseFilePanel";
import {
  getExpenseFilesContext,
  type ExpenseExportFileRow,
  type ExpenseFilesContext,
  type ExpenseFileRow,
} from "./file-actions";

type WorkspaceTab = "review" | "confirmed" | "bas" | "files" | "settings";
type ReviewFilter =
  | "all"
  | "unreviewed"
  | "business"
  | "personal"
  | "mixed_use"
  | "ignored"
  | "possible_duplicate";

const REVIEW_ACTIONS: Array<{
  status: Extract<
    ExpenseCandidateReviewStatus,
    "business" | "personal" | "mixed_use" | "ignored"
  >;
  label: string;
}> = [
  { status: "business", label: "Business" },
  { status: "personal", label: "Personal" },
  { status: "mixed_use", label: "Mixed use" },
  { status: "ignored", label: "Ignore" },
];

const FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unreviewed", label: "Unreviewed" },
  { value: "business", label: "Business" },
  { value: "mixed_use", label: "Mixed" },
  { value: "personal", label: "Personal" },
  { value: "ignored", label: "Ignored" },
  { value: "possible_duplicate", label: "Duplicates" },
];

const EMPTY_ACCOUNTING_CONTEXT: ExpenseAccountingContext = {
  gstRegistration: { status: "unknown" },
  canManageSettings: false,
  categories: [],
  merchantRules: [],
};

const EMPTY_BAS_CONTEXT: BasPreparationContext = {
  registration: { status: "unknown" },
  periods: [],
  canManageSettings: false,
};

const EMPTY_FILES_CONTEXT: ExpenseFilesContext = {
  files: [],
  exports: [],
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const { tenantId } = useWorkspace();
  const [tab, setTab] = useState<WorkspaceTab>("review");
  const [candidates, setCandidates] = useState<ExpenseCandidateReviewRow[]>([]);
  const [expenses, setExpenses] = useState<ConfirmedExpenseRow[]>([]);
  const [accounting, setAccounting] = useState<ExpenseAccountingContext>(
    EMPTY_ACCOUNTING_CONTEXT,
  );
  const [basContext, setBasContext] =
    useState<BasPreparationContext>(EMPTY_BAS_CONTEXT);
  const [basSummary, setBasSummary] =
    useState<BasPreparationSummary | null>(null);
  const [fileContext, setFileContext] =
    useState<ExpenseFilesContext>(EMPTY_FILES_CONTEXT);
  const [selectedBasPeriodStart, setSelectedBasPeriodStart] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("unreviewed");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [savingRegistration, setSavingRegistration] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null);
  const [savingMerchantRuleId, setSavingMerchantRuleId] = useState<
    string | null
  >(null);
  const [exportStartDate, setExportStartDate] = useState(
    defaultFinancialYearStart(),
  );
  const [exportEndDate, setExportEndDate] = useState(todayIsoDate());
  const [exporting, setExporting] = useState(false);
  const [savingBasSettings, setSavingBasSettings] = useState(false);
  const [loadingBasSummary, setLoadingBasSummary] = useState(false);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [fileBusyId, setFileBusyId] = useState<string | null>(null);
  const [minimizingCandidates, setMinimizingCandidates] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const [
        candidateResult,
        expenseResult,
        contextResult,
        basResult,
        filesResult,
      ] =
        await Promise.all([
          getExpenseCandidatesForReview(tenantId, idToken),
          getConfirmedExpenses(tenantId, idToken),
          getExpenseAccountingContext(tenantId, idToken),
          getBasPreparationContext(tenantId, idToken),
          getExpenseFilesContext(tenantId, idToken),
        ]);

      if (!candidateResult.success) {
        throw new Error(candidateResult.error);
      }
      if (!expenseResult.success) {
        throw new Error(expenseResult.error);
      }
      if (!contextResult.success) {
        throw new Error(contextResult.error);
      }
      if (!basResult.success) {
        throw new Error(basResult.error);
      }
      if (!filesResult.success) {
        throw new Error(filesResult.error);
      }

      setCandidates(candidateResult.data);
      setExpenses(expenseResult.data);
      setAccounting(contextResult.data);
      setBasContext(basResult.data);
      setFileContext(filesResult.data);
      setSelectedBasPeriodStart((current) =>
        basResult.data.periods.some((period) => period.startDate === current)
          ? current
          : basResult.data.periods[0]?.startDate || "",
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load the expense workspace",
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId, user]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const counts = useMemo(() => {
    return {
      all: candidates.length,
      unreviewed: candidates.filter(
        (candidate) => candidate.reviewStatus === "unreviewed",
      ).length,
      business: candidates.filter(
        (candidate) => candidate.reviewStatus === "business",
      ).length,
      personal: candidates.filter(
        (candidate) => candidate.reviewStatus === "personal",
      ).length,
      mixed_use: candidates.filter(
        (candidate) => candidate.reviewStatus === "mixed_use",
      ).length,
      ignored: candidates.filter(
        (candidate) => candidate.reviewStatus === "ignored",
      ).length,
      possible_duplicate: candidates.filter(
        (candidate) => candidate.duplicateStatus === "possible_duplicate",
      ).length,
    };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    if (filter === "all") {
      return candidates;
    }
    if (filter === "possible_duplicate") {
      return candidates.filter(
        (candidate) => candidate.duplicateStatus === "possible_duplicate",
      );
    }
    return candidates.filter((candidate) => candidate.reviewStatus === filter);
  }, [candidates, filter]);

  const selectedCandidate = candidates.find(
    (candidate) => candidate.id === selectedCandidateId,
  );
  const selectedExpense = expenses.find(
    (expense) => expense.id === selectedExpenseId,
  );

  async function handleReview(
    candidateId: string,
    reviewStatus: ExpenseCandidateReviewStatus,
  ) {
    if (!user) return;
    setUpdatingId(candidateId);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await reviewExpenseCandidate(
        tenantId,
        idToken,
        candidateId,
        reviewStatus,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.id === candidateId ? result.data : candidate,
        ),
      );
      if (
        reviewStatus !== "business" &&
        reviewStatus !== "mixed_use" &&
        selectedCandidateId === candidateId
      ) {
        setSelectedCandidateId(null);
      }
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Failed to review expense candidate",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSourceUpload(input: {
    file: File;
    sourceAccountKey: string;
    sourceAccountLabel: string;
  }): Promise<boolean> {
    if (!user) return false;
    setUploadingSource(true);
    setError(null);
    setNotice(null);
    let uploadedFileId: string | undefined;
    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      formData.append("purpose", "source");
      formData.append("sourceAccountKey", input.sourceAccountKey);
      formData.append("sourceAccountLabel", input.sourceAccountLabel);
      formData.append("file", input.file);
      const uploadResponse = await fetch(
        `/api/expenses/files?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        },
      );
      const uploadBody = (await uploadResponse.json()) as {
        id?: string;
        sourceFormat?: "csv" | "qif" | "pdf";
        error?: string;
      };
      if (!uploadResponse.ok || !uploadBody.id || !uploadBody.sourceFormat) {
        throw new Error(uploadBody.error || "Failed to store source statement");
      }
      uploadedFileId = uploadBody.id;

      if (
        uploadBody.sourceFormat === "csv" ||
        uploadBody.sourceFormat === "qif"
      ) {
        const sourceText = await input.file.text();
        const sharedInput = {
          originalFileName: input.file.name,
          sourceAccountKey: input.sourceAccountKey,
          sourceAccountLabel: input.sourceAccountLabel,
          sourceFileId: uploadedFileId,
        };
        const importResult =
          uploadBody.sourceFormat === "csv"
            ? await importExpensesCsv(tenantId, idToken, {
                ...sharedInput,
                csvText: sourceText,
              })
            : await importExpensesQif(tenantId, idToken, {
                ...sharedInput,
                qifText: sourceText,
              });
        if (!importResult.success) {
          throw new Error(importResult.error);
        }
        setNotice(
          `Imported ${importResult.data.counts.candidateRows} candidate rows from ${uploadBody.sourceFormat.toUpperCase()}; skipped ${importResult.data.counts.duplicateRows} duplicates.`,
        );
      } else if (uploadBody.sourceFormat === "pdf") {
        setNotice("PDF stored privately as source evidence; no rows imported.");
      }

      await loadWorkspace();
      return true;
    } catch (uploadError) {
      if (uploadedFileId && user) {
        const idToken = await user.getIdToken();
        await fetch(
          `/api/expenses/files?tenantId=${encodeURIComponent(
            tenantId,
          )}&fileId=${encodeURIComponent(uploadedFileId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          },
        );
      }
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload source statement",
      );
      return false;
    } finally {
      setUploadingSource(false);
    }
  }

  async function handleConfirm(values: ExpenseAccountingFormValues) {
    if (!user || !selectedCandidate) return;
    setUpdatingId(selectedCandidate.id);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await confirmExpenseCandidate(tenantId, idToken, {
        candidateId: selectedCandidate.id,
        ...values,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      setCandidates((current) =>
        current.map((candidate) =>
          candidate.id === selectedCandidate.id
            ? {
                ...candidate,
                reviewStatus: "confirmed",
                existingExpenseId: result.data.id,
              }
            : candidate,
        ),
      );
      setExpenses((current) => [
        result.data,
        ...current.filter((expense) => expense.id !== result.data.id),
      ]);
      setSelectedCandidateId(null);
      setTab("confirmed");
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Failed to confirm expense",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleUpdateExpense(values: ExpenseAccountingFormValues) {
    if (!user || !selectedExpense) return;
    setUpdatingId(selectedExpense.id);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await updateConfirmedExpense(tenantId, idToken, {
        expenseId: selectedExpense.id,
        ...values,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      setExpenses((current) =>
        current.map((expense) =>
          expense.id === result.data.id ? result.data : expense,
        ),
      );
      setSelectedExpenseId(null);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update expense",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveRegistration(
    registration: GstRegistrationSettings,
  ) {
    if (!user) return;
    setSavingRegistration(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await updateExpenseGstRegistration(
        tenantId,
        idToken,
        registration,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      setAccounting((current) => ({
        ...current,
        gstRegistration: result.data,
      }));
      setBasContext((current) => ({
        ...current,
        registration: result.data,
      }));
      setBasSummary(null);
      const refreshedExpenses = await getConfirmedExpenses(tenantId, idToken);
      if (refreshedExpenses.success) {
        setExpenses(refreshedExpenses.data);
      }
    } catch (registrationError) {
      setError(
        registrationError instanceof Error
          ? registrationError.message
          : "Failed to update GST registration",
      );
    } finally {
      setSavingRegistration(false);
    }
  }

  async function handleSaveCategory(input: {
    id?: string;
    name: string;
    active?: boolean;
  }): Promise<boolean> {
    if (!user) return false;
    setSavingCategoryId(input.id || "new");
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await saveExpenseCategory(tenantId, idToken, input);
      if (!result.success) {
        throw new Error(result.error);
      }
      setAccounting((current) => {
        const exists = current.categories.some(
          (category) => category.id === result.data.id,
        );
        return {
          ...current,
          categories: exists
            ? current.categories.map((category) =>
                category.id === result.data.id ? result.data : category,
              )
            : [...current.categories, result.data].sort(
                (left, right) => left.sortOrder - right.sortOrder,
              ),
        };
      });
      return true;
    } catch (categoryError) {
      setError(
        categoryError instanceof Error
          ? categoryError.message
          : "Failed to save expense category",
      );
      return false;
    } finally {
      setSavingCategoryId(null);
    }
  }

  async function handleLearnMerchantRule(expenseId: string) {
    if (!user) return;
    setSavingMerchantRuleId(expenseId);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await saveMerchantRuleFromExpense(
        tenantId,
        idToken,
        expenseId,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      setAccounting((current) => ({
        ...current,
        merchantRules: upsertMerchantRule(
          current.merchantRules,
          result.data,
        ),
      }));
      setExpenses((current) =>
        current.map((expense) =>
          expense.id === expenseId
            ? { ...expense, merchantRuleId: result.data.id }
            : expense,
        ),
      );
    } catch (ruleError) {
      setError(
        ruleError instanceof Error
          ? ruleError.message
          : "Failed to save merchant rule",
      );
    } finally {
      setSavingMerchantRuleId(null);
    }
  }

  async function handleToggleMerchantRule(
    merchantRuleId: string,
    active: boolean,
  ) {
    if (!user) return;
    setSavingMerchantRuleId(merchantRuleId);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await setMerchantRuleActive(
        tenantId,
        idToken,
        merchantRuleId,
        active,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      setAccounting((current) => ({
        ...current,
        merchantRules: upsertMerchantRule(
          current.merchantRules,
          result.data,
        ),
      }));
    } catch (ruleError) {
      setError(
        ruleError instanceof Error
          ? ruleError.message
          : "Failed to update merchant rule",
      );
    } finally {
      setSavingMerchantRuleId(null);
    }
  }

  async function handleAccountantExport() {
    if (!user) return;
    setExporting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/expenses/accountant-export", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId,
          periodStartDate: exportStartDate,
          periodEndDate: exportEndDate,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to generate accountant export");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/);
      const fileName =
        fileNameMatch?.[1] ||
        `accountant-export-${exportStartDate}-to-${exportEndDate}.xlsx`;
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      await refreshFiles();
      setNotice("Accountant workbook generated, stored privately, and downloaded.");
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Failed to generate accountant export",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleReceiptUpload(expenseId: string, file: File) {
    if (!user) return;
    setFileBusyId(expenseId);
    setError(null);
    setNotice(null);
    try {
      const idToken = await user.getIdToken();
      const formData = new FormData();
      formData.append("purpose", "receipt");
      formData.append("linkedExpenseId", expenseId);
      formData.append("file", file);
      const response = await fetch(
        `/api/expenses/files?tenantId=${encodeURIComponent(tenantId)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
          body: formData,
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Failed to attach receipt");
      }
      await loadWorkspace();
      setNotice("Receipt attached privately to the confirmed expense.");
    } catch (receiptError) {
      setError(
        receiptError instanceof Error
          ? receiptError.message
          : "Failed to attach receipt",
      );
    } finally {
      setFileBusyId(null);
    }
  }

  async function refreshFiles() {
    if (!user) return;
    const result = await getExpenseFilesContext(
      tenantId,
      await user.getIdToken(),
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    setFileContext(result.data);
  }

  async function downloadFile(record: ExpenseFileRow) {
    await downloadPrivateFile(
      `/api/expenses/files?tenantId=${encodeURIComponent(
        tenantId,
      )}&fileId=${encodeURIComponent(record.id)}`,
      record.originalFileName,
      record.id,
    );
  }

  async function downloadExport(record: ExpenseExportFileRow) {
    await downloadPrivateFile(
      `/api/expenses/export-files?tenantId=${encodeURIComponent(
        tenantId,
      )}&exportId=${encodeURIComponent(record.id)}`,
      record.fileName,
      record.id,
    );
  }

  async function downloadPrivateFile(
    url: string,
    fileName: string,
    busyId: string,
  ) {
    if (!user) return;
    setFileBusyId(busyId);
    setError(null);
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to download file");
      }
      const downloadUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download file",
      );
    } finally {
      setFileBusyId(null);
    }
  }

  async function deleteFile(record: ExpenseFileRow) {
    if (
      !user ||
      !window.confirm(`Delete ${record.originalFileName}? Accounting records remain.`)
    ) {
      return;
    }
    const deleted = await deletePrivateRecord(
      `/api/expenses/files?tenantId=${encodeURIComponent(
        tenantId,
      )}&fileId=${encodeURIComponent(record.id)}`,
      record.id,
    );
    if (deleted) {
      await loadWorkspace();
    }
  }

  async function deleteExport(record: ExpenseExportFileRow) {
    if (!user || !window.confirm(`Delete ${record.fileName}?`)) return;
    const deleted = await deletePrivateRecord(
      `/api/expenses/export-files?tenantId=${encodeURIComponent(
        tenantId,
      )}&exportId=${encodeURIComponent(record.id)}`,
      record.id,
    );
    if (deleted) {
      await refreshFiles();
    }
  }

  async function deletePrivateRecord(
    url: string,
    busyId: string,
  ): Promise<boolean> {
    if (!user) return false;
    setFileBusyId(busyId);
    setError(null);
    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Failed to delete file");
      }
      setNotice("Private file deleted; minimal audit metadata retained.");
      return true;
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete file",
      );
      return false;
    } finally {
      setFileBusyId(null);
    }
  }

  async function handleMinimizeCandidates() {
    if (!user) return;
    setMinimizingCandidates(true);
    setError(null);
    setNotice(null);
    try {
      const result = await minimizeExpiredPersonalCandidates(
        tenantId,
        await user.getIdToken(),
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      await loadWorkspace();
      setNotice(
        `Minimised ${result.data.minimizedCount} due personal or ignored transaction records.`,
      );
    } catch (minimizeError) {
      setError(
        minimizeError instanceof Error
          ? minimizeError.message
          : "Failed to minimise transaction details",
      );
    } finally {
      setMinimizingCandidates(false);
    }
  }

  async function handleSaveBasSettings(settings: BasPreparationSettings) {
    if (!user) return;
    setSavingBasSettings(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await saveBasPreparationSettings(
        tenantId,
        idToken,
        settings,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      setBasContext(result.data);
      setSelectedBasPeriodStart(result.data.periods[0]?.startDate || "");
      setBasSummary(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save BAS preparation settings",
      );
    } finally {
      setSavingBasSettings(false);
    }
  }

  async function handlePrepareBasSummary() {
    if (!user || !selectedBasPeriodStart) return;
    setLoadingBasSummary(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await getBasPreparationSummary(
        tenantId,
        idToken,
        selectedBasPeriodStart,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      setBasSummary(result.data);
    } catch (summaryError) {
      setError(
        summaryError instanceof Error
          ? summaryError.message
          : "Failed to prepare BAS summary",
      );
    } finally {
      setLoadingBasSummary(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-zinc-50 dark:bg-black">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Expenses</h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Review, confirm, and prepare business expenses
              </p>
            </div>
            <RegistrationSummary
              registration={accounting.gstRegistration}
              onManage={() => setTab("settings")}
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Imported" value={counts.all} />
            <SummaryTile label="Unreviewed" value={counts.unreviewed} />
            <SummaryTile
              label="Awaiting confirmation"
              value={counts.business + counts.mixed_use}
            />
            <SummaryTile label="Confirmed" value={expenses.length} />
          </div>

          <div className="mb-6 grid w-full grid-cols-2 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950 sm:inline-flex sm:w-auto">
            <TabButton
              active={tab === "review"}
              onClick={() => setTab("review")}
            >
              Review
            </TabButton>
            <TabButton
              active={tab === "confirmed"}
              onClick={() => setTab("confirmed")}
            >
              Confirmed
            </TabButton>
            <TabButton
              active={tab === "bas"}
              onClick={() => setTab("bas")}
            >
              BAS preparation
            </TabButton>
            <TabButton
              active={tab === "files"}
              onClick={() => setTab("files")}
            >
              Files & privacy
            </TabButton>
            <TabButton
              active={tab === "settings"}
              onClick={() => setTab("settings")}
            >
              Accounting settings
            </TabButton>
          </div>

          {error && (
            <div className="mb-6 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-6 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              {notice}
            </div>
          )}

          {loading ? (
            <Card className="p-8 text-center text-sm text-zinc-600 dark:text-zinc-400">
              Loading expense workspace...
            </Card>
          ) : tab === "review" ? (
            <>
              <ExpenseSourceUploadPanel
                uploading={uploadingSource}
                onUpload={handleSourceUpload}
              />
              {selectedCandidate &&
                (selectedCandidate.reviewStatus === "business" ||
                  selectedCandidate.reviewStatus === "mixed_use") && (
                  <ExpenseAccountingForm
                    key={selectedCandidate.id}
                    title="Confirm business expense"
                    merchantName={selectedCandidate.normalizedMerchantName}
                    expenseDate={selectedCandidate.postedDate}
                    amountMinor={selectedCandidate.amountMinor}
                    currency={selectedCandidate.currency}
                    categories={accounting.categories}
                    gstRegistration={accounting.gstRegistration}
                    initialValues={createCandidateFormValues(
                      selectedCandidate,
                      accounting,
                    )}
                    suggestion={selectedCandidate.suggested}
                    recurrencePattern={selectedCandidate.recurrencePattern}
                    businessUseMode={selectedCandidate.reviewStatus}
                    saving={updatingId === selectedCandidate.id}
                    submitLabel="Confirm expense"
                    onSubmit={handleConfirm}
                    onCancel={() => setSelectedCandidateId(null)}
                  />
                )}
              <ReviewWorkspace
                candidates={filteredCandidates}
                counts={counts}
                filter={filter}
                updatingId={updatingId}
                onFilter={setFilter}
                onReview={handleReview}
                onConfirm={setSelectedCandidateId}
              />
            </>
          ) : tab === "confirmed" ? (
            <>
              <ExpenseExportPanel
                startDate={exportStartDate}
                endDate={exportEndDate}
                exporting={exporting}
                onStartDate={setExportStartDate}
                onEndDate={setExportEndDate}
                onExport={handleAccountantExport}
              />
              {selectedExpense && (
                <ExpenseAccountingForm
                  key={selectedExpense.id}
                  title="Edit confirmed expense"
                  merchantName={selectedExpense.merchantName}
                  expenseDate={selectedExpense.date}
                  amountMinor={selectedExpense.amountMinor}
                  currency={selectedExpense.currency}
                  categories={accounting.categories}
                  gstRegistration={accounting.gstRegistration}
                  initialValues={createExpenseFormValues(selectedExpense)}
                  businessUseMode="editable"
                  saving={updatingId === selectedExpense.id}
                  submitLabel="Save expense"
                  onSubmit={handleUpdateExpense}
                  onCancel={() => setSelectedExpenseId(null)}
                />
              )}
              <ConfirmedExpensesTable
                expenses={expenses}
                savingMerchantRuleId={savingMerchantRuleId}
                fileBusyId={fileBusyId}
                onEdit={setSelectedExpenseId}
                onLearnMerchantRule={handleLearnMerchantRule}
                onReceipt={handleReceiptUpload}
              />
            </>
          ) : tab === "bas" ? (
            <BasPreparationPanel
              key={`${basContext.settings?.accountingBasis || "unset"}-${basContext.settings?.cadence || "unset"}`}
              context={basContext}
              selectedPeriodStart={selectedBasPeriodStart}
              summary={basSummary}
              saving={savingBasSettings}
              loading={loadingBasSummary}
              onPeriod={(periodStart) => {
                setSelectedBasPeriodStart(periodStart);
                setBasSummary(null);
              }}
              onSaveSettings={handleSaveBasSettings}
              onPrepare={handlePrepareBasSummary}
            />
          ) : tab === "files" ? (
            <ExpenseFilesPanel
              files={fileContext.files}
              exports={fileContext.exports}
              busyId={fileBusyId}
              minimizing={minimizingCandidates}
              onDownloadFile={downloadFile}
              onDeleteFile={deleteFile}
              onDownloadExport={downloadExport}
              onDeleteExport={deleteExport}
              onMinimize={handleMinimizeCandidates}
            />
          ) : (
            <ExpenseSettingsPanel
              registration={accounting.gstRegistration}
              canManageSettings={accounting.canManageSettings}
              categories={accounting.categories}
              merchantRules={accounting.merchantRules}
              savingRegistration={savingRegistration}
              savingCategoryId={savingCategoryId}
              savingMerchantRuleId={savingMerchantRuleId}
              onSaveRegistration={handleSaveRegistration}
              onSaveCategory={handleSaveCategory}
              onToggleMerchantRule={handleToggleMerchantRule}
            />
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

function ExpenseExportPanel({
  startDate,
  endDate,
  exporting,
  onStartDate,
  onEndDate,
  onExport,
}: {
  startDate: string;
  endDate: string;
  exporting: boolean;
  onStartDate: (value: string) => void;
  onEndDate: (value: string) => void;
  onExport: () => Promise<void>;
}) {
  return (
    <Card className="mb-6 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Accountant export
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Confirmed expenses and issued invoice income for the selected
            period.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_auto] sm:items-end">
          <label className="text-sm font-medium text-foreground">
            Start date
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) => onStartDate(event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-sm font-medium text-foreground">
            End date
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => onEndDate(event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <Button
            onClick={() => void onExport()}
            disabled={exporting || !startDate || !endDate}
            className="min-h-10 whitespace-nowrap"
          >
            {exporting ? "Generating..." : "Export Excel"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ReviewWorkspace({
  candidates,
  counts,
  filter,
  updatingId,
  onFilter,
  onReview,
  onConfirm,
}: {
  candidates: ExpenseCandidateReviewRow[];
  counts: Record<ReviewFilter, number>;
  filter: ReviewFilter;
  updatingId: string | null;
  onFilter: (filter: ReviewFilter) => void;
  onReview: (
    candidateId: string,
    status: ExpenseCandidateReviewStatus,
  ) => Promise<void>;
  onConfirm: (candidateId: string) => void;
}) {
  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onFilter(option.value)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              filter === option.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                : "border-zinc-200 bg-white text-foreground hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
            }`}
          >
            {option.label} {counts[option.value]}
          </button>
        ))}
      </div>

      {candidates.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            No candidates
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {filter === "unreviewed"
              ? "All imported candidates have been reviewed."
              : "No candidates match the selected filter."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Merchant</TableHeader>
                  <TableHeader>Bank hint</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader align="right">Amount</TableHeader>
                  <TableHeader>Review</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                      {formatDate(candidate.postedDate)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="max-w-sm">
                        <div className="font-medium text-foreground">
                          {candidate.normalizedMerchantName}
                        </div>
                        <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {candidate.rawDescription}
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          Batch {candidate.importBatchId}
                        </div>
                        {candidate.suggested?.source === "user_rule" && (
                          <div className="mt-2 inline-flex rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            Merchant rule suggestion
                          </div>
                        )}
                        {candidate.recurrencePattern && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex rounded border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
                              Likely{" "}
                              {formatCadence(
                                candidate.recurrencePattern.cadence,
                              )}{" "}
                              recurring
                            </span>
                            {candidate.recurrencePattern
                              .isSubscriptionLike && (
                              <span className="inline-flex rounded border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">
                                Subscription-like
                              </span>
                            )}
                            {candidate.recurrencePattern
                              .conflictsWithMerchantRule && (
                              <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                Saved rule differs
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                      <div>{candidate.bankCategory || "Uncategorised"}</div>
                      {candidate.bankSubCategory && (
                        <div className="mt-1 text-xs text-zinc-500">
                          {candidate.bankSubCategory}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <ReviewBadge status={candidate.reviewStatus} />
                        <DuplicateBadge candidate={candidate} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                      <div className="font-medium text-foreground">
                        {candidate.direction === "debit" ? "-" : "+"}
                        {formatMoney(
                          candidate.amountMinor,
                          candidate.currency,
                        )}
                      </div>
                      <div className="mt-1 text-xs uppercase text-zinc-500">
                        {candidate.direction}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {candidate.reviewStatus === "confirmed" ? (
                        <span className="text-sm text-zinc-500">
                          Expense confirmed
                        </span>
                      ) : (
                        <div className="flex max-w-[330px] flex-wrap gap-2">
                          {REVIEW_ACTIONS.map((action) => (
                            <Button
                              key={action.status}
                              variant={
                                candidate.reviewStatus === action.status
                                  ? "primary"
                                  : "secondary"
                              }
                              onClick={() =>
                                void onReview(candidate.id, action.status)
                              }
                              disabled={updatingId === candidate.id}
                              className="px-3 py-1.5 text-xs"
                            >
                              {action.label}
                            </Button>
                          ))}
                          {(candidate.reviewStatus === "business" ||
                            candidate.reviewStatus === "mixed_use") &&
                            candidate.direction === "debit" && (
                              <Button
                                onClick={() => onConfirm(candidate.id)}
                                disabled={updatingId === candidate.id}
                                className="px-3 py-1.5 text-xs"
                              >
                                Confirm
                              </Button>
                            )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function ConfirmedExpensesTable({
  expenses,
  savingMerchantRuleId,
  fileBusyId,
  onEdit,
  onLearnMerchantRule,
  onReceipt,
}: {
  expenses: ConfirmedExpenseRow[];
  savingMerchantRuleId: string | null;
  fileBusyId: string | null;
  onEdit: (expenseId: string) => void;
  onLearnMerchantRule: (expenseId: string) => Promise<void>;
  onReceipt: (expenseId: string, file: File) => Promise<void>;
}) {
  if (expenses.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          No confirmed expenses
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Confirm Business or Mixed use candidates from the Review tab.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] table-fixed">
          <colgroup>
            <col className="w-[120px]" />
            <col className="w-[240px]" />
            <col className="w-[170px]" />
            <col className="w-[100px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[220px]" />
            <col className="w-[90px]" />
          </colgroup>
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <TableHeader>Date</TableHeader>
              <TableHeader>Merchant</TableHeader>
              <TableHeader>Category</TableHeader>
              <TableHeader align="right">Gross</TableHeader>
              <TableHeader align="right">Business use</TableHeader>
              <TableHeader align="right">GST credit</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader align="right">Action</TableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {expenses.map((expense) => (
              <tr key={expense.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                  {formatDate(expense.date)}
                </td>
                <td className="px-4 py-4">
                  <div className="break-words font-medium text-foreground">
                    {expense.merchantName}
                  </div>
                  <div className="mt-1 break-words text-xs text-zinc-500">
                    {expense.notes || expense.rawDescription}
                  </div>
                  {(expense.isSubscription || expense.isRecurring) && (
                    <div className="mt-2 flex gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {expense.isSubscription && <span>Subscription</span>}
                      {expense.isRecurring && <span>Recurring</span>}
                    </div>
                  )}
                </td>
                <td className="break-words px-4 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                  {expense.categoryName}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-medium tabular-nums text-foreground">
                  {formatMoney(expense.amountMinor, expense.currency)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-foreground">
                  <div>
                    {formatMoney(
                      expense.claimableAmountMinor,
                      expense.currency,
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {expense.businessUsePercent}%
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right text-sm tabular-nums text-foreground">
                  <div>
                    {formatMoney(expense.gstAmountMinor, expense.currency)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Potential{" "}
                    {formatMoney(
                      expense.gstIncludedAmountMinor,
                      expense.currency,
                    )}
                  </div>
                </td>
                <td className="break-words px-4 py-4 text-sm">
                  <div className="text-zinc-700 dark:text-zinc-300">
                    {gstCreditStatusLabel(expense.gstCreditStatus)}
                  </div>
                  {expense.gstRegistrationReviewRequired && (
                    <div className="mt-2 inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      Registration changed - review
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => onEdit(expense.id)}
                    >
                      Edit
                    </Button>
                    <label
                      className={`relative cursor-pointer overflow-hidden whitespace-nowrap rounded-lg border border-foreground/20 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-foreground/5 ${
                        fileBusyId === expense.id
                          ? "pointer-events-none opacity-50"
                          : ""
                      }`}
                    >
                      {fileBusyId === expense.id
                        ? "Uploading..."
                        : expense.receiptFileId
                          ? "Replace receipt"
                          : "Attach receipt"}
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void onReceipt(expense.id, file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <Button
                      variant="ghost"
                      disabled={savingMerchantRuleId === expense.id}
                      onClick={() => void onLearnMerchantRule(expense.id)}
                      className="whitespace-nowrap text-xs"
                    >
                      {savingMerchantRuleId === expense.id
                        ? "Learning..."
                        : expense.merchantRuleId
                          ? "Refresh rule"
                          : "Learn rule"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RegistrationSummary({
  registration,
  onManage,
}: {
  registration: GstRegistrationSettings;
  onManage: () => void;
}) {
  const label =
    registration.status === "registered"
      ? `GST registered from ${formatDate(registration.effectiveFrom || "")}`
      : registration.status === "not_registered"
        ? "Not registered for GST"
        : "GST registration not confirmed";

  return (
    <button
      type="button"
      onClick={onManage}
      className="text-left text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
    >
      {label}
    </button>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </Card>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 whitespace-normal rounded-md px-2 text-sm font-medium leading-tight sm:min-h-10 sm:whitespace-nowrap sm:px-4 ${
        active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}

function TableHeader({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium uppercase text-zinc-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function ReviewBadge({ status }: { status: ExpenseCandidateReviewStatus }) {
  const labels: Record<ExpenseCandidateReviewStatus, string> = {
    unreviewed: "Unreviewed",
    business: "Business",
    personal: "Personal",
    mixed_use: "Mixed use",
    ignored: "Ignored",
    confirmed: "Confirmed",
  };
  const styles: Record<ExpenseCandidateReviewStatus, string> = {
    unreviewed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    business:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    personal: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    mixed_use:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    ignored: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
    confirmed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
  return (
    <span className={`rounded px-2 py-1 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function DuplicateBadge({
  candidate,
}: {
  candidate: ExpenseCandidateReviewRow;
}) {
  if (candidate.duplicateStatus !== "possible_duplicate") {
    return null;
  }
  return (
    <span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      Possible duplicate
    </span>
  );
}

function createCandidateFormValues(
  candidate: ExpenseCandidateReviewRow,
  accounting: ExpenseAccountingContext,
): ExpenseAccountingFormValues {
  const defaultCategory =
    accounting.categories.find(
      (category) =>
        category.id === candidate.suggested?.categoryId && category.active,
    ) ||
    accounting.categories.find(
      (category) => category.id === "accountant-review" && category.active,
    ) ||
    accounting.categories.find((category) => category.active);
  const suggestedPercent = candidate.suggested?.businessUsePercent;
  return {
    businessUsePercent:
      candidate.reviewStatus === "business"
        ? 100
        : suggestedPercent &&
            Number.isInteger(suggestedPercent) &&
            suggestedPercent >= 1 &&
            suggestedPercent <= 99
          ? suggestedPercent
          : 50,
    categoryId: defaultCategory?.id || "",
    gstTreatment: candidate.suggested?.gstTreatment
      ? normalizeTreatment(candidate.suggested.gstTreatment)
      : "review_required",
    taxInvoiceStatus: "review_required",
    isSubscription: candidate.suggested?.isSubscription ?? false,
    isRecurring: candidate.suggested?.isRecurring ?? false,
    notes: "",
  };
}

function formatCadence(
  cadence: NonNullable<
    ExpenseCandidateReviewRow["recurrencePattern"]
  >["cadence"],
): string {
  return cadence === "fortnightly" ? "fortnightly" : cadence;
}

function upsertMerchantRule(
  rules: MerchantRuleRow[],
  savedRule: MerchantRuleRow,
): MerchantRuleRow[] {
  const exists = rules.some((rule) => rule.id === savedRule.id);
  return (
    exists
      ? rules.map((rule) => (rule.id === savedRule.id ? savedRule : rule))
      : [...rules, savedRule]
  ).sort((left, right) =>
    left.normalizedMerchantKey.localeCompare(right.normalizedMerchantKey),
  );
}

function createExpenseFormValues(
  expense: ConfirmedExpenseRow,
): ExpenseAccountingFormValues {
  return {
    businessUsePercent: expense.businessUsePercent,
    categoryId: expense.categoryId,
    gstTreatment: normalizeTreatment(expense.gstTreatment),
    taxInvoiceStatus: expense.taxInvoiceStatus,
    isSubscription: expense.isSubscription,
    isRecurring: expense.isRecurring,
    notes: expense.notes || "",
  };
}

function normalizeTreatment(
  treatment: ExpenseGstTreatment,
): ExpenseGstTreatment {
  return treatment === "gst_claimable" ? "taxable_purchase" : treatment;
}

function formatDate(value: string): string {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFinancialYearStart(): string {
  const today = todayIsoDate();
  const year = Number.parseInt(today.slice(0, 4), 10);
  const month = Number.parseInt(today.slice(5, 7), 10);
  return `${month >= 7 ? year : year - 1}-07-01`;
}
