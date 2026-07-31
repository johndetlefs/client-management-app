"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { calculateExpenseAmounts } from "@/lib/expenses/calculations";
import type {
  ExpenseCandidateSuggestion,
  ExpenseGstTreatment,
  ExpenseRecurrencePatternEvidence,
  ExpenseTaxInvoiceStatus,
} from "@/types/expense";
import type { GstRegistrationSettings } from "@/types/tenant";

import type { ExpenseCategoryRow } from "./accounting-actions";

export interface ExpenseAccountingFormValues {
  businessUsePercent: number;
  categoryId: string;
  gstTreatment: ExpenseGstTreatment;
  taxInvoiceStatus: ExpenseTaxInvoiceStatus;
  isSubscription: boolean;
  isRecurring: boolean;
  notes: string;
}

interface ExpenseAccountingFormProps {
  title: string;
  merchantName: string;
  expenseDate: string;
  amountMinor: number;
  currency: string;
  categories: ExpenseCategoryRow[];
  gstRegistration: GstRegistrationSettings;
  initialValues: ExpenseAccountingFormValues;
  suggestion?: ExpenseCandidateSuggestion;
  recurrencePattern?: ExpenseRecurrencePatternEvidence;
  businessUseMode: "business" | "mixed_use" | "editable";
  saving: boolean;
  submitLabel: string;
  onSubmit: (values: ExpenseAccountingFormValues) => Promise<void>;
  onCancel: () => void;
}

const GST_TREATMENTS: Array<{
  value: ExpenseGstTreatment;
  label: string;
}> = [
  { value: "review_required", label: "Needs GST review" },
  { value: "taxable_purchase", label: "Taxable purchase (GST included)" },
  { value: "no_gst", label: "No GST in price" },
  { value: "gst_free", label: "GST-free purchase" },
  { value: "input_taxed", label: "Input-taxed purchase" },
  { value: "private_or_non_claimable", label: "GST not claimable" },
];

const EVIDENCE_STATUSES: Array<{
  value: ExpenseTaxInvoiceStatus;
  label: string;
}> = [
  { value: "review_required", label: "Evidence needs review" },
  { value: "attached", label: "Tax invoice / receipt held" },
  { value: "missing", label: "Evidence missing" },
  { value: "not_required", label: "Tax invoice not required" },
];

export function ExpenseAccountingForm({
  title,
  merchantName,
  expenseDate,
  amountMinor,
  currency,
  categories,
  gstRegistration,
  initialValues,
  suggestion,
  recurrencePattern,
  businessUseMode,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: ExpenseAccountingFormProps) {
  const [values, setValues] =
    useState<ExpenseAccountingFormValues>(initialValues);
  const calculation = useMemo(() => {
    try {
      return {
        data: calculateExpenseAmounts({
          amountMinor,
          businessUsePercent: values.businessUsePercent,
          expenseDate,
          gstTreatment: values.gstTreatment,
          taxInvoiceStatus: values.taxInvoiceStatus,
          gstRegistration,
        }),
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate expense amounts",
      };
    }
  }, [
    amountMinor,
    expenseDate,
    gstRegistration,
    values.businessUsePercent,
    values.gstTreatment,
    values.taxInvoiceStatus,
  ]);
  const availableCategories = categories.filter(
    (category) => category.active || category.id === values.categoryId,
  );

  return (
    <Card className="mb-6 p-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (calculation.data) {
            void onSubmit(values);
          }
        }}
      >
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {merchantName} | {formatMoney(amountMinor, currency)} |{" "}
              {formatDate(expenseDate)}
            </p>
          </div>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>

        {suggestion?.source === "user_rule" && (
          <div className="mb-5 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            Learned merchant defaults have been applied. Review or change every
            field before confirming.
          </div>
        )}

        {suggestion?.source === "recurring_pattern" && recurrencePattern && (
          <div className="mb-5 border-l-4 border-sky-500 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-950 dark:text-sky-100">
            {recurrencePattern.occurrenceCount} distinct dates indicate a likely{" "}
            {recurrencePattern.cadence} recurring
            {recurrencePattern.isSubscriptionLike
              ? " subscription-like"
              : ""}{" "}
            payment. Review or change the flags before confirming.
          </div>
        )}

        {suggestion?.source === "user_rule" &&
          recurrencePattern?.conflictsWithMerchantRule && (
            <div className="mb-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              Repeated {recurrencePattern.cadence} payments differ from the saved
              recurring or subscription flags. The saved rule remains selected
              for review.
            </div>
          )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Business use (%)"
            type="number"
            min={1}
            max={businessUseMode === "mixed_use" ? 99 : 100}
            step={1}
            disabled={businessUseMode === "business"}
            value={values.businessUsePercent}
            onChange={(event) =>
              setValues({
                ...values,
                businessUsePercent: Number(event.target.value),
              })
            }
          />
          <SelectField
            label="Expense category"
            value={values.categoryId}
            onChange={(categoryId) => setValues({ ...values, categoryId })}
            options={[
              { value: "", label: "Select category" },
              ...availableCategories.map((category) => ({
                value: category.id,
                label: category.active
                  ? category.name
                  : `${category.name} (inactive)`,
              })),
            ]}
          />
          <SelectField
            label="GST treatment"
            value={values.gstTreatment}
            onChange={(gstTreatment) =>
              setValues({
                ...values,
                gstTreatment: gstTreatment as ExpenseGstTreatment,
              })
            }
            options={GST_TREATMENTS}
          />
          <SelectField
            label="Tax invoice / receipt"
            value={values.taxInvoiceStatus}
            onChange={(taxInvoiceStatus) =>
              setValues({
                ...values,
                taxInvoiceStatus:
                  taxInvoiceStatus as ExpenseTaxInvoiceStatus,
              })
            }
            options={EVIDENCE_STATUSES}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={values.isSubscription}
              onChange={(event) =>
                setValues({
                  ...values,
                  isSubscription: event.target.checked,
                })
              }
              className="h-4 w-4"
            />
            Subscription
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={values.isRecurring}
              onChange={(event) =>
                setValues({ ...values, isRecurring: event.target.checked })
              }
              className="h-4 w-4"
            />
            Recurring expense
          </label>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Notes
          </label>
          <textarea
            value={values.notes}
            maxLength={1_000}
            rows={3}
            onChange={(event) =>
              setValues({ ...values, notes: event.target.value })
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        <div className="mt-5 grid gap-3 border-y border-zinc-200 py-4 sm:grid-cols-3 dark:border-zinc-800">
          <AmountSummary
            label="Business-use amount"
            value={
              calculation.data
                ? formatMoney(calculation.data.claimableAmountMinor, currency)
                : "-"
            }
          />
          <AmountSummary
            label="Potential GST included"
            value={
              calculation.data
                ? formatMoney(
                    calculation.data.gstIncludedAmountMinor,
                    currency,
                  )
                : "-"
            }
          />
          <AmountSummary
            label="GST currently claimable"
            value={
              calculation.data
                ? formatMoney(calculation.data.gstAmountMinor, currency)
                : "-"
            }
            detail={
              calculation.data
                ? gstCreditStatusLabel(calculation.data.gstCreditStatus)
                : undefined
            }
          />
        </div>

        {calculation.error && (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">
            {calculation.error}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <Button
            type="submit"
            disabled={saving || !values.categoryId || !calculation.data}
          >
            {saving ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-foreground outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AmountSummary({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {detail && <div className="mt-1 text-xs text-zinc-500">{detail}</div>}
    </div>
  );
}

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function gstCreditStatusLabel(status: string): string {
  switch (status) {
    case "claimable":
      return "Claimable for the current registration period";
    case "not_registered":
      return "Not registered for GST";
    case "outside_registration_period":
      return "Outside the GST registration period";
    case "evidence_missing":
      return "Evidence required before claiming";
    case "not_claimable":
      return "Treatment does not produce a GST credit";
    default:
      return "GST treatment needs review";
  }
}
