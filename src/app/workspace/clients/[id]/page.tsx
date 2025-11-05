'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { getCurrentUserTenantId } from '@/lib/tenant';
import { getClient, deleteClient } from '../actions';
import { CLIENT_ROUTES } from '@/lib/routes';
import type { Client } from '@/types/client';

export default function ClientViewPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.id as string;

    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadClient = async () => {
            setLoading(true);
            setError(null);

            const tenantId = await getCurrentUserTenantId();
            if (!tenantId) {
                setError('Unable to determine your tenant.');
                setLoading(false);
                return;
            }

            const result = await getClient(tenantId, clientId);
            if (result.success) {
                setClient(result.data);
            } else {
                setError(result.error);
            }
            setLoading(false);
        };

        loadClient();
    }, [clientId]);

    const handleDelete = async () => {
        if (!client) return;

        if (!confirm(`Are you sure you want to delete ${client.name}? This action cannot be undone.`)) {
            return;
        }

        const tenantId = await getCurrentUserTenantId();
        if (!tenantId) {
            alert('Unable to determine your tenant.');
            return;
        }

        const result = await deleteClient(tenantId, clientId);
        if (result.success) {
            router.push(CLIENT_ROUTES.LIST);
        } else {
            alert(`Failed to delete client: ${result.error}`);
        }
    };

    const formatDate = (timestamp: Timestamp | Date | undefined) => {
        if (!timestamp) return 'N/A';
        
        // Handle Firestore Timestamp
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
        return date.toLocaleDateString('en-AU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-black">
                    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <Card>
                            <CardContent className="py-12 text-center">
                                <p className="text-zinc-600 dark:text-zinc-400">Loading client...</p>
                            </CardContent>
                        </Card>
                    </main>
                </div>
            </ProtectedRoute>
        );
    }

    if (error || !client) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen bg-zinc-50 dark:bg-black">
                    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <Card className="border-red-200 dark:border-red-800">
                            <CardContent className="py-12 text-center">
                                <p className="text-red-600 dark:text-red-400 mb-4">
                                    {error || 'Client not found'}
                                </p>
                                <Button onClick={() => router.push(CLIENT_ROUTES.LIST)}>
                                    Back to Clients
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
                            <Link href={CLIENT_ROUTES.LIST} className="hover:text-foreground">
                                Clients
                            </Link>
                            <span>/</span>
                            <span className="text-foreground">{client.name}</span>
                        </div>
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
                                {!client.isActive && (
                                    <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 mt-2">
                                        Inactive
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Link href={CLIENT_ROUTES.EDIT(clientId)}>
                                    <Button>Edit Client</Button>
                                </Link>
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
                                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Email</dt>
                                    <dd className="mt-1 text-foreground">
                                        {client.email ? (
                                            <a href={`mailto:${client.email}`} className="hover:underline">
                                                {client.email}
                                            </a>
                                        ) : (
                                            <span className="text-zinc-400 dark:text-zinc-600">Not provided</span>
                                        )}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Phone</dt>
                                    <dd className="mt-1 text-foreground">
                                        {client.phone ? (
                                            <a href={`tel:${client.phone}`} className="hover:underline">
                                                {client.phone}
                                            </a>
                                        ) : (
                                            <span className="text-zinc-400 dark:text-zinc-600">Not provided</span>
                                        )}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">ABN</dt>
                                    <dd className="mt-1 text-foreground">
                                        {client.abn || <span className="text-zinc-400 dark:text-zinc-600">Not provided</span>}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status</dt>
                                    <dd className="mt-1">
                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                            client.isActive
                                                ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                        }`}>
                                            {client.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    {/* Address */}
                    {client.address && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Address</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <address className="not-italic text-foreground">
                                    {client.address.street && <div>{client.address.street}</div>}
                                    <div>
                                        {[client.address.city, client.address.state, client.address.postcode]
                                            .filter(Boolean)
                                            .join(', ')}
                                    </div>
                                    {client.address.country && <div>{client.address.country}</div>}
                                </address>
                            </CardContent>
                        </Card>
                    )}

                    {/* Additional Contacts */}
                    {client.contacts && client.contacts.length > 0 && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Additional Contacts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {client.contacts.map((contact, index) => (
                                        <div key={index} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                                            <h4 className="font-medium text-foreground mb-2">{contact.name}</h4>
                                            <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                                                {contact.position && (
                                                    <div>
                                                        <dt className="text-zinc-600 dark:text-zinc-400">Position</dt>
                                                        <dd className="text-foreground">{contact.position}</dd>
                                                    </div>
                                                )}
                                                {contact.email && (
                                                    <div>
                                                        <dt className="text-zinc-600 dark:text-zinc-400">Email</dt>
                                                        <dd className="text-foreground">
                                                            <a href={`mailto:${contact.email}`} className="hover:underline">
                                                                {contact.email}
                                                            </a>
                                                        </dd>
                                                    </div>
                                                )}
                                                {contact.phone && (
                                                    <div>
                                                        <dt className="text-zinc-600 dark:text-zinc-400">Phone</dt>
                                                        <dd className="text-foreground">
                                                            <a href={`tel:${contact.phone}`} className="hover:underline">
                                                                {contact.phone}
                                                            </a>
                                                        </dd>
                                                    </div>
                                                )}
                                            </dl>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Notes */}
                    {client.notes && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle>Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-foreground whitespace-pre-wrap">{client.notes}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Metadata */}
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Metadata</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
                                <div>
                                    <dt className="text-zinc-600 dark:text-zinc-400">Created</dt>
                                    <dd className="mt-1 text-foreground">{formatDate(client.createdAt)}</dd>
                                </div>
                                <div>
                                    <dt className="text-zinc-600 dark:text-zinc-400">Last Updated</dt>
                                    <dd className="mt-1 text-foreground">{formatDate(client.updatedAt)}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>

                    {/* Back Button */}
                    <div className="flex justify-center">
                        <Button variant="secondary" onClick={() => router.push(CLIENT_ROUTES.LIST)}>
                            Back to Clients
                        </Button>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
