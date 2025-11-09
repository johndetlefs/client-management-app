'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getInvoiceByToken, getTenantSettingsForPublicInvoice } from './actions';
import { Invoice } from '@/types/invoice';
import { formatCurrency, formatDate, formatTaxRate, getStatusLabel, getStatusColor } from '@/lib/invoice-utils';
import { getBillableUnitLabel } from '@/types/jobItem';

export default function PublicInvoicePage() {
    const params = useParams();
    const token = params.token as string;
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [tenantSettings, setTenantSettings] = useState<{
        businessName?: string;
        abn?: string;
        address?: string;
        phone?: string;
        email?: string;
        taxLabel?: string;
        logoUrl?: string;
        bankAccount?: {
            accountName?: string;
            bsb?: string;
            accountNumber?: string;
        };
        invoiceTerms?: string;
        invoiceFooter?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadInvoice() {
            setLoading(true);
            setError('');

            const result = await getInvoiceByToken(token);

            if (result.success && result.data) {
                setInvoice(result.data);

                // Fetch tenant settings for branding
                const settingsResult = await getTenantSettingsForPublicInvoice(result.data.tenantId);
                if (settingsResult.success) {
                    console.log('Tenant settings loaded:', settingsResult.data);
                    setTenantSettings(settingsResult.data);
                } else {
                    console.error('Failed to load tenant settings:', settingsResult);
                }
            } else {
                setError('error' in result ? result.error : 'Invoice not found');
            }

            setLoading(false);
        }

        if (token) {
            loadInvoice();
        }
    }, [token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
                    <p className="text-foreground/60">Loading invoice...</p>
                </div>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="mb-4">
                        <svg className="h-16 w-16 text-foreground/40 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Invoice Not Found</h2>
                    <p className="text-foreground/60">{error || 'The invoice you\'re looking for could not be found or the link may have expired.'}</p>
                </div>
            </div>
        );
    }

    const taxLabel = tenantSettings?.taxLabel || 'GST';

    return (
        <div className="min-h-screen bg-background/50">
            {/* Header Bar */}
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
                                {tenantSettings?.businessName || 'Invoice'}
                            </h1>
                            <p className="text-sm text-foreground/60">
                                Invoice {invoice.invoiceDisplayNumber || invoice.invoiceNumber}
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

            {/* Invoice Content */}
            <div className="max-w-4xl mx-auto px-4 py-8 print-content">
                <div className="bg-background rounded-lg shadow-sm border border-foreground/10 p-8 invoice-container">
                    {/* Invoice Header */}
                    <div className="flex justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold mb-2">INVOICE</h2>
                            <div className="space-y-1 text-sm">
                                <p>
                                    <span className="font-semibold">Invoice #:</span>{' '}
                                    {invoice.invoiceDisplayNumber || invoice.invoiceNumber || 'Draft'}
                                </p>
                                {invoice.issueDate && (
                                    <p>
                                        <span className="font-semibold">Issue Date:</span>{' '}
                                        {formatDate(invoice.issueDate as Date)}
                                    </p>
                                )}
                                {invoice.dueDate && (
                                    <p>
                                        <span className="font-semibold">Due Date:</span>{' '}
                                        {formatDate(invoice.dueDate as Date)}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(invoice.status)}`}>
                                {getStatusLabel(invoice.status)}
                            </span>
                        </div>
                    </div>

                    {/* Company and Client Info */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        {/* From */}
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

                        {/* To */}
                        <div>
                            <h3 className="font-semibold text-sm text-foreground/60 mb-2">TO</h3>
                            <div className="text-sm">
                                <p className="font-semibold">{invoice.clientName}</p>
                                {invoice.clientEmail && (
                                    <p className="text-foreground/60">{invoice.clientEmail}</p>
                                )}
                                {invoice.clientAbn && (
                                    <p className="text-foreground/60">ABN: {invoice.clientAbn}</p>
                                )}
                                {invoice.clientAddress && (
                                    <div className="text-foreground/60 mt-1">
                                        {invoice.clientAddress.street && <p>{invoice.clientAddress.street}</p>}
                                        {(invoice.clientAddress.city || invoice.clientAddress.state || invoice.clientAddress.postcode) && (
                                            <p>
                                                {[invoice.clientAddress.city, invoice.clientAddress.state, invoice.clientAddress.postcode]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                            </p>
                                        )}
                                        {invoice.clientAddress.country && <p>{invoice.clientAddress.country}</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="mb-8">
                        <table className="w-full table-fixed">
                            <thead>
                                <tr className="border-b border-foreground/20">
                                    <th className="text-left py-3 font-semibold text-sm" style={{ width: '40%' }}>Description</th>
                                    <th className="text-center py-3 font-semibold text-sm" style={{ width: '10%' }}>Price</th>
                                    <th className="text-center py-3 font-semibold text-sm" style={{ width: '8%' }}>Qty</th>
                                    <th className="text-center py-3 font-semibold text-sm" style={{ width: '10%' }}>Unit</th>
                                    <th className="text-center py-3 font-semibold text-sm" style={{ width: '11%' }}>Subtotal</th>
                                    <th className="text-center py-3 font-semibold text-sm" style={{ width: '10%' }}>{taxLabel}</th>
                                    <th className="text-center py-3 font-semibold text-sm" style={{ width: '11%' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.lines.map((line, index) => (
                                    <tr key={index} className="border-b border-foreground/10">
                                        <td className="py-3">
                                            <div>
                                                <p className="font-medium">{line.title}</p>
                                                {line.description && (
                                                    <p className="text-sm text-foreground/60">{line.description}</p>
                                                )}
                                                <p className="text-xs text-foreground/50 mt-1">
                                                    Job: {line.jobTitle}
                                                    {!line.gstApplicable && ` • ${taxLabel} exempt`}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="text-sm">{formatCurrency(line.unitPriceMinor)}</span>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="text-sm">{line.quantity}</span>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="text-sm">{getBillableUnitLabel(line.unit, line.quantity)}</span>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="text-sm">{formatCurrency(line.subtotalMinor)}</span>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="text-sm">
                                                {line.gstApplicable && line.taxMinor > 0 ? formatCurrency(line.taxMinor) : '—'}
                                            </span>
                                        </td>
                                        <td className="text-center py-3">
                                            <span className="font-medium">{formatCurrency(line.totalMinor)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end mb-8 totals-section">
                        <div className="w-80 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-foreground/60">Subtotal:</span>
                                <span className="font-medium">{formatCurrency(invoice.subtotalMinor)}</span>
                            </div>
                            {invoice.taxBreakdown.map((taxItem, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                    <span className="text-foreground/60">
                                        {taxLabel} ({formatTaxRate(taxItem.rate)}):
                                    </span>
                                    <span className="font-medium">{formatCurrency(taxItem.taxMinor)}</span>
                                </div>
                            ))}
                            <div className="border-t border-foreground/20 pt-2 flex justify-between">
                                <span className="font-bold">Total:</span>
                                <span className="font-bold text-lg">{formatCurrency(invoice.totalMinor)}</span>
                            </div>
                            {invoice.amountPaidMinor > 0 && (
                                <>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-foreground/60">Amount Paid:</span>
                                        <span className="font-medium text-green-600">
                                            -{formatCurrency(invoice.amountPaidMinor)}
                                        </span>
                                    </div>
                                    <div className="border-t border-foreground/20 pt-2 flex justify-between">
                                        <span className="font-bold">Balance Due:</span>
                                        <span className="font-bold text-lg">{formatCurrency(invoice.balanceDueMinor)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Bank Account Details */}
                    {tenantSettings?.bankAccount &&
                        (tenantSettings.bankAccount.accountName ||
                            tenantSettings.bankAccount.bsb ||
                            tenantSettings.bankAccount.accountNumber) && (
                            <div className="payment-section mb-8 p-6 bg-foreground/5 rounded-lg">
                                <h3 className="font-semibold mb-3">Payment Details</h3>
                                <div className="space-y-1 text-sm">
                                    {tenantSettings.bankAccount.accountName && (
                                        <p>
                                            <span className="font-medium">Account Name:</span>{' '}
                                            {tenantSettings.bankAccount.accountName}
                                        </p>
                                    )}
                                    {tenantSettings.bankAccount.bsb && (
                                        <p>
                                            <span className="font-medium">BSB:</span>{' '}
                                            {tenantSettings.bankAccount.bsb}
                                        </p>
                                    )}
                                    {tenantSettings.bankAccount.accountNumber && (
                                        <p>
                                            <span className="font-medium">Account Number:</span>{' '}
                                            {tenantSettings.bankAccount.accountNumber}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                    {/* Payment Terms */}
                    {tenantSettings?.invoiceTerms && (
                        <div className="mb-6">
                            <h3 className="font-semibold mb-2">Payment Terms</h3>
                            <p className="text-sm text-foreground/70 whitespace-pre-wrap">{tenantSettings.invoiceTerms}</p>
                        </div>
                    )}

                    {/* Notes */}
                    {invoice.notes && (
                        <div className="mb-6">
                            <h3 className="font-semibold mb-2">Notes</h3>
                            <p className="text-sm text-foreground/70 whitespace-pre-wrap">{invoice.notes}</p>
                        </div>
                    )}

                    {/* Payment Instructions (from invoice) */}
                    {invoice.paymentInstructions && (
                        <div className="mb-6">
                            <h3 className="font-semibold mb-2">Payment Instructions</h3>
                            <p className="text-sm text-foreground/70 whitespace-pre-wrap">{invoice.paymentInstructions}</p>
                        </div>
                    )}

                    {/* Footer */}
                    {tenantSettings?.invoiceFooter && (
                        <div className="mt-12 pt-6 border-t border-foreground/10 text-center">
                            <p className="text-sm text-foreground/60">{tenantSettings.invoiceFooter}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background: white !important;
                    }
                    
                    .bg-background\\/50 {
                        background: white !important;
                    }
                    
                    /* Hide header bar when printing */
                    .print-hide {
                        display: none !important;
                    }
                    
                    button {
                        display: none !important;
                    }
                    
                    .shadow-sm {
                        box-shadow: none !important;
                    }
                    
                    .border {
                        border: none !important;
                    }
                    
                    @page {
                        margin: 0;
                        size: A4;
                    }
                    
                    /* Remove browser print headers and footers */
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    /* Ensure proper padding on print content */
                    .print-content {
                        padding: 0.5in !important;
                    }
                    
                    /* Add padding to content instead of page margins */
                    .invoice-container {
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    
                    /* Prevent line items from breaking across pages */
                    table {
                        page-break-inside: auto;
                    }
                    
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    
                    thead {
                        display: table-header-group;
                    }
                    
                    tfoot {
                        display: table-footer-group;
                    }
                    
                    /* Keep sections together */
                    .totals-section,
                    .payment-section {
                        page-break-inside: avoid;
                    }
                    
                    /* Preserve background colors for payment details */
                    .payment-section {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
