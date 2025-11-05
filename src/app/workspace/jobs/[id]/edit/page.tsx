'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserTenantId } from '@/lib/tenant';
import { getJob, createJob, updateJob } from '../../actions';
import { getClients } from '../../../clients/actions';
import { JOB_ROUTES, CLIENT_ROUTES } from '@/lib/routes';
import type { JobFormData, JobStatus } from '@/types/job';
import type { Client } from '@/types/client';

export default function JobEditPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const jobId = params.id as string;
    const isNewJob = jobId === 'new';
    const prefilledClientId = searchParams.get('clientId');

    const [loading, setLoading] = useState(!isNewJob);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Available clients
    const [clients, setClients] = useState<Client[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);

    // Form state
    const [clientId, setClientId] = useState('');
    const [title, setTitle] = useState('');
    const [reference, setReference] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<JobStatus>('active');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [defaultDailyHours, setDefaultDailyHours] = useState('');

    // Load clients on mount
    useEffect(() => {
        const loadClients = async () => {
            setLoadingClients(true);
            const tenantId = await getCurrentUserTenantId();
            if (tenantId) {
                const result = await getClients(tenantId);
                if (result.success) {
                    // Filter to only active clients
                    setClients(result.data.filter(c => c.isActive));

                    // Pre-fill client if provided in query params
                    if (prefilledClientId && !clientId) {
                        setClientId(prefilledClientId);
                    }
                }
            }
            setLoadingClients(false);
        };

        loadClients();
    }, [prefilledClientId, clientId]);

    // Load existing job data if editing
    useEffect(() => {
        if (isNewJob) return;

        const loadJob = async () => {
            setLoading(true);
            setError(null);

            const tenantId = await getCurrentUserTenantId();
            if (!tenantId) {
                setError('Unable to determine your tenant.');
                setLoading(false);
                return;
            }

            const result = await getJob(tenantId, jobId);
            if (result.success) {
                const job = result.data;
                setClientId(job.clientId);
                setTitle(job.title);
                setReference(job.reference || '');
                setDescription(job.description || '');
                setStatus(job.status);

                // Format dates for input fields (YYYY-MM-DD)
                if (job.startDate) {
                    const date = job.startDate instanceof Date
                        ? job.startDate
                        : (job.startDate as Timestamp).toDate();
                    setStartDate(date.toISOString().split('T')[0]);
                }
                if (job.endDate) {
                    const date = job.endDate instanceof Date
                        ? job.endDate
                        : (job.endDate as Timestamp).toDate();
                    setEndDate(date.toISOString().split('T')[0]);
                }

                setDefaultDailyHours(job.defaultDailyHours?.toString() || '');
            } else {
                setError(result.error);
            }
            setLoading(false);
        };

        loadJob();
    }, [isNewJob, jobId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        if (!title.trim()) {
            setError('Job title is required');
            setSaving(false);
            return;
        }

        if (!clientId) {
            setError('Please select a client');
            setSaving(false);
            return;
        }

        const tenantId = await getCurrentUserTenantId();
        if (!tenantId || !user) {
            setError('Unable to determine your tenant.');
            setSaving(false);
            return;
        }

        const formData: JobFormData = {
            clientId,
            title: title.trim(),
            reference: reference.trim() || undefined,
            description: description.trim() || undefined,
            status,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            defaultDailyHours: defaultDailyHours ? parseFloat(defaultDailyHours) : undefined,
        };

        // Validate dates
        if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
            setError('End date must be after start date');
            setSaving(false);
            return;
        }

        // Validate defaultDailyHours
        if (formData.defaultDailyHours !== undefined && (formData.defaultDailyHours <= 0 || formData.defaultDailyHours > 24)) {
            setError('Default daily hours must be between 0 and 24');
            setSaving(false);
            return;
        }

        let result;
        if (isNewJob) {
            result = await createJob(tenantId, user.uid, formData);
        } else {
            result = await updateJob(tenantId, jobId, formData);
        }

        if (result.success) {
            if (isNewJob && typeof result.data === 'string') {
                router.push(JOB_ROUTES.VIEW(result.data));
            } else {
                router.push(JOB_ROUTES.VIEW(jobId));
            }
        } else {
            setError(result.error);
            setSaving(false);
        }
    };

    if (loading || loadingClients) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-black">
                    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    {loadingClients ? 'Loading clients...' : 'Loading job...'}
                                </p>
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
                <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                            <Link href={JOB_ROUTES.LIST} className="hover:text-foreground">
                                Jobs
                            </Link>
                            <span>/</span>
                            {!isNewJob && (
                                <>
                                    <Link href={JOB_ROUTES.VIEW(jobId)} className="hover:text-foreground">
                                        {title || 'Job'}
                                    </Link>
                                    <span>/</span>
                                </>
                            )}
                            <span className="text-foreground">{isNewJob ? 'New Job' : 'Edit'}</span>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">
                            {isNewJob ? 'New Job' : 'Edit Job'}
                        </h1>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <Card className="mb-6 border-red-200 dark:border-red-800">
                            <CardContent className="py-4">
                                <p className="text-red-600 dark:text-red-400">{error}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Info: Add items after saving */}
                    {!isNewJob && (
                        <Card className="mb-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                            <CardContent className="py-4">
                                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    💡 <strong>Add billable items:</strong> Save your changes, then view the job to add and manage billable items (hours, expenses, etc.).
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Warning if no clients */}
                    {clients.length === 0 && (
                        <Card className="mb-6 border-yellow-200 dark:border-yellow-800">
                            <CardContent className="py-4">
                                <p className="text-yellow-600 dark:text-yellow-400 mb-2">
                                    No active clients found. You need to create a client first.
                                </p>
                                <Link href={CLIENT_ROUTES.NEW}>
                                    <Button variant="secondary" className="text-sm">
                                        Create a Client
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Basic Information */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Basic Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label htmlFor="clientId" className="block text-sm font-medium text-foreground mb-2">
                                        Client <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        id="clientId"
                                        value={clientId}
                                        onChange={(e) => setClientId(e.target.value)}
                                        required
                                        disabled={clients.length === 0}
                                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <option value="">Select a client...</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {client.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                                        Job Title <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        id="title"
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Website Redesign Project"
                                        required
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label htmlFor="reference" className="block text-sm font-medium text-foreground mb-2">
                                            Reference / PO Number
                                        </label>
                                        <Input
                                            id="reference"
                                            type="text"
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            placeholder="PO-2024-001"
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="status" className="block text-sm font-medium text-foreground mb-2">
                                            Status <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            id="status"
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as JobStatus)}
                                            required
                                            className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="active">Active</option>
                                            <option value="completed">Completed</option>
                                            <option value="archived">Archived</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="description" className="block text-sm font-medium text-foreground mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Detailed description of the job..."
                                        rows={4}
                                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Dates & Billing */}
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Dates & Billing Defaults</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label htmlFor="startDate" className="block text-sm font-medium text-foreground mb-2">
                                            Start Date
                                        </label>
                                        <Input
                                            id="startDate"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="endDate" className="block text-sm font-medium text-foreground mb-2">
                                            End Date
                                        </label>
                                        <Input
                                            id="endDate"
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            min={startDate}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="defaultDailyHours" className="block text-sm font-medium text-foreground mb-2">
                                        Default Daily Hours
                                    </label>
                                    <Input
                                        id="defaultDailyHours"
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="24"
                                        value={defaultDailyHours}
                                        onChange={(e) => setDefaultDailyHours(e.target.value)}
                                        placeholder="8"
                                    />
                                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                                        Default hours per day for daily billing (e.g., 8 hours)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => router.back()}
                                disabled={saving}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={saving || clients.length === 0}
                                className="flex-1"
                            >
                                {saving ? 'Saving...' : (isNewJob ? 'Create Job' : 'Save Changes')}
                            </Button>
                        </div>
                    </form>
                </main>
            </div>
        </ProtectedRoute>
    );
}
