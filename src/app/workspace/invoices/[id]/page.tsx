"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCurrentUserTenantId, getCurrentUserRole } from "@/lib/tenant";
import { Invoice } from "@/types/invoice";
import { JobItem } from "@/types/jobItem";
import { TenantSettings } from "@/types/tenant";
import {
    formatCurrency,
    formatDate,
    formatTaxRate,
    getStatusLabel,
    getStatusColor,
} from "@/lib/invoice-utils";
import { getBillableUnitLabel } from "@/types/jobItem";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import {
    addItemsToInvoice,
    removeItemFromInvoice,
    issueInvoice,
    updateInvoicePayment,
    voidInvoice,
    deleteDraftInvoice,
    getOpenJobItemsForClient,
} from "../actions";
import { getInvoiceForPrint } from "./print/actions";

export default function InvoiceDetailPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const invoiceId = params.id as string;

    const [tenantId, setTenantId] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<"owner" | "staff" | null>(null);
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [showItemSelector, setShowItemSelector] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Get tenant ID and user role
    useEffect(() => {
        const loadUserData = async () => {
            const id = await getCurrentUserTenantId();
            const role = await getCurrentUserRole();
            setTenantId(id);
            setUserRole(role);
        };
        loadUserData();
    }, [user]);

    // Fetch invoice and settings
    useEffect(() => {
        if (!tenantId) return;

        // Load settings
        const loadSettings = async () => {
            const result = await getInvoiceForPrint(tenantId, invoiceId);
            if (result.success && result.data) {
                setSettings(result.data.settings);
            }
        };
        loadSettings();

        // Subscribe to invoice
        const invoiceRef = doc(db, `tenants/${tenantId}/invoices`, invoiceId);
        const unsubscribe = onSnapshot(invoiceRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                setInvoice({
                    id: snapshot.id,
                    ...data,
                    issueDate: data.issueDate?.toDate(),
                    dueDate: data.dueDate?.toDate(),
                    viewedAt: data.viewedAt?.toDate(),
                    createdAt: data.createdAt?.toDate(),
                    updatedAt: data.updatedAt?.toDate(),
                } as Invoice);
            } else {
                setInvoice(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId, invoiceId]);

    const handleRemoveItem = async (jobItemId: string) => {
        if (!tenantId || !invoice) return;
        if (!confirm("Remove this item from the invoice?")) return;

        setProcessing(true);
        try {
            const result = await removeItemFromInvoice(tenantId, invoice.id, jobItemId);
            if (!result.success) {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error removing item:", error);
            alert("Failed to remove item");
        } finally {
            setProcessing(false);
        }
    };

    const handleIssueInvoice = async () => {
        if (!tenantId || !invoice || !user) return;
        if (!confirm("Issue this invoice? This will assign an invoice number and lock all items. This action cannot be undone.")) return;

        setProcessing(true);
        try {
            const result = await issueInvoice(tenantId, invoice.id, user.uid);
            if (result.success) {
                alert("Invoice issued successfully!");
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error issuing invoice:", error);
            alert("Failed to issue invoice");
        } finally {
            setProcessing(false);
        }
    };

    const handleVoidInvoice = async () => {
        if (!tenantId || !invoice || !userRole) return;
        if (!confirm("Void this invoice? This action cannot be undone.")) return;

        setProcessing(true);
        try {
            const result = await voidInvoice(tenantId, invoice.id, userRole);
            if (result.success) {
                alert("Invoice voided successfully");
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error voiding invoice:", error);
            alert("Failed to void invoice");
        } finally {
            setProcessing(false);
        }
    };

    const handleDeleteDraft = async () => {
        if (!tenantId || !invoice) return;
        if (!confirm("Delete this draft invoice? This action cannot be undone.")) return;

        setProcessing(true);
        try {
            const result = await deleteDraftInvoice(tenantId, invoice.id);
            if (result.success) {
                router.push("/workspace/invoices");
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error deleting invoice:", error);
            alert("Failed to delete invoice");
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdatePayment = async (amountPaidMinor: number) => {
        if (!tenantId || !invoice) return;

        setProcessing(true);
        try {
            const result = await updateInvoicePayment(tenantId, invoice.id, amountPaidMinor);
            if (result.success) {
                setShowPaymentModal(false);
                alert("Payment updated successfully");
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error updating payment:", error);
            alert("Failed to update payment");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8">
                <p>Loading invoice...</p>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="p-8">
                <Card className="p-12 text-center">
                    <h2 className="text-xl font-bold mb-2">Invoice Not Found</h2>
                    <p className="text-gray-600 mb-4">This invoice does not exist</p>
                    <Link href="/workspace/invoices">
                        <Button>Back to Invoices</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    const isDraft = invoice.status === "draft";
    const canEdit = isDraft;
    const canVoid = userRole === "owner" && invoice.status !== "void";
    const canDelete = isDraft;
    const canUpdatePayment = invoice.status !== "draft" && invoice.status !== "void";

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <Link href="/workspace/invoices" className="text-blue-600 hover:underline mb-2 inline-block">
                    ← Back to Invoices
                </Link>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">
                            {invoice.invoiceDisplayNumber || invoice.invoiceNumber || "Draft Invoice"}
                        </h1>
                        <p className="text-gray-600 mt-1">{invoice.clientName}</p>
                    </div>
                    <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                    </span>
                </div>
            </div>

            {/* Invoice Details */}
            <Card className="p-6 mb-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="font-semibold mb-2">Bill To</h3>
                        <p className="font-medium">{invoice.clientName}</p>
                        {invoice.clientEmail && <p className="text-sm text-gray-600">{invoice.clientEmail}</p>}
                        {invoice.clientAddress && (
                            <div className="text-sm text-gray-600 mt-2">
                                {invoice.clientAddress.street && <p>{invoice.clientAddress.street}</p>}
                                {(invoice.clientAddress.city || invoice.clientAddress.state || invoice.clientAddress.postcode) && (
                                    <p>
                                        {[invoice.clientAddress.city, invoice.clientAddress.state, invoice.clientAddress.postcode]
                                            .filter(Boolean)
                                            .join(", ")}
                                    </p>
                                )}
                                {invoice.clientAddress.country && <p>{invoice.clientAddress.country}</p>}
                            </div>
                        )}
                        {invoice.clientAbn && (
                            <p className="text-sm text-gray-600 mt-2">ABN: {invoice.clientAbn}</p>
                        )}
                    </div>
                    <div className="text-right">
                        {invoice.issueDate && invoice.issueDate instanceof Date && (
                            <p className="text-sm mb-1">
                                <span className="font-medium">Issue Date:</span> {formatDate(invoice.issueDate)}
                            </p>
                        )}
                        {invoice.dueDate && invoice.dueDate instanceof Date && (
                            <p className="text-sm">
                                <span className="font-medium">Due Date:</span> {formatDate(invoice.dueDate)}
                            </p>
                        )}
                    </div>
                </div>
            </Card>

            {/* Line Items */}
            <Card className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Line Items</h3>
                    {canEdit && (
                        <Button onClick={() => setShowItemSelector(true)} variant="secondary">
                            Add Items
                        </Button>
                    )}
                </div>

                {invoice.lines.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No items added yet</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed">
                            <thead className="border-b">
                                <tr className="text-left text-sm text-gray-600">
                                    <th className="pb-3 px-2" style={{ width: '40%' }}>Description</th>
                                    <th className="pb-3 px-2 text-center" style={{ width: '10%' }}>Price</th>
                                    <th className="pb-3 px-2 text-center" style={{ width: '8%' }}>Qty</th>
                                    <th className="pb-3 px-2 text-center" style={{ width: '10%' }}>Unit</th>
                                    <th className="pb-3 px-2 text-center" style={{ width: '11%' }}>Subtotal</th>
                                    {invoice.lines.some((l) => l.gstApplicable) && (
                                        <th className="pb-3 px-2 text-center" style={{ width: '10%' }}>
                                            {settings?.tax?.taxType && settings.tax.taxType !== 'None'
                                                ? settings.tax.taxType
                                                : 'Tax'}
                                        </th>
                                    )}
                                    <th className="pb-3 px-2 text-center" style={{ width: canEdit ? '8%' : '11%' }}>Total</th>
                                    {canEdit && <th className="pb-3 px-2" style={{ width: '8%' }}></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.lines.map((line) => (
                                    <tr key={line.jobItemId} className="border-b">
                                        <td className="py-4 px-2">
                                            <p className="font-medium">{line.title}</p>
                                            {line.description && <p className="text-sm text-gray-600">{line.description}</p>}
                                            <p className="text-xs text-gray-500">Job: {line.jobTitle}</p>
                                        </td>
                                        <td className="py-4 px-2 text-center">{formatCurrency(line.unitPriceMinor)}</td>
                                        <td className="py-4 px-2 text-center">{line.quantity}</td>
                                        <td className="py-4 px-2 text-center">
                                            {getBillableUnitLabel(line.unit, line.quantity)}
                                        </td>
                                        <td className="py-4 px-2 text-center">{formatCurrency(line.subtotalMinor)}</td>
                                        {invoice.lines.some((l) => l.gstApplicable) && (
                                            <td className="py-4 px-2 text-center">
                                                {line.gstApplicable && line.taxMinor > 0 ? (
                                                    formatCurrency(line.taxMinor)
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
                                        )}
                                        <td className="py-4 px-2 text-center font-medium">{formatCurrency(line.totalMinor)}</td>
                                        {canEdit && (
                                            <td className="py-4 px-2 text-center">
                                                <button
                                                    onClick={() => handleRemoveItem(line.jobItemId)}
                                                    disabled={processing}
                                                    className="text-red-600 hover:text-red-700 transition-colors disabled:opacity-50 p-1 cursor-pointer"
                                                    title="Remove item"
                                                    aria-label="Remove item"
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 24 24"
                                                        fill="currentColor"
                                                        className="w-5 h-5"
                                                    >
                                                        <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Totals */}
                {invoice.lines.length > 0 && (
                    <div className="mt-6 pt-6">
                        <div className="max-w-sm ml-auto space-y-2">
                            <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span className="font-medium">{formatCurrency(invoice.subtotalMinor)}</span>
                            </div>
                            {invoice.taxBreakdown.map((tax, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span>Tax ({formatTaxRate(tax.rate)}):</span>
                                    <span>{formatCurrency(tax.taxMinor)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-lg font-bold pt-2 border-t">
                                <span>Total:</span>
                                <span>{formatCurrency(invoice.totalMinor)}</span>
                            </div>
                            {invoice.amountPaidMinor > 0 && (
                                <>
                                    <div className="flex justify-between text-green-600">
                                        <span>Paid:</span>
                                        <span>{formatCurrency(invoice.amountPaidMinor)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-red-600">
                                        <span>Balance Due:</span>
                                        <span>{formatCurrency(invoice.balanceDueMinor)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </Card>

            {/* Notes */}
            {invoice.notes && (
                <Card className="p-6 mb-6">
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
                <Button
                    variant="secondary"
                    onClick={() => window.open(`/workspace/invoices/${invoice.id}/print`, '_blank')}
                >
                    Preview / Print
                </Button>
                {canDelete && (
                    <Button variant="secondary" onClick={handleDeleteDraft} disabled={processing}>
                        Delete Draft
                    </Button>
                )}
                {canVoid && (
                    <Button variant="secondary" onClick={handleVoidInvoice} disabled={processing}>
                        Void Invoice
                    </Button>
                )}
                {canUpdatePayment && (
                    <Button variant="secondary" onClick={() => setShowPaymentModal(true)} disabled={processing}>
                        Update Payment
                    </Button>
                )}
                {isDraft && invoice.lines.length > 0 && (
                    <Button onClick={handleIssueInvoice} disabled={processing}>
                        Issue Invoice
                    </Button>
                )}
            </div>

            {/* Item Selector Modal */}
            {showItemSelector && tenantId && (
                <ItemSelectorModal
                    tenantId={tenantId}
                    invoiceId={invoice.id}
                    clientId={invoice.clientId}
                    settings={settings}
                    onClose={() => setShowItemSelector(false)}
                />
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <Card className="max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">Update Payment</h2>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const amount = parseFloat(formData.get("amount") as string);
                                const amountMinor = Math.round(amount * 100);
                                handleUpdatePayment(amountMinor);
                            }}
                        >
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Amount Paid</label>
                                    <input
                                        type="number"
                                        name="amount"
                                        step="0.01"
                                        min="0"
                                        max={invoice.totalMinor / 100}
                                        defaultValue={invoice.amountPaidMinor / 100}
                                        required
                                        className="w-full px-3 py-2 border rounded-md"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Total: {formatCurrency(invoice.totalMinor)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowPaymentModal(false)}
                                    disabled={processing}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing} className="flex-1">
                                    {processing ? "Updating..." : "Update"}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}

// Item Selector Component
function ItemSelectorModal({
    tenantId,
    invoiceId,
    clientId,
    settings,
    onClose,
}: {
    tenantId: string;
    invoiceId: string;
    clientId: string;
    settings: TenantSettings | null;
    onClose: () => void;
}) {
    const [items, setItems] = useState<Array<JobItem & { jobTitle: string }>>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const taxRate = settings?.tax?.defaultRate || 0;

    useEffect(() => {
        const loadItems = async () => {
            const result = await getOpenJobItemsForClient(tenantId, clientId);
            if (result.success) {
                setItems(result.data);
            } else {
                alert(result.error);
            }
            setLoading(false);
        };
        loadItems();
    }, [tenantId, clientId]);

    const handleToggleItem = (itemId: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
        }
        setSelectedIds(newSelected);
    };

    const handleAddItems = async () => {
        if (selectedIds.size === 0) return;

        setAdding(true);
        try {
            const result = await addItemsToInvoice(tenantId, invoiceId, Array.from(selectedIds));
            if (result.success) {
                onClose();
            } else {
                alert(result.error);
            }
        } catch (error) {
            console.error("Error adding items:", error);
            alert("Failed to add items");
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold">Select Job Items</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Choose items to add to this invoice
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <p>Loading items...</p>
                    ) : items.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                            No open items available for this client
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item) => {
                                const subtotal = Math.round(item.quantity * item.unitPriceMinor);
                                const gstApplicable = item.gstApplicable ?? true;
                                const tax = gstApplicable ? Math.round(subtotal * taxRate) : 0;
                                const total = subtotal + tax;

                                return (
                                    <label
                                        key={item.id}
                                        className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => handleToggleItem(item.id)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium">{item.title}</p>
                                            {item.description && (
                                                <p className="text-sm text-gray-600">{item.description}</p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-1">Job: {item.jobTitle}</p>
                                            <p className="text-sm mt-1">
                                                {item.quantity} × {formatCurrency(item.unitPriceMinor)} ={" "}
                                                <span className="font-medium">{formatCurrency(total)}</span>
                                                {gstApplicable && tax > 0 && (
                                                    <span className="text-xs text-gray-500 ml-1">
                                                        (incl. {formatTaxRate(taxRate)} tax)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t flex gap-3">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={adding}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAddItems}
                        disabled={adding || selectedIds.size === 0}
                        className="flex-1"
                    >
                        {adding
                            ? "Adding..."
                            : `Add ${selectedIds.size} ${selectedIds.size === 1 ? "Item" : "Items"}`}
                    </Button>
                </div>
            </Card>
        </div>
    );
}
