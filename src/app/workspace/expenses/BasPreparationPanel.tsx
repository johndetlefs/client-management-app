"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { BasPreparationSummary } from "@/lib/expenses/bas";
import type {
  BasAccountingBasis,
  BasPreparationSettings,
  BasReportingCadence,
} from "@/types/tenant";

import { formatMoney } from "./ExpenseAccountingForm";
import type { BasPreparationContext } from "./bas-actions";

export function BasPreparationPanel({
  context,
  selectedPeriodStart,
  summary,
  saving,
  loading,
  onPeriod,
  onSaveSettings,
  onPrepare,
}: {
  context: BasPreparationContext;
  selectedPeriodStart: string;
  summary: BasPreparationSummary | null;
  saving: boolean;
  loading: boolean;
  onPeriod: (periodStart: string) => void;
  onSaveSettings: (settings: BasPreparationSettings) => Promise<void>;
  onPrepare: () => Promise<void>;
}) {
  const [basis, setBasis] = useState<BasAccountingBasis | "">(
    context.settings?.accountingBasis || "",
  );
  const [cadence, setCadence] = useState<BasReportingCadence | "">(
    context.settings?.cadence || "",
  );

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-foreground">
              BAS preparation settings
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Choose the settings recorded with the ATO. The app does not infer
              them or lodge your BAS.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] sm:items-end">
            <label className="text-sm font-medium text-foreground">
              GST accounting basis
              <select
                value={basis}
                disabled={!context.canManageSettings}
                onChange={(event) =>
                  setBasis(event.target.value as BasAccountingBasis | "")
                }
                className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">Choose basis</option>
                <option value="cash">Cash</option>
                <option value="non_cash">Non-cash</option>
              </select>
            </label>
            <label className="text-sm font-medium text-foreground">
              BAS cadence
              <select
                value={cadence}
                disabled={!context.canManageSettings}
                onChange={(event) =>
                  setCadence(event.target.value as BasReportingCadence | "")
                }
                className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">Choose cadence</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
            {context.canManageSettings && (
              <Button
                disabled={!basis || !cadence || saving}
                onClick={() =>
                  basis &&
                  cadence &&
                  void onSaveSettings({
                    accountingBasis: basis,
                    cadence,
                    reportingMethod: "simpler_bas",
                  })
                }
                className="min-h-10 whitespace-nowrap"
              >
                {saving ? "Saving..." : "Save settings"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {context.settings ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-64 text-sm font-medium text-foreground">
              Reporting period
              <select
                value={selectedPeriodStart}
                onChange={(event) => onPeriod(event.target.value)}
                className="mt-1 block min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {context.periods.map((period) => (
                  <option key={period.startDate} value={period.startDate}>
                    {period.label} ({period.startDate} to {period.endDate})
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={!selectedPeriodStart || loading}
              onClick={() => void onPrepare()}
              className="min-h-10"
            >
              {loading ? "Preparing..." : "Prepare summary"}
            </Button>
          </div>

          {summary ? (
            <BasSummaryView summary={summary} />
          ) : (
            <div className="border-l-4 border-zinc-400 bg-white px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
              Select a period and prepare the summary.
            </div>
          )}
        </>
      ) : (
        <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Choose both settings before preparing BAS figures.
        </div>
      )}
    </div>
  );
}

function BasSummaryView({ summary }: { summary: BasPreparationSummary }) {
  const basAmountsAvailable = summary.g1TotalSalesMinor !== null;
  return (
    <div className="space-y-6">
      <div className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        Preparation support only. Check these figures and your ATO activity
        statement with your accountant before lodging.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryAmount
          label="Operational income"
          value={summary.operationalIncomeMinor}
        />
        <SummaryAmount
          label="Business purchases"
          value={summary.operationalPurchasesMinor}
        />
        <SummaryAmount
          label="Potential purchase GST"
          value={summary.potentialGstOnPurchasesMinor}
        />
        <SummaryAmount
          label="Review-needed GST"
          value={summary.reviewNeededGstMinor}
        />
      </div>

      {basAmountsAvailable ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryAmount label="G1 Total sales" value={summary.g1TotalSalesMinor} />
          <SummaryAmount
            label="1A GST on sales"
            value={summary.oneAGstOnSalesMinor}
          />
          <SummaryAmount
            label="1B GST on purchases"
            value={summary.oneBGstOnPurchasesMinor}
          />
          <SummaryAmount label="Net GST" value={summary.netGstMinor} />
        </div>
      ) : (
        <div className="border-l-4 border-zinc-400 bg-white px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          BAS label and net-GST amounts are unavailable for this configuration
          and evidence state.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="text-base font-semibold text-foreground">
            GST purchase buckets
          </h3>
          <dl className="mt-3 divide-y divide-zinc-200 border-y border-zinc-200 text-sm dark:divide-zinc-800 dark:border-zinc-800">
            <SummaryLine
              label="Currently claimable"
              value={summary.oneBGstOnPurchasesMinor}
            />
            <SummaryLine
              label="Non-claimable"
              value={summary.nonClaimableGstMinor}
            />
            <SummaryLine
              label="Needs review"
              value={summary.reviewNeededGstMinor}
            />
          </dl>
        </section>
        <section>
          <h3 className="text-base font-semibold text-foreground">
            Review status
          </h3>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {summary.reviewNeededCount} {summary.version === "bas-dated-cash-v2" ? "review item" : "expense"}
            {summary.reviewNeededCount === 1 ? "" : "s"} need review.{" "}
            {summary.includedInvoiceCount} issued invoice
            {summary.includedInvoiceCount === 1 ? "" : "s"} contribute to the
            supported income view.
          </p>
          {summary.reviewReasons.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {summary.reviewReasons.map((reason) => (
                <li key={reason} className="border-l-2 border-amber-500 pl-3">
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryAmount({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <Card className="p-4">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">{label}</div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-foreground">
        {value === null ? "Unavailable" : formatMoney(value, "AUD")}
      </div>
    </Card>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">
        {value === null ? "Unavailable" : formatMoney(value, "AUD")}
      </dd>
    </div>
  );
}
