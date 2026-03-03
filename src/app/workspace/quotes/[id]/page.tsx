"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUserTenantId } from "@/lib/tenant";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
    formatCurrency,
    formatDate,
    getQuoteStatusColor,
    getQuoteStatusLabel,
} from "@/lib/invoice-utils";
import { getBillableUnitLabel } from "@/types/jobItem";
import { Quote } from "@/types/quote";
import {
    getQuoteForEdit,
    regenerateQuotePublicToken,
    updateQuoteDetails,
    updateQuoteStatus,
} from "../actions";
import { getTenantSettings } from "@/app/workspace/settings/actions";

export default function QuoteDetailPage() {
    const { user } = useAuth();
    const params = useParams();
    const quoteId = params.id as string;

    const [tenantId, setTenantId] = useState<string | null>(null);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [regeneratingToken, setRegeneratingToken] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quoteDisplayNumber, setQuoteDisplayNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [taxLabel, setTaxLabel] = useState("Tax");

    const canEdit = quote?.status === "draft";
    const hasTaxColumn = quote?.lines?.some((line) => line.gstApplicable) || false;

    useEffect(() => {
        const loadQuote = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            const resolvedTenantId = await getCurrentUserTenantId();
            if (!resolvedTenantId) {
                setError("Unable to determine your tenant");
                setLoading(false);
                return;
            }

            setTenantId(resolvedTenantId);

            const settingsResult = await getTenantSettings(resolvedTenantId);
            if (
                settingsResult.success &&
                settingsResult.data?.tax?.taxType &&
                settingsResult.data.tax.taxType !== "None"
            ) {
                setTaxLabel(settingsResult.data.tax.taxType);
            } else {
                setTaxLabel("Tax");
            }

            const result = await getQuoteForEdit(resolvedTenantId, user.uid, quoteId);
            if (!result.success) {
                setError(result.error);
                setLoading(false);
                return;
            }

            setQuote(result.data);
            setQuoteDisplayNumber(
                result.data.quoteDisplayNumber || result.data.quoteNumber || "",
            );
            setNotes(result.data.notes || "");
            setLoading(false);
        };

        loadQuote();
    }, [quoteId, user]);

    const hasChanges = useMemo(() => {
        if (!quote) {
            return false;
        }

        const currentDisplay = quote.quoteDisplayNumber || quote.quoteNumber || "";
        const currentNotes = quote.notes || "";
        return (
            quoteDisplayNumber.trim() !== currentDisplay.trim() ||
            notes.trim() !== currentNotes.trim()
        );
    }, [notes, quote, quoteDisplayNumber]);

    const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!tenantId || !user || !quote || !canEdit) {
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const result = await updateQuoteDetails(tenantId, user.uid, quote.id, {
                quoteDisplayNumber,
                notes,
            });

            if (!result.success) {
                setError(result.error);
                return;
            }

            setQuote(result.data);
            setQuoteDisplayNumber(
                result.data.quoteDisplayNumber || result.data.quoteNumber || "",
            );
            setNotes(result.data.notes || "");
            alert("Quote updated successfully.");
        } catch (updateError) {
            console.error("Error updating quote:", updateError);
            setError("Failed to update quote");
        } finally {
            setSaving(false);
        }
    };

    const handleStatusChange = async (nextStatus: "sent" | "accepted" | "cancelled") => {
        if (!tenantId || !user || !quote) {
            return;
        }

        const confirmationMessage =
            nextStatus === "sent"
                ? "Mark this quote as sent?"
                : nextStatus === "accepted"
                    ? "Mark this quote as accepted?"
                    : "Cancel this quote?";

        if (!confirm(confirmationMessage)) {
            return;
        }

        setUpdatingStatus(true);
        setError(null);

        try {
            const result = await updateQuoteStatus(tenantId, user.uid, quote.id, nextStatus);
            if (!result.success) {
                setError(result.error);
                return;
            }

            setQuote(result.data);
        } catch (statusError) {
            console.error("Error updating quote status:", statusError);
            setError("Failed to update quote status");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleRegeneratePublicLink = async () => {
        if (!tenantId || !user || !quote) {
            return;
        }

        if (!confirm("Regenerate public link? The old link will stop working immediately.")) {
            return;
        }

        setRegeneratingToken(true);
        setError(null);

        try {
            const result = await regenerateQuotePublicToken(tenantId, user.uid, quote.id);
            if (!result.success) {
                setError(result.error);
                return;
            }

            setQuote(result.data);
            alert("Public link regenerated successfully.");
        } catch (tokenError) {
            console.error("Error regenerating public quote link:", tokenError);
            setError("Failed to regenerate public link");
        } finally {
            setRegeneratingToken(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <p>Loading quote...</p>
            </div>
        );
    }

    if (!quote) {
        return (
            <div className="p-8 max-w-3xl mx-auto">
                <Card className="p-8 text-center">
                    <h1 className="text-2xl font-bold mb-2">Quote Not Found</h1>
                    <p className="text-foreground/70 mb-4">
                        {error || "This quote does not exist or you do not have access."}
                    </p>
                    <Link href="/workspace/quotes">
                        <Button>Back to Quotes</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="mb-6">
                <Link href="/workspace/quotes" className="text-blue-600 hover:underline mb-2 inline-block">
                    ← Back to Quotes
                </Link>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">
                            {quote.quoteDisplayNumber || quote.quoteNumber || "Draft Quote"}
                        </h1>
                        <p className="text-gray-600 mt-1">{quote.clientName}</p>
                    </div>
                    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded ${getQuoteStatusColor(quote.status)}`}>
                        {getQuoteStatusLabel(quote.status)}
                    </span>
                </div>
            </div>

            {error && (
                <Card className="mb-6 p-4 border-red-200 dark:border-red-800">
                    <p className="text-red-600 dark:text-red-400">{error}</p>
                </Card>
            )}

            {quote.publicToken && (
                <Card className="p-6 mb-6">
                    <h3 className="font-semibold mb-2">Public Quote Link</h3>
                    <p className="text-sm text-gray-600 mb-3">
                        Share this link with your client to allow them to view the quote online.
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}/public/quote/${quote.publicToken}`}
                            className="flex-1 px-3 py-2 border rounded-md bg-gray-50 text-sm font-mono"
                            onClick={(event) => event.currentTarget.select()}
                        />
                        <Button
                            variant="secondary"
                            onClick={() => {
                                const url = `${window.location.origin}/public/quote/${quote.publicToken}`;
                                navigator.clipboard.writeText(url);
                                alert("Link copied to clipboard!");
                            }}
                        >
                            Copy Link
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleRegeneratePublicLink}
                            disabled={regeneratingToken}
                        >
                            {regeneratingToken ? "Regenerating..." : "Regenerate Link"}
                        </Button>
                    </div>
                    {quote.viewedAt && quote.viewedAt instanceof Date && (
                        <p className="text-xs text-foreground/60 mt-2">
                            First viewed: {formatDate(quote.viewedAt)}
                        </p>
                    )}
                </Card>
            )}

            <Card className="p-6 mb-6">
                <form onSubmit={handleSave}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Quote Number"
                            value={quoteDisplayNumber}
                            onChange={(event) => setQuoteDisplayNumber(event.target.value)}
                            disabled={!canEdit || saving}
                            maxLength={40}
                            required
                        />

                        <div>
                            <p className="text-sm font-medium text-foreground mb-2">Created</p>
                            <p className="text-sm text-foreground/80">
                                {formatDate(quote.createdAt instanceof Date ? quote.createdAt : new Date())}
                            </p>
                            {quote.acceptedAt && (
                                <p className="text-sm text-foreground/80 mt-2">
                                    <span className="font-medium">Accepted:</span>{" "}
                                    {formatDate(
                                        quote.acceptedAt instanceof Date
                                            ? quote.acceptedAt
                                            : new Date(),
                                    )}
                                </p>
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium mb-2">Notes</label>
                            <textarea
                                value={notes}
                                onChange={(event) => setNotes(event.target.value)}
                                disabled={!canEdit || saving}
                                rows={4}
                                maxLength={2000}
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20 bg-white dark:bg-zinc-900"
                                placeholder="Optional notes for this quote"
                            />
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t flex items-center justify-between gap-3">
                        <p className="text-sm text-foreground/70">
                            {canEdit
                                ? "Draft quotes are editable."
                                : "This quote is no longer editable."}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() =>
                                    window.open(`/workspace/quotes/${quote.id}/print`, "_blank")
                                }
                            >
                                Preview / Print
                            </Button>
                            {quote.status === "draft" && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleStatusChange("sent")}
                                    disabled={saving || updatingStatus}
                                >
                                    Mark as Sent
                                </Button>
                            )}
                            {quote.status === "sent" && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleStatusChange("accepted")}
                                    disabled={saving || updatingStatus}
                                >
                                    Mark as Accepted
                                </Button>
                            )}
                            {quote.status !== "cancelled" && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => handleStatusChange("cancelled")}
                                    disabled={saving || updatingStatus}
                                >
                                    Cancel Quote
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={!canEdit || saving || updatingStatus || !hasChanges}
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>

            <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Line Items</h2>
                {!quote.lines || quote.lines.length === 0 ? (
                    <p className="text-gray-500">No line items in this quote.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                            <thead className="border-b">
                                <tr className="text-left text-sm text-gray-600">
                                    <th className="pb-3 px-2 w-2/5">Description</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Price</th>
                                    <th className="pb-3 px-2 text-center whitespace-nowrap">Qty</th>
                                    <th className="pb-3 px-2 text-center whitespace-nowrap">Unit</th>
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Subtotal</th>
                                    {hasTaxColumn && (
                                        <th className="pb-3 px-2 text-right whitespace-nowrap">
                                            {taxLabel}
                                        </th>
                                    )}
                                    <th className="pb-3 px-2 text-right whitespace-nowrap">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quote.lines.map((line) => (
                                    <tr key={line.jobItemId} className="border-b border-foreground/20">
                                        <td className="py-4 px-2">
                                            <p className="font-medium">{line.title}</p>
                                            {line.description && (
                                                <p className="text-sm text-gray-600">{line.description}</p>
                                            )}
                                            <p className="text-xs text-gray-500">Job: {line.jobTitle}</p>
                                        </td>
                                        <td className="py-4 px-2 text-right whitespace-nowrap tabular-nums">{formatCurrency(line.unitPriceMinor)}</td>
                                        <td className="py-4 px-2 text-center">{line.quantity}</td>
                                        <td className="py-4 px-2 text-center">
                                            {getBillableUnitLabel(line.unit, line.quantity)}
                                        </td>
                                        <td className="py-4 px-2 text-right whitespace-nowrap tabular-nums">{formatCurrency(line.subtotalMinor)}</td>
                                        {hasTaxColumn && (
                                            <td className="py-4 px-2 text-right whitespace-nowrap tabular-nums">
                                                {line.gstApplicable && line.taxMinor > 0
                                                    ? formatCurrency(line.taxMinor)
                                                    : "—"}
                                            </td>
                                        )}
                                        <td className="py-4 px-2 text-right whitespace-nowrap tabular-nums font-medium">
                                            {formatCurrency(line.totalMinor)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="mt-6 pt-4 border-t max-w-sm ml-auto space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium">{formatCurrency(quote.subtotalMinor || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{taxLabel}:</span>
                        <span className="font-medium">{formatCurrency(quote.taxMinor || 0)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                        <span>Total:</span>
                        <span>{formatCurrency(quote.totalMinor)}</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
