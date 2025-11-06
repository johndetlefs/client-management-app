'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getInvoiceForPrint } from './actions';
import { Invoice } from '@/types/invoice';
import { TenantSettings } from '@/types/tenant';
import { formatCurrency, formatDate, formatTaxRate } from '@/lib/invoice-utils';
import { getBillableUnitLabel } from '@/types/jobItem';

export default function InvoicePrintPage() {
    const params = useParams();
    const invoiceId = params.id as string;
    const { tenantId } = useWorkspace();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError('');

            const result = await getInvoiceForPrint(tenantId, invoiceId);

            if (result.success && result.data) {
                setInvoice(result.data.invoice);
                setSettings(result.data.settings);
                console.log('Settings loaded:', result.data.settings);
                console.log('Tax type:', result.data.settings?.tax?.taxType);
            } else {
                setError(result.error || 'Failed to load invoice');
            }

            setLoading(false);
        }

        loadData();
    }, [invoiceId, tenantId]);

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
                <p>Loading invoice...</p>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-2">Error</h2>
                <p className="text-foreground/60">{error || 'Invoice not found'}</p>
            </div>
        );
    }

    return (
        <>
            <style jsx global>{`
                /* Base styles for print page */
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #ffffff !important;
                    background-color: #ffffff !important;
                }

                /* Hide header and main wrapper on print page */
                header {
                    display: none !important;
                }

                @media print {
                    * {
                        box-shadow: none !important;
                        -webkit-box-shadow: none !important;
                        border-left: none !important;
                        border-right: none !important;
                    }

                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        width: 100% !important;
                        overflow-x: hidden !important;
                    }

                    /* Override CSS variables for print */
                    html {
                        --background: #ffffff !important;
                        --foreground: #000000 !important;
                    }

                    @page {
                        margin: 0.5in;
                        size: A4;
                    }

                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .no-print {
                        display: none !important;
                    }

                    .page-break {
                        page-break-after: always;
                    }

                    /* Remove all shadows and ensure full width */
                    .invoice-container {
                        box-shadow: none !important;
                        -webkit-box-shadow: none !important;
                        margin: 0 !important;
                        padding: 1rem !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        background: #ffffff !important;
                        background-color: #ffffff !important;
                        border: none !important;
                    }

                    /* Pagination improvements */
                    /* Prevent line items from breaking across pages */
                    tbody tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Repeat table headers on each page */
                    thead {
                        display: table-header-group;
                    }

                    /* Keep totals section together */
                    .totals-section {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Keep payment details and footer together */
                    .payment-section,
                    .footer-section {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Prevent orphaned headers */
                    h3 {
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                }

                @media screen {
                    .invoice-container {
                        max-width: 210mm;
                        margin: 0 auto;
                        background: white;
                        box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
                        min-height: 297mm;
                    }
                }
            `}</style>

            {/* Print Button - Hidden when printing */}
            <div className="no-print fixed top-4 right-4 z-50">
                <button
                    onClick={() => window.print()}
                    className="px-6 py-3 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-opacity shadow-lg"
                >
                    Print / Save as PDF
                </button>
            </div>

            {/* Invoice Content */}
            <div className="invoice-container p-8 md:p-12">
                {/* Header */}
                <div className="mb-8 pb-6 border-b-2 border-foreground/10">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            {settings?.businessName && (
                                <h1 className="text-3xl font-bold mb-2">{settings.businessName}</h1>
                            )}
                            {settings?.abn && (
                                <p className="text-sm text-foreground/60">ABN: {settings.abn}</p>
                            )}
                            {settings?.address && (
                                <p className="text-sm text-foreground/60 mt-1">{settings.address}</p>
                            )}
                            <div className="text-sm text-foreground/60 mt-1">
                                {settings?.phone && <span>{settings.phone}</span>}
                                {settings?.phone && settings?.email && <span className="mx-2">|</span>}
                                {settings?.email && <span>{settings.email}</span>}
                            </div>
                            {settings?.website && (
                                <p className="text-sm text-foreground/60 mt-1">{settings.website}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <h2 className="text-4xl font-bold mb-2">INVOICE</h2>
                            <p className="text-xl font-semibold">{invoice.invoiceDisplayNumber || invoice.invoiceNumber || 'DRAFT'}</p>
                        </div>
                    </div>
                </div>

                {/* Invoice Details Grid */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Bill To */}
                    <div>
                        <h3 className="text-sm font-semibold uppercase text-foreground/60 mb-2">Bill To</h3>
                        <p className="font-semibold text-lg">{invoice.clientName}</p>
                        {invoice.clientEmail && <p className="text-sm mt-1">{invoice.clientEmail}</p>}
                        {invoice.clientAddress && (
                            <div className="text-sm mt-2">
                                {invoice.clientAddress.street && <p>{invoice.clientAddress.street}</p>}
                                {(invoice.clientAddress.city ||
                                    invoice.clientAddress.state ||
                                    invoice.clientAddress.postcode) && (
                                        <p>
                                            {[
                                                invoice.clientAddress.city,
                                                invoice.clientAddress.state,
                                                invoice.clientAddress.postcode,
                                            ]
                                                .filter(Boolean)
                                                .join(', ')}
                                        </p>
                                    )}
                                {invoice.clientAddress.country && <p>{invoice.clientAddress.country}</p>}
                            </div>
                        )}
                        {invoice.clientAbn && (
                            <p className="text-sm mt-2 text-foreground/60">ABN: {invoice.clientAbn}</p>
                        )}
                    </div>

                    {/* Invoice Info */}
                    <div className="text-right">
                        {invoice.issueDate && invoice.issueDate instanceof Date && (
                            <div className="mb-2">
                                <span className="text-sm font-semibold uppercase text-foreground/60">
                                    Issue Date
                                </span>
                                <p className="text-lg">{formatDate(invoice.issueDate)}</p>
                            </div>
                        )}
                        {invoice.dueDate && invoice.dueDate instanceof Date && (
                            <div>
                                <span className="text-sm font-semibold uppercase text-foreground/60">
                                    Due Date
                                </span>
                                <p className="text-lg font-semibold">{formatDate(invoice.dueDate)}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Line Items Table */}
                <div className="mb-8">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b-2 border-foreground/20">
                                <th className="text-left py-3 font-semibold uppercase text-sm w-1/3">Description</th>
                                <th className="text-center py-3 font-semibold uppercase text-sm w-16">Qty</th>
                                <th className="text-center py-3 font-semibold uppercase text-sm w-20">Unit</th>
                                <th className="text-right py-3 font-semibold uppercase text-sm w-24">
                                    Price
                                </th>
                                <th className="text-right py-3 font-semibold uppercase text-sm w-24">
                                    Subtotal
                                </th>
                                <th className="text-right py-3 font-semibold uppercase text-sm w-24">
                                    {(settings?.tax?.taxType && settings.tax.taxType !== 'None')
                                        ? settings.tax.taxType
                                        : 'TAX'}
                                </th>
                                <th className="text-right py-3 font-semibold uppercase text-sm w-24">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.lines.map((line, index) => (
                                <tr key={index} className="border-b border-foreground/10">
                                    <td className="py-4 w-1/3">
                                        <p className="font-medium">{line.title}</p>
                                        {line.description && (
                                            <p className="text-sm text-foreground/60 mt-1">{line.description}</p>
                                        )}
                                        <p className="text-xs text-foreground/50 mt-1">Job: {line.jobTitle}</p>
                                    </td>
                                    <td className="py-4 text-center">
                                        {line.quantity}
                                    </td>
                                    <td className="py-4 text-center">
                                        {getBillableUnitLabel(line.unit, line.quantity)}
                                    </td>
                                    <td className="py-4 text-right">{formatCurrency(line.unitPriceMinor)}</td>
                                    <td className="py-4 text-right">
                                        {formatCurrency(line.subtotalMinor)}
                                    </td>
                                    <td className="py-4 text-right">
                                        {line.taxRate ? (
                                            <>
                                                {formatCurrency(line.taxMinor)}
                                                <span className="text-xs text-foreground/50 ml-1">
                                                    ({formatTaxRate(line.taxRate)})
                                                </span>
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td className="py-4 text-right font-medium">
                                        {formatCurrency(line.totalMinor)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Totals */}
                <div className="totals-section flex justify-end mb-8">
                    <div className="w-80">
                        <div className="flex justify-between py-2">
                            <span className="font-medium">Subtotal</span>
                            <span className="font-semibold">{formatCurrency(invoice.subtotalMinor)}</span>
                        </div>

                        {invoice.taxBreakdown.map((tax, idx) => (
                            <div key={idx} className="flex justify-between py-2 border-b border-foreground/10">
                                <span className="font-medium">
                                    {settings?.tax?.taxType && settings.tax.taxType !== 'None'
                                        ? `${settings.tax.taxType} (${formatTaxRate(tax.rate)})`
                                        : `Tax (${formatTaxRate(tax.rate)})`}
                                </span>
                                <span className="font-semibold">{formatCurrency(tax.taxMinor)}</span>
                            </div>
                        ))}

                        <div className="flex justify-between py-3 border-t-2 border-foreground/20 mt-2">
                            <span className="text-xl font-bold">Total</span>
                            <span className="text-2xl font-bold">{formatCurrency(invoice.totalMinor)}</span>
                        </div>

                        {invoice.amountPaidMinor > 0 && (
                            <>
                                <div className="flex justify-between py-2 text-green-600">
                                    <span className="font-medium">Amount Paid</span>
                                    <span className="font-semibold">
                                        -{formatCurrency(invoice.amountPaidMinor)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-3 border-t-2 border-foreground/20">
                                    <span className="text-xl font-bold">Balance Due</span>
                                    <span className="text-2xl font-bold text-red-600">
                                        {formatCurrency(invoice.balanceDueMinor)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Bank Account Details */}
                {settings?.bankAccount &&
                    (settings.bankAccount.accountName ||
                        settings.bankAccount.bsb ||
                        settings.bankAccount.accountNumber) && (
                        <div className="payment-section mb-8 p-6 bg-foreground/5 rounded-lg">
                            <h3 className="font-semibold mb-3">Payment Details</h3>
                            {settings.bankAccount.accountName && (
                                <p className="text-sm mb-1">
                                    <span className="font-medium">Account Name:</span>{' '}
                                    {settings.bankAccount.accountName}
                                </p>
                            )}
                            {settings.bankAccount.bsb && (
                                <p className="text-sm mb-1">
                                    <span className="font-medium">BSB:</span> {settings.bankAccount.bsb}
                                </p>
                            )}
                            {settings.bankAccount.accountNumber && (
                                <p className="text-sm">
                                    <span className="font-medium">Account Number:</span>{' '}
                                    {settings.bankAccount.accountNumber}
                                </p>
                            )}
                        </div>
                    )}

                {/* Payment Terms */}
                {settings?.invoiceTerms && (
                    <div className="mb-6">
                        <h3 className="font-semibold mb-2">Payment Terms</h3>
                        <p className="text-sm text-foreground/70 whitespace-pre-wrap">{settings.invoiceTerms}</p>
                    </div>
                )}

                {/* Notes */}
                {invoice.notes && (
                    <div className="mb-6">
                        <h3 className="font-semibold mb-2">Notes</h3>
                        <p className="text-sm text-foreground/70 whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                )}

                {/* Footer */}
                {settings?.invoiceFooter && (
                    <div className="footer-section mt-12 pt-6 border-t border-foreground/10 text-center">
                        <p className="text-sm text-foreground/60">{settings.invoiceFooter}</p>
                    </div>
                )}
            </div>
        </>
    );
}
