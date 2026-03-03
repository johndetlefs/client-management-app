"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentUserTenantId } from "@/lib/tenant";
import {
    formatCurrency,
    formatDate,
    getQuoteStatusColor,
    getQuoteStatusLabel,
} from "@/lib/invoice-utils";
import { getBillableUnitLabel } from "@/types/jobItem";
import { Quote } from "@/types/quote";
import { getQuoteForEdit } from "../../actions";
import { getTenantSettings } from "@/app/workspace/settings/actions";
import { TenantSettings } from "@/types/tenant";

export default function QuotePrintPage() {
    const { user } = useAuth();
    const params = useParams();
    const quoteId = params.id as string;

    const [quote, setQuote] = useState<Quote | null>(null);
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [taxLabel, setTaxLabel] = useState("Tax");

    useEffect(() => {
        const loadData = async () => {
            if (!user) {
                setLoading(false);
                setError("You must be signed in to view this quote.");
                return;
            }

            setLoading(true);
            setError("");

            const tenantId = await getCurrentUserTenantId();
            if (!tenantId) {
                setLoading(false);
                setError("Unable to determine your tenant.");
                return;
            }

            const settingsResult = await getTenantSettings(tenantId);
            if (settingsResult.success) {
                setSettings(settingsResult.data || null);
            }

            if (
                settingsResult.success &&
                settingsResult.data?.tax?.taxType &&
                settingsResult.data.tax.taxType !== "None"
            ) {
                setTaxLabel(settingsResult.data.tax.taxType);
            }

            const result = await getQuoteForEdit(tenantId, user.uid, quoteId);
            if (!result.success) {
                setError(result.error);
                setLoading(false);
                return;
            }

            setQuote(result.data);
            setLoading(false);
        };

        loadData();
    }, [quoteId, user]);

    if (loading) {
        return (
            <div className="p-8 text-center">
                <p>Loading quote...</p>
            </div>
        );
    }

    if (error || !quote) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-2">Error</h2>
                <p className="text-foreground/60">{error || "Quote not found"}</p>
            </div>
        );
    }

    const hasTaxColumn = quote.lines?.some((line) => line.gstApplicable) || false;
    const quoteTerms = settings?.quoteTerms || settings?.invoiceTerms;
    const quoteFooter = settings?.quoteFooter || settings?.invoiceFooter;

    return (
        <>
            <style jsx global>{`
        header {
          display: none !important;
        }

        @media print {
          @page {
            margin: 0.5in;
            size: A4;
          }

          .no-print {
            display: none !important;
          }

          .quote-container {
            box-shadow: none !important;
          }

          tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          thead {
            display: table-header-group;
          }
        }

        @media screen {
          .quote-container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
            min-height: 297mm;
          }
        }
      `}</style>

            <div className="no-print fixed top-4 right-4 z-50">
                <button
                    onClick={() => window.print()}
                    className="px-6 py-3 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg"
                >
                    Print / Save as PDF
                </button>
            </div>

            <div className="quote-container p-8 md:p-12">
                <div className="flex justify-between mb-8">
                    <div>
                        <h2 className="text-3xl font-bold mb-2">QUOTE</h2>
                        <div className="space-y-1 text-sm">
                            <p>
                                <span className="font-semibold">Quote #:</span>{" "}
                                {quote.quoteDisplayNumber || quote.quoteNumber || "Draft"}
                            </p>
                            <p>
                                <span className="font-semibold">Created:</span>{" "}
                                {formatDate(
                                    quote.createdAt instanceof Date ? quote.createdAt : new Date(),
                                )}
                            </p>
                        </div>
                    </div>
                    <div>
                        <span
                            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getQuoteStatusColor(
                                quote.status,
                            )}`}
                        >
                            {getQuoteStatusLabel(quote.status)}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <h3 className="font-semibold text-sm text-foreground/60 mb-2">FROM</h3>
                        <div className="text-sm">
                            <p className="font-semibold">{settings?.businessName || "Company"}</p>
                            {settings?.abn && (
                                <p className="text-foreground/60">ABN: {settings.abn}</p>
                            )}
                            {settings?.address && (
                                <p className="text-foreground/60">{settings.address}</p>
                            )}
                            {settings?.phone && (
                                <p className="text-foreground/60">{settings.phone}</p>
                            )}
                            {settings?.email && (
                                <p className="text-foreground/60">{settings.email}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-sm text-foreground/60 mb-2">TO</h3>
                        <p className="font-semibold text-sm">{quote.clientName}</p>
                        {quote.jobTitle && (
                            <p className="text-sm text-foreground/60 mt-1">Job: {quote.jobTitle}</p>
                        )}
                    </div>
                </div>

                <div className="mb-8">
                    <table className="w-full table-auto">
                        <thead>
                            <tr className="border-b-2 border-foreground/20">
                                <th className="text-left py-3 px-2 font-semibold uppercase text-sm w-2/5">
                                    Description
                                </th>
                                <th className="text-right py-3 px-2 font-semibold uppercase text-sm whitespace-nowrap">
                                    Price
                                </th>
                                <th className="text-center py-3 px-2 font-semibold uppercase text-sm whitespace-nowrap">
                                    Qty
                                </th>
                                <th className="text-center py-3 px-2 font-semibold uppercase text-sm whitespace-nowrap">
                                    Unit
                                </th>
                                <th className="text-right py-3 px-2 font-semibold uppercase text-sm whitespace-nowrap">
                                    Subtotal
                                </th>
                                {hasTaxColumn && (
                                    <th className="text-right py-3 px-2 font-semibold uppercase text-sm whitespace-nowrap">
                                        {taxLabel}
                                    </th>
                                )}
                                <th className="text-right py-3 px-2 font-semibold uppercase text-sm whitespace-nowrap">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {quote.lines?.map((line) => (
                                <tr key={line.jobItemId} className="border-b border-foreground/20">
                                    <td className="py-4 px-2">
                                        <p className="font-medium">{line.title}</p>
                                        {line.description && (
                                            <p className="text-sm text-foreground/60 mt-1">{line.description}</p>
                                        )}
                                        <p className="text-xs text-foreground/50 mt-1">Job: {line.jobTitle}</p>
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
                                    <td className="py-4 px-2 text-right whitespace-nowrap tabular-nums font-medium">{formatCurrency(line.totalMinor)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="border-t pt-4 max-w-xs ml-auto space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span className="font-medium">{formatCurrency(quote.subtotalMinor || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>{taxLabel}:</span>
                        <span className="font-medium">{formatCurrency(quote.taxMinor || 0)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(quote.totalMinor)}</span>
                    </div>
                </div>

                {quote.notes && (
                    <div className="mt-10">
                        <h4 className="font-semibold mb-2">Notes</h4>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                            {quote.notes}
                        </p>
                    </div>
                )}

                {quoteTerms && (
                    <div className="mt-10 border-t pt-4">
                        <h4 className="font-semibold mb-2">Terms</h4>
                        <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                            {quoteTerms}
                        </p>
                    </div>
                )}

                {quoteFooter && (
                    <div className="mt-12 pt-6 border-t border-foreground/10 text-center">
                        <p className="text-sm text-foreground/60">{quoteFooter}</p>
                    </div>
                )}
            </div>
        </>
    );
}
