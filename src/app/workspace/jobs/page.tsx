'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getCurrentUserTenantId } from '@/lib/tenant';
import { getJobs, deleteJob, archiveJob } from './actions';
import { JOB_ROUTES, CLIENT_ROUTES } from '@/lib/routes';
import type { JobWithClient, JobStatus } from '@/types/job';

export default function JobsPage() {
    const router = useRouter();
    const [jobs, setJobs] = useState<JobWithClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Derive filtered jobs from jobs, searchTerm, and statusFilter
    const filteredJobs = useMemo(() => {
        let result = jobs;

        // Apply status filter
        if (statusFilter !== 'all') {
            result = result.filter(job => job.status === statusFilter);
        }

        // Apply search filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            result = result.filter(job =>
                job.title.toLowerCase().includes(searchLower) ||
                job.clientName.toLowerCase().includes(searchLower) ||
                (job.reference && job.reference.toLowerCase().includes(searchLower)) ||
                (job.description && job.description.toLowerCase().includes(searchLower))
            );
        }

        return result;
    }, [searchTerm, statusFilter, jobs]);

    // Load jobs on mount and when refreshTrigger changes
    useEffect(() => {
        const loadJobs = async () => {
            setLoading(true);
            setError(null);

            const tenantId = await getCurrentUserTenantId();
            if (!tenantId) {
                setError('Unable to determine your tenant. Please contact support.');
                setLoading(false);
                return;
            }

            const result = await getJobs(tenantId);
            if (result.success) {
                setJobs(result.data);
            } else {
                setError(result.error);
            }
            setLoading(false);
        };

        loadJobs();
    }, [refreshTrigger]);

    const handleDelete = async (jobId: string, jobTitle: string) => {
        if (!confirm(`Are you sure you want to delete "${jobTitle}"? This action cannot be undone.`)) {
            return;
        }

        const tenantId = await getCurrentUserTenantId();
        if (!tenantId) {
            alert('Unable to determine your tenant.');
            return;
        }

        const result = await deleteJob(tenantId, jobId);
        if (result.success) {
            setRefreshTrigger(prev => prev + 1);
        } else {
            alert(`Failed to delete job: ${result.error}`);
        }
    };

    const handleArchive = async (jobId: string, jobTitle: string) => {
        if (!confirm(`Archive "${jobTitle}"?`)) {
            return;
        }

        const tenantId = await getCurrentUserTenantId();
        if (!tenantId) {
            alert('Unable to determine your tenant.');
            return;
        }

        const result = await archiveJob(tenantId, jobId);
        if (result.success) {
            setRefreshTrigger(prev => prev + 1);
        } else {
            alert(`Failed to archive job: ${result.error}`);
        }
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

    const formatDate = (date: Date | undefined) => {
        if (!date) return 'Not set';
        return new Date(date).toLocaleDateString('en-AU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-black">
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-foreground">Jobs</h1>
                        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                            Manage projects and engagements
                        </p>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <Input
                                type="search"
                                placeholder="Search jobs by title, client, or reference..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full"
                                aria-label="Search jobs"
                            />
                        </div>
                        <div className="w-full sm:w-48">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as JobStatus | 'all')}
                                className="w-full px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Filter by status"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                        <Button
                            onClick={() => router.push(JOB_ROUTES.NEW)}
                            className="whitespace-nowrap"
                        >
                            + New Job
                        </Button>
                    </div>

                    {/* Error State */}
                    {error && (
                        <Card className="mb-6 border-red-200 dark:border-red-800">
                            <CardContent className="py-4">
                                <p className="text-red-600 dark:text-red-400">{error}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-zinc-600 dark:text-zinc-400">Loading jobs...</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty State */}
                    {!loading && !error && filteredJobs.length === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    {searchTerm || statusFilter !== 'all' ? 'No jobs found' : 'No jobs yet'}
                                </h3>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                                    {searchTerm || statusFilter !== 'all'
                                        ? 'Try adjusting your search terms or filters'
                                        : 'Get started by creating your first job'
                                    }
                                </p>
                                {!searchTerm && statusFilter === 'all' && (
                                    <Button onClick={() => router.push(JOB_ROUTES.NEW)}>
                                        + New Job
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Jobs List */}
                    {!loading && !error && filteredJobs.length > 0 && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredJobs.map((job) => (
                                <Card key={job.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="text-lg truncate">
                                                    {job.title}
                                                </CardTitle>
                                                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-2 ${getStatusColor(job.status)}`}>
                                                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                                                </span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm mb-4">
                                            <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                                                <span className="font-medium mr-2">Client:</span>
                                                <Link
                                                    href={CLIENT_ROUTES.VIEW(job.clientId)}
                                                    className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                                                >
                                                    {job.clientName}
                                                </Link>
                                            </div>
                                            {job.reference && (
                                                <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                                                    <span className="font-medium mr-2">Ref:</span>
                                                    <span className="truncate">{job.reference}</span>
                                                </div>
                                            )}
                                            {job.startDate && (
                                                <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                                                    <span className="font-medium mr-2">Start:</span>
                                                    <span>{formatDate(job.startDate as Date)}</span>
                                                </div>
                                            )}
                                            {job.endDate && (
                                                <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                                                    <span className="font-medium mr-2">End:</span>
                                                    <span>{formatDate(job.endDate as Date)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Link
                                                href={JOB_ROUTES.VIEW(job.id)}
                                                className="flex-1"
                                            >
                                                <Button variant="secondary" className="w-full">
                                                    View
                                                </Button>
                                            </Link>
                                            <Link
                                                href={JOB_ROUTES.EDIT(job.id)}
                                                className="flex-1"
                                            >
                                                <Button variant="secondary" className="w-full">
                                                    Edit
                                                </Button>
                                            </Link>
                                            {job.status !== 'archived' && (
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => handleArchive(job.id, job.title)}
                                                    className="px-3"
                                                    aria-label="Archive job"
                                                    title="Archive"
                                                >
                                                    📦
                                                </Button>
                                            )}
                                            <Button
                                                variant="secondary"
                                                onClick={() => handleDelete(job.id, job.title)}
                                                className="px-3"
                                                aria-label="Delete job"
                                                title="Delete"
                                            >
                                                🗑️
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Results Count */}
                    {!loading && !error && filteredJobs.length > 0 && (
                        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                            Showing {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
                            {(searchTerm || statusFilter !== 'all') && (
                                <> matching your filters</>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}
