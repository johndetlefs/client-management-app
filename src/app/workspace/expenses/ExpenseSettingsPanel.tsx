"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type {
  GstRegistrationSettings,
  GstRegistrationStatus,
} from "@/types/tenant";

import type {
  ExpenseCategoryRow,
  MerchantRuleRow,
} from "./accounting-actions";

interface ExpenseSettingsPanelProps {
  registration: GstRegistrationSettings;
  canManageSettings: boolean;
  categories: ExpenseCategoryRow[];
  merchantRules: MerchantRuleRow[];
  savingRegistration: boolean;
  savingCategoryId: string | null;
  savingMerchantRuleId: string | null;
  onSaveRegistration: (
    registration: GstRegistrationSettings,
  ) => Promise<void>;
  onSaveCategory: (input: {
    id?: string;
    name: string;
    active?: boolean;
  }) => Promise<boolean>;
  onToggleMerchantRule: (
    merchantRuleId: string,
    active: boolean,
  ) => Promise<void>;
}

export function ExpenseSettingsPanel({
  registration,
  canManageSettings,
  categories,
  merchantRules,
  savingRegistration,
  savingCategoryId,
  savingMerchantRuleId,
  onSaveRegistration,
  onSaveCategory,
  onToggleMerchantRule,
}: ExpenseSettingsPanelProps) {
  const [draftRegistration, setDraftRegistration] = useState(registration);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setDraftRegistration(registration);
  }, [registration]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-foreground">
          GST registration
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Expense credits use explicit registration dates, not invoice defaults.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-foreground">
              Registration status
            </span>
            <select
              value={draftRegistration.status}
              disabled={!canManageSettings}
              onChange={(event) => {
                const status = event.target.value as GstRegistrationStatus;
                setDraftRegistration({
                  status,
                  effectiveFrom:
                    status === "registered"
                      ? draftRegistration.effectiveFrom
                      : undefined,
                  effectiveTo:
                    status === "registered"
                      ? draftRegistration.effectiveTo
                      : undefined,
                });
              }}
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-foreground dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="unknown">Not confirmed</option>
              <option value="not_registered">Not registered</option>
              <option value="registered">Registered</option>
            </select>
          </label>

          {draftRegistration.status === "registered" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Input
                label="Registered from"
                type="date"
                disabled={!canManageSettings}
                value={draftRegistration.effectiveFrom || ""}
                onChange={(event) =>
                  setDraftRegistration({
                    ...draftRegistration,
                    effectiveFrom: event.target.value,
                  })
                }
              />
              <Input
                label="Registration ended"
                type="date"
                disabled={!canManageSettings}
                value={draftRegistration.effectiveTo || ""}
                onChange={(event) =>
                  setDraftRegistration({
                    ...draftRegistration,
                    effectiveTo: event.target.value || undefined,
                  })
                }
              />
            </div>
          )}

          {canManageSettings ? (
            <div className="flex justify-end">
              <Button
                onClick={() => void onSaveRegistration(draftRegistration)}
                disabled={
                  savingRegistration ||
                  (draftRegistration.status === "registered" &&
                    !draftRegistration.effectiveFrom)
                }
              >
                {savingRegistration ? "Saving..." : "Save registration"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Only tenant owners can change GST registration.
            </p>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-foreground">
            Expense categories
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Categories remain linked to historical expenses when deactivated.
          </p>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!newCategoryName.trim()) return;
              void onSaveCategory({ name: newCategoryName }).then((saved) => {
                if (saved) setNewCategoryName("");
              });
            }}
          >
            <Input
              aria-label="New expense category"
              value={newCategoryName}
              maxLength={80}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="New category"
              className="flex-1"
            />
            <Button type="submit" disabled={!newCategoryName.trim()}>
              Add category
            </Button>
          </form>
        </div>

        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[560px]">
            <thead className="sticky top-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {editingCategory?.id === category.id ? (
                      <Input
                        aria-label={`Rename ${category.name}`}
                        value={editingCategory.name}
                        maxLength={80}
                        onChange={(event) =>
                          setEditingCategory({
                            id: category.id,
                            name: event.target.value,
                          })
                        }
                      />
                    ) : (
                      category.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {category.active ? "Active" : "Inactive"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {editingCategory?.id === category.id ? (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => setEditingCategory(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            disabled={
                              savingCategoryId === category.id ||
                              !editingCategory.name.trim()
                            }
                            onClick={() =>
                              void onSaveCategory({
                                id: category.id,
                                name: editingCategory.name,
                                active: category.active,
                              }).then((saved) => {
                                if (saved) setEditingCategory(null);
                              })
                            }
                          >
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setEditingCategory({
                                id: category.id,
                                name: category.name,
                              })
                            }
                          >
                            Rename
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={savingCategoryId === category.id}
                            onClick={() =>
                              void onSaveCategory({
                                id: category.id,
                                name: category.name,
                                active: !category.active,
                              })
                            }
                          >
                            {category.active ? "Deactivate" : "Activate"}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden xl:col-span-2">
        <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-foreground">
            Learned merchant rules
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Active rules suggest editable defaults for future matching imports.
          </p>
        </div>

        {merchantRules.length === 0 ? (
          <div className="p-5 text-sm text-zinc-600 dark:text-zinc-400">
            No merchant rules have been learned from confirmed expenses.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">
                    Merchant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">
                    Defaults
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {merchantRules.map((rule) => (
                  <tr key={rule.id} className="align-top">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-foreground">
                        {rule.name}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {rule.normalizedMerchantKey}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {rule.categoryName}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      <div>{merchantRuleGstLabel(rule.gstTreatment)}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {rule.businessUsePercent ?? "-"}% business use
                        {rule.isSubscription ? " | Subscription" : ""}
                        {rule.isRecurring ? " | Recurring" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {rule.active ? "Active" : "Inactive"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        disabled={savingMerchantRuleId === rule.id}
                        onClick={() =>
                          void onToggleMerchantRule(rule.id, !rule.active)
                        }
                      >
                        {savingMerchantRuleId === rule.id
                          ? "Saving..."
                          : rule.active
                            ? "Deactivate"
                            : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function merchantRuleGstLabel(
  treatment: MerchantRuleRow["gstTreatment"],
): string {
  const labels: Record<
    NonNullable<MerchantRuleRow["gstTreatment"]>,
    string
  > = {
    taxable_purchase: "Taxable purchase",
    gst_claimable: "Taxable purchase",
    no_gst: "No GST",
    gst_free: "GST-free",
    input_taxed: "Input taxed",
    private_or_non_claimable: "GST not claimable",
    review_required: "GST review required",
  };
  return treatment ? labels[treatment] : "No GST default";
}
