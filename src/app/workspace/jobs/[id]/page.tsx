'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { JobItemsList } from '@/components/jobs/JobItemsList';
import { getCurrentUserTenantId } from '@/lib/tenant';
import { formatCurrency } from '@/lib/invoice-utils';
import { getJob, deleteJob, archiveJob } from '../actions';
import { getClient } from '../../clients/actions';
import {
    createQuoteFromJob,
    getOpenJobItemsForQuote,
} from '../../quotes/actions';
import { JOB_ROUTES, CLIENT_ROUTES } from '@/lib/routes';
import type { Job, JobStatus } from '@/types/job';
import type { Client } from '@/types/client';
import type { JobItem } from '@/types/jobItem';

export default function JobViewPage() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const jobId = params.id as string;

    const [job, setJob] = useState<Job | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showQuoteModal, setShowQuoteModal] = useState(false);

    useEffect(() => {
        const loadJob = async () => {
            setLoading(true);
            setError(null);

            const tenantId = await getCurrentUserTenantId();
            if (!tenantId) {
                setError('Unable to determine your tenant.');
                setLoading(false);
                return;
            }
            setTenantId(tenantId);

            const result = await getJob(tenantId, jobId);
            if (result.success) {
                setJob(result.data);

                // Load client information
                const clientResult = await getClient(tenantId, result.data.clientId);
                if (clientResult.success) {
                    setClient(clientResult.data);
                }
            } else {
                setError(result.error);
            }
            setLoading(false);
        };

        loadJob();
    }, [jobId]);

    const handleDelete = async () => {
        if (!job) return;

        if (!confirm(`Are you sure you want to delete "${job.title}"? This action cannot be undone.`)) {
            return;
        }

        const tenantId = await getCurrentUserTenantId();
        if (!tenantId) {
            alert('Unable to determine your tenant.');
            return;
        }

        const result = await deleteJob(tenantId, jobId);
        if (result.success) {
            router.push(JOB_ROUTES.LIST);
        } else {
            alert(`Failed to delete job: ${result.error}`);
        }
    };

    const handleArchive = async () => {
        if (!job) return;

        if (!confirm(`Archive "${job.title}"?`)) {
            return;
        }

        const tenantId = await getCurrentUserTenantId();
        if (!tenantId) {
            alert('Unable to determine your tenant.');
            return;
        }

        const result = await archiveJob(tenantId, jobId);
        if (result.success) {
            // Reload the job to show updated status
            const updatedResult = await getJob(tenantId, jobId);
            if (updatedResult.success) {
                setJob(updatedResult.data);
            }
        } else {
            alert(`Failed to archive job: ${result.error}`);
        }
    };

    const formatDate = (date: Date | undefined) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-AU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const getStatusColor = (status: JobStatus) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
            case 'completed':
                return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
            case 'archived':
                return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
            default:
                return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400';
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-black">
                    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-zinc-600 dark:text-zinc-400">Loading job...</p>
                            </CardContent>
                        </Card>
                    </main>
                </div>
            </ProtectedRoute>
        );
    }

    if (error || !job) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-black">
                    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <Card className="border-red-200 dark:border-red-800">
                            <CardContent className="py-12 text-center">
                                <p className="text-red-600 dark:text-red-400 mb-4">
                                    {error || 'Job not found'}
                                </p>
                                <Button onClick={() => router.push(JOB_ROUTES.LIST)}>
                                    Back to Jobs
                                </Button>
                            </CardContent>
                        </Card>
                    </main>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-black">
                <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                            <Link href={JOB_ROUTES.LIST} className="hover:text-foreground">
                                Jobs
                            </Link>
                            <span>/</span>
                            <span className="text-foreground">{job.title}</span>
                        </div>
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">{job.title}</h1>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(job.status)}`}>
                                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Link href={JOB_ROUTES.EDIT(jobId)}>
                                    <Button>Edit Job</Button>
                                </Link>
                                {job.status !== 'archived' && (
                                    <Button variant="secondary" onClick={() => setShowQuoteModal(true)}>
                                        Create Quote
                                    </Button>
                                )}
                                {job.status !== 'archived' && (
                                    <Button variant="secondary" onClick={handleArchive}>
                                        Archive
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={handleDelete}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Basic Information */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Client</dt>
                                    <dd className="mt-1 text-foreground">
                                        {client ? (
                                            <Link
                                                href={CLIENT_ROUTES.VIEW(job.clientId)}
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                {client.name}
                                            </Link>
                                        ) : (
                                            <span className="text-zinc-400 dark:text-zinc-600">Loading...</span>
                                        )}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status</dt>
                                    <dd className="mt-1">
                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                                            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                        </span>
                                    </dd>
                                </div>

                                {job.reference && (
                                    <div>
                                        <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Reference</dt>
                                        <dd className="mt-1 text-foreground">{job.reference}</dd>
                                    </div>
                                )}

                                <div>
                                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Start Date</dt>
                                    <dd className="mt-1 text-foreground">{formatDate(job.startDate as Date)}</dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">End Date</dt>
                                    <dd className="mt-1 text-foreground">{formatDate(job.endDate as Date)}</dd>
                                </div>

                                {job.defaultDailyHours !== undefined && (
                                    <div>
                                        <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Default Daily Hours</dt>
                                        <dd className="mt-1 text-foreground">
                                            {job.defaultDailyHours} {job.defaultDailyHours === 1 ? 'hour' : 'hours'}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                        </CardContent>
                    </Card>

                    {/* Description */}
                    {job.description && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Description</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-foreground whitespace-pre-wrap">{job.description}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Job Items */}
                    <div className="mb-6">
                        <JobItemsList jobId={jobId} clientId={job.clientId} />
                    </div>

                    {/* Metadata */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Metadata</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
                                <div>
                                    <dt className="text-zinc-600 dark:text-zinc-400">Created</dt>
                                    <dd className="mt-1 text-foreground">{formatDate(job.createdAt as Date)}</dd>
                                </div>
                                <div>
                                    <dt className="text-zinc-600 dark:text-zinc-400">Last Updated</dt>
                                    <dd className="mt-1 text-foreground">{formatDate(job.updatedAt as Date)}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    {/* Back Button */}
                    <div className="flex justify-center">
                        <Button variant="secondary" onClick={() => router.push(JOB_ROUTES.LIST)}>
                            Back to Jobs
                        </Button>
                    </div>

                    {showQuoteModal && tenantId && user && (
                        <CreateQuoteModal
                            tenantId={tenantId}
                            userId={user.uid}
                            jobId={job.id}
                            onClose={() => setShowQuoteModal(false)}
                            onCreated={(quoteId, quoteNumber) => {
                                setShowQuoteModal(false);
                                alert(`Quote ${quoteNumber} created successfully.`);
                                router.push(`/workspace/quotes?created=${quoteId}`);
                            }}
                        />
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}

interface CreateQuoteModalProps {
    tenantId: string;
    userId: string;
    jobId: string;
    onClose: () => void;
    onCreated: (quoteId: string, quoteNumber: string) => void;
}

function CreateQuoteModal({
    tenantId,
    userId,
    jobId,
    onClose,
    onCreated,
}: CreateQuoteModalProps) {
    const [items, setItems] = useState<JobItem[]>([]);
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadItems = async () => {
            setLoading(true);
            setError(null);

            const result = await getOpenJobItemsForQuote(tenantId, userId, jobId);
            if (!result.success) {
                setError(result.error);
                setLoading(false);
                return;
            }

            setItems(result.data);
            setSelectedItemIds(result.data.map((item) => item.id));
            setLoading(false);
        };

        loadItems();
    }, [tenantId, userId, jobId]);

    const toggleItem = (itemId: string) => {
        setSelectedItemIds((previous) =>
            previous.includes(itemId)
                ? previous.filter((id) => id !== itemId)
                : [...previous, itemId]
        );
    };

    const selectedTotalMinor = items
        .filter((item) => selectedItemIds.includes(item.id))
        .reduce(
            (total, item) =>
                total + Math.round(item.quantity * item.unitPriceMinor),
            0
        );

    const handleCreate = async () => {
        if (selectedItemIds.length === 0) {
            setError('Select at least one job item.');
            return;
        }

        setSaving(true);
        setError(null);

        const result = await createQuoteFromJob(tenantId, userId, {
            jobId,
            jobItemIds: selectedItemIds,
        });

        if (!result.success) {
            setError(result.error);
            setSaving(false);
            return;
        }

        onCreated(result.data.quoteId, result.data.quoteNumber || 'Draft');
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-3xl p-6 max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Create Quote</h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            Select existing open job items to snapshot into a quote.
                        </p>
                    </div>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        Close
                    </Button>
                </div>

                {loading ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading job items...</p>
                ) : items.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                            No open job items available for quoting.
                        </p>
                        <Button variant="secondary" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
                            <table className="w-full">
                                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                                            Select
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                                            Item
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                                            Qty
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                                            Unit Price
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                                            Subtotal
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    {items.map((item) => {
                                        const subtotalMinor = Math.round(item.quantity * item.unitPriceMinor);
                                        const checked = selectedItemIds.includes(item.id);

                                        return (
                                            <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleItem(item.id)}
                                                        className="w-4 h-4"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-foreground">{item.title}</p>
                                                    {item.description && (
                                                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-foreground">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right text-sm text-foreground">{formatCurrency(item.unitPriceMinor)}</td>
                                                <td className="px-4 py-3 text-right text-sm font-medium text-foreground">{formatCurrency(subtotalMinor)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-3">{error}</p>
                        )}

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                {selectedItemIds.length} item{selectedItemIds.length === 1 ? '' : 's'} selected
                            </p>
                            <p className="text-sm font-medium text-foreground">
                                Subtotal: {formatCurrency(selectedTotalMinor)}
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="secondary" onClick={onClose} disabled={saving}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={saving || selectedItemIds.length === 0}>
                                {saving ? 'Creating...' : 'Create Quote'}
                            </Button>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
}
