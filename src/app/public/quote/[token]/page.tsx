'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getQuoteByToken, getTenantSettingsForPublicQuote } from './actions';
import { Quote } from '@/types/quote';
import {
    formatCurrency,
    formatDate,
    getQuoteStatusColor,
    getQuoteStatusLabel,
} from '@/lib/invoice-utils';
import { getBillableUnitLabel } from '@/types/jobItem';

export default function PublicQuotePage() {
    const params = useParams();
    const token = params.token as string;
    const [quote, setQuote] = useState<Quote | null>(null);
    const [tenantSettings, setTenantSettings] = useState<{
        businessName?: string;
        abn?: string;
        address?: string;
        phone?: string;
        email?: string;
        taxLabel?: string;
        logoUrl?: string;
        quoteTerms?: string;
        quoteFooter?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadQuote() {
            setLoading(true);
            setError('');

            const result = await getQuoteByToken(token);

            if (result.success && result.data) {
                setQuote(result.data);

                const settingsResult = await getTenantSettingsForPublicQuote(result.data.tenantId);
                if (settingsResult.success) {
                    setTenantSettings(settingsResult.data);
                }
            } else {
                setError('error' in result ? result.error : 'Quote not found');
            }

            setLoading(false);
        }

        if (token) {
            loadQuote();
        }
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
                    <p className="text-foreground/60">Loading quote...</p>
                </div>
            </div>
        );
    }

    if (error || !quote) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="mb-4">
                        <svg className="h-16 w-16 text-foreground/40 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Quote Not Found</h2>
                    <p className="text-foreground/60">{error || 'The quote you\'re looking for could not be found or the link may have expired.'}</p>
                </div>
            </div>
        );
    }

    const taxLabel = tenantSettings?.taxLabel || 'GST';
    const hasTaxColumn = quote.lines?.some((line) => line.gstApplicable) || false;

    return (
        <div className="min-h-screen bg-background/50">
            <div className="bg-background border-b border-foreground/10 print-hide">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {tenantSettings?.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={tenantSettings.logoUrl}
                                alt="Company logo"
                                className="h-10 object-contain"
                            />
                        )}
                        <div>
                            <h1 className="text-lg font-semibold">
                                {tenantSettings?.businessName || 'Quote'}
                            </h1>
                            <p className="text-sm text-foreground/60">
                                Quote {quote.quoteDisplayNumber || quote.quoteNumber}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors flex items-center gap-2"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 print-content">
                <div className="bg-background rounded-lg shadow-sm border border-foreground/10 p-8 quote-container">
                    <div className="flex justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">QUOTE</h2>
                            <div className="space-y-1 text-sm">
                                <p>
                                    <span className="font-semibold">Quote #:</span>{' '}
                                    {quote.quoteDisplayNumber || quote.quoteNumber || 'Draft'}
                                </p>
                                {quote.createdAt && (
                                    <p>
                                        <span className="font-semibold">Created:</span>{' '}
                                        {formatDate(quote.createdAt as Date)}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getQuoteStatusColor(quote.status)}`}>
                                {getQuoteStatusLabel(quote.status)}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h3 className="font-semibold text-sm text-foreground/60 mb-2">FROM</h3>
                            <div className="text-sm">
                                <p className="font-semibold">{tenantSettings?.businessName || 'Company'}</p>
                                {tenantSettings?.abn && (
                                    <p className="text-foreground/60">
                                        ABN: {tenantSettings.abn}
                                    </p>
                                )}
                                {tenantSettings?.address && (
                                    <p className="text-foreground/60">{tenantSettings.address}</p>
                                )}
                                {tenantSettings?.phone && (
                                    <p className="text-foreground/60">{tenantSettings.phone}</p>
                                )}
                                {tenantSettings?.email && (
                                    <p className="text-foreground/60">{tenantSettings.email}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-sm text-foreground/60 mb-2">TO</h3>
                            <div className="text-sm">
                                <p className="font-semibold">{quote.clientName}</p>
                                {quote.jobTitle && (
                                    <p className="text-foreground/60">Job: {quote.jobTitle}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mb-8">
                        <table className="w-full table-auto">
                            <thead>
                                <tr className="border-b border-foreground/20">
                                    <th className="text-left py-3 font-semibold text-sm w-2/5">Description</th>
                                    <th className="text-right py-3 font-semibold text-sm whitespace-nowrap">Price</th>
                                    <th className="text-center py-3 font-semibold text-sm whitespace-nowrap">Qty</th>
                                    <th className="text-center py-3 font-semibold text-sm whitespace-nowrap">Unit</th>
                                    <th className="text-right py-3 font-semibold text-sm whitespace-nowrap">Subtotal</th>
                                    {hasTaxColumn && (
                                        <th className="text-right py-3 font-semibold text-sm whitespace-nowrap">{taxLabel}</th>
                                    )}
                                    <th className="text-right py-3 font-semibold text-sm whitespace-nowrap">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quote.lines?.map((line, index) => (
                                    <tr key={index} className="border-b border-foreground/10">
                                        <td className="py-3">
                                            <div>
                                                <p className="font-medium">{line.title}</p>
                                                {line.description && (
                                                    <p className="text-sm text-foreground/60">{line.description}</p>
                                                )}
                                                <p className="text-xs text-foreground/50 mt-1">Job: {line.jobTitle}</p>
                                            </div>
                                        </td>
                                        <td className="text-right py-3 whitespace-nowrap tabular-nums">
                                            <span className="text-sm">{formatCurrency(line.unitPriceMinor)}</span>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="text-sm">{line.quantity}</span>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="text-sm">{getBillableUnitLabel(line.unit, line.quantity)}</span>
                                        </td>
                                        <td className="text-right py-3 whitespace-nowrap tabular-nums">
                                            <span className="text-sm">{formatCurrency(line.subtotalMinor)}</span>
                                        </td>
                                        {hasTaxColumn && (
                                            <td className="text-right py-3 whitespace-nowrap tabular-nums">
                                                <span className="text-sm">
                                                    {line.gstApplicable && line.taxMinor > 0 ? formatCurrency(line.taxMinor) : '—'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="text-right py-3 whitespace-nowrap tabular-nums">
                                            <span className="font-medium">{formatCurrency(line.totalMinor)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end mb-8">
                        <div className="w-80 space-y-2">
                            <div className="flex justify-between py-1">
                                <span className="text-foreground/60">Subtotal:</span>
                                <span className="font-medium">{formatCurrency(quote.subtotalMinor || 0)}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-foreground/10 pb-2">
                                <span className="text-foreground/60">{taxLabel}:</span>
                                <span className="font-medium">{formatCurrency(quote.taxMinor || 0)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-t border-foreground/20">
                                <span className="font-bold">Total:</span>
                                <span className="font-bold text-lg">{formatCurrency(quote.totalMinor)}</span>
                            </div>
                        </div>
                    </div>

                    {tenantSettings?.quoteTerms && (
                        <div className="mb-6">
                            <h3 className="font-semibold mb-2">Terms</h3>
                            <p className="text-sm text-foreground/70 whitespace-pre-wrap">{tenantSettings.quoteTerms}</p>
                        </div>
                    )}

                    {quote.notes && (
                        <div className="mb-6">
                            <h3 className="font-semibold mb-2">Notes</h3>
                            <p className="text-sm text-foreground/70 whitespace-pre-wrap">{quote.notes}</p>
                        </div>
                    )}

                    {tenantSettings?.quoteFooter && (
                        <div className="mt-12 pt-6 border-t border-foreground/10 text-center">
                            <p className="text-sm text-foreground/60">{tenantSettings.quoteFooter}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
