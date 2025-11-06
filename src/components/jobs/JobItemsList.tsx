'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getTenantSettings } from '@/app/workspace/settings/actions';
import { getJobItems, createJobItem, updateJobItem, deleteJobItem } from '@/app/workspace/jobs/itemActions';
import type { JobItem, BillableUnit, JobItemFormData } from '@/types/jobItem';
import { computeLineSubtotal, computeTaxAmount, formatMinorUnits, getBillableUnitLabel } from '@/types/jobItem';

interface JobItemsListProps {
    jobId: string;
    clientId: string;
}

export function JobItemsList({ jobId, clientId }: JobItemsListProps) {
    const { user } = useAuth();
    const { tenantId } = useWorkspace();
    const [jobItems, setJobItems] = useState<JobItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [defaultTaxRate, setDefaultTaxRate] = useState<number>(0.10); // Default to 10% (0.10)
    const [taxType, setTaxType] = useState<string>('Tax'); // Default to 'Tax'

    // Job item form state
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [itemTitle, setItemTitle] = useState('');
    const [itemDescription, setItemDescription] = useState('');
    const [itemUnit, setItemUnit] = useState<BillableUnit>('hour');
    const [itemQuantity, setItemQuantity] = useState('');
    const [itemUnitPrice, setItemUnitPrice] = useState('');
    const [itemGstApplicable, setItemGstApplicable] = useState(true);
    const [itemFormError, setItemFormError] = useState<string | null>(null);
    const [itemSaving, setItemSaving] = useState(false);

    // Load tenant settings to get default tax rate and tax type
    useEffect(() => {
        async function loadSettings() {
            const result = await getTenantSettings(tenantId);
            if (result.success && result.data?.tax?.defaultRate) {
                setDefaultTaxRate(result.data.tax.defaultRate);
            }
            if (result.success && result.data?.tax?.taxType && result.data.tax.taxType !== 'None') {
                setTaxType(result.data.tax.taxType);
            }
        }
        loadSettings();
    }, [tenantId]);

    // Load job items
    useEffect(() => {
        const loadJobItems = async () => {
            setLoading(true);
            setError(null);

            const result = await getJobItems(tenantId, jobId);
            if (result.success) {
                setJobItems(result.data);
            } else {
                setError(result.error);
            }
            setLoading(false);
        };

        loadJobItems();
    }, [jobId, tenantId, refreshTrigger]);

    const resetForm = () => {
        setItemTitle('');
        setItemDescription('');
        setItemUnit('hour');
        setItemQuantity('');
        setItemUnitPrice('');
        setItemGstApplicable(true);
        setItemFormError(null);
        setEditingItemId(null);
        setShowItemForm(false);
    };

    const startEdit = (item: JobItem) => {
        setEditingItemId(item.id);
        setItemTitle(item.title);
        setItemDescription(item.description || '');
        setItemUnit(item.unit);
        setItemQuantity(item.quantity.toString());
        setItemUnitPrice((item.unitPriceMinor / 100).toFixed(2));
        setItemGstApplicable(item.gstApplicable ?? true); // Default to true if undefined (legacy items)
        setShowItemForm(true);
    };

    const handleSubmitItem = async (e: React.FormEvent) => {
        e.preventDefault();
        setItemSaving(true);
        setItemFormError(null);

        if (!itemTitle.trim()) {
            setItemFormError('Title is required');
            setItemSaving(false);
            return;
        }

        const quantity = parseFloat(itemQuantity);
        if (isNaN(quantity) || quantity <= 0) {
            setItemFormError('Quantity must be greater than 0');
            setItemSaving(false);
            return;
        }

        const unitPrice = parseFloat(itemUnitPrice);
        if (isNaN(unitPrice) || unitPrice < 0) {
            setItemFormError('Unit price cannot be negative');
            setItemSaving(false);
            return;
        }

        if (!user) {
            setItemFormError('User not authenticated.');
            setItemSaving(false);
            return;
        }

        const formData: JobItemFormData = {
            jobId,
            clientId,
            title: itemTitle.trim(),
            description: itemDescription.trim() || undefined,
            unit: itemUnit,
            quantity,
            unitPriceMinor: Math.round(unitPrice * 100),
            gstApplicable: itemGstApplicable,
            status: 'open',
        };

        let result;
        if (editingItemId) {
            result = await updateJobItem(tenantId, editingItemId, formData);
        } else {
            result = await createJobItem(tenantId, user.uid, formData);
        }

        if (result.success) {
            resetForm();
            setRefreshTrigger(prev => prev + 1);
        } else {
            setItemFormError(result.error);
        }
        setItemSaving(false);
    };

    const handleDeleteItem = async (itemId: string, itemTitle: string) => {
        if (!confirm(`Delete "${itemTitle}"?`)) {
            return;
        }

        const result = await deleteJobItem(tenantId, itemId);
        if (result.success) {
            setRefreshTrigger(prev => prev + 1);
        } else {
            alert(`Failed to delete item: ${result.error}`);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Billable Items</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading items...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Billable Items</CardTitle>
                    {!showItemForm && (
                        <Button
                            onClick={() => {
                                setItemGstApplicable(true);
                                setShowItemForm(true);
                            }}
                            className="text-sm"
                        >
                            + Add Item
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Item Form */}
                {showItemForm && (
                    <form onSubmit={handleSubmitItem} className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                        <h4 className="font-medium text-foreground mb-4">
                            {editingItemId ? 'Edit Item' : 'New Item'}
                        </h4>

                        {itemFormError && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400">{itemFormError}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="itemTitle" className="block text-sm font-medium text-foreground mb-2">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    id="itemTitle"
                                    type="text"
                                    value={itemTitle}
                                    onChange={(e) => setItemTitle(e.target.value)}
                                    placeholder="Development work, consultation, etc."
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="itemDescription" className="block text-sm font-medium text-foreground mb-2">
                                    Description
                                </label>
                                <textarea
                                    id="itemDescription"
                                    value={itemDescription}
                                    onChange={(e) => setItemDescription(e.target.value)}
                                    placeholder="Optional description..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <div>
                                    <label htmlFor="itemUnit" className="block text-sm font-medium text-foreground mb-2">
                                        Unit <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="itemUnit"
                                            value={itemUnit}
                                            onChange={(e) => setItemUnit(e.target.value as BillableUnit)}
                                            required
                                            className="w-full pl-3 pr-10 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                        >
                                            <option value="hour">Hour</option>
                                            <option value="half_day">Half Day</option>
                                            <option value="day">Day</option>
                                            <option value="unit">Unit</option>
                                            <option value="expense">Expense</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                            <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="itemQuantity" className="block text-sm font-medium text-foreground mb-2">
                                        Quantity <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        id="itemQuantity"
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        value={itemQuantity}
                                        onChange={(e) => setItemQuantity(e.target.value)}
                                        placeholder="1"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="itemUnitPrice" className="block text-sm font-medium text-foreground mb-2">
                                        Unit Price ($) <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        id="itemUnitPrice"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={itemUnitPrice}
                                        onChange={(e) => setItemUnitPrice(e.target.value)}
                                        placeholder="100.00"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="itemGstApplicable" className="block text-sm font-medium text-foreground mb-2">
                                        {taxType} Applicable
                                    </label>
                                    <div className="flex items-center h-10">
                                        <input
                                            id="itemGstApplicable"
                                            type="checkbox"
                                            checked={itemGstApplicable}
                                            onChange={(e) => setItemGstApplicable(e.target.checked)}
                                            className="w-5 h-5 text-blue-600 bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="ml-2 text-sm text-zinc-600 dark:text-zinc-400">
                                            Apply {taxType.toLowerCase()} to this item
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button type="button" variant="secondary" onClick={resetForm} disabled={itemSaving}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={itemSaving}>
                                    {itemSaving ? 'Saving...' : (editingItemId ? 'Update Item' : 'Add Item')}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}

                {/* Items List */}
                {jobItems.length === 0 ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        No billable items yet. Click &quot;Add Item&quot; to get started.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {jobItems.map((item) => {
                            const subtotal = computeLineSubtotal(item);
                            const tax = computeTaxAmount(item, defaultTaxRate);
                            const total = subtotal + tax;

                            return (
                                <div
                                    key={item.id}
                                    className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-foreground">{item.title}</h4>
                                            {item.description && (
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                                    {item.description}
                                                </p>
                                            )}
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400 mt-2">
                                                <span>
                                                    {item.quantity} × {formatMinorUnits(item.unitPriceMinor)} / {getBillableUnitLabel(item.unit, 1)}
                                                </span>
                                                {(item.gstApplicable ?? true) && (
                                                    <span>{taxType} applicable</span>
                                                )}
                                                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800">
                                                    {item.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="font-medium text-foreground">
                                                {formatMinorUnits(total)}
                                            </div>
                                            <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                                Subtotal: {formatMinorUnits(subtotal)}
                                            </div>
                                            {tax > 0 && (
                                                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {taxType}: {formatMinorUnits(tax)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {item.status === 'open' && (
                                        <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                                            <Button
                                                variant="secondary"
                                                onClick={() => startEdit(item)}
                                                className="text-xs px-3 py-1"
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                onClick={() => handleDeleteItem(item.id, item.title)}
                                                className="text-xs px-3 py-1"
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    )}
                                    {item.status !== 'open' && (
                                        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                                            This item is {item.status} and cannot be edited.
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Summary */}
                        <div className="pt-3 border-t-2 border-zinc-300 dark:border-zinc-700">
                            <div className="flex justify-between items-center font-medium text-foreground">
                                <span>Total ({jobItems.length} {jobItems.length === 1 ? 'item' : 'items'})</span>
                                <span>
                                    {formatMinorUnits(
                                        jobItems.reduce((sum, item) => {
                                            const subtotal = computeLineSubtotal(item);
                                            const tax = computeTaxAmount(item, defaultTaxRate);
                                            return sum + subtotal + tax;
                                        }, 0)
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
