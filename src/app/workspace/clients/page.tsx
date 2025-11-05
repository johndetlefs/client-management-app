'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getCurrentUserTenantId } from '@/lib/tenant';
import { getClients, deleteClient } from './actions';
import { CLIENT_ROUTES } from '@/lib/routes';
import type { Client } from '@/types/client';

export default function ClientsPage() {
    const router = useRouter();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Derive filtered clients from clients and searchTerm
    const filteredClients = useMemo(() => {
        if (!searchTerm) return clients;
        
        const searchLower = searchTerm.toLowerCase();
        return clients.filter(client =>
            client.name.toLowerCase().includes(searchLower) ||
            (client.email && client.email.toLowerCase().includes(searchLower)) ||
            (client.abn && client.abn.toLowerCase().includes(searchLower))
        );
    }, [searchTerm, clients]);

    // Load clients on mount and when refreshTrigger changes
    useEffect(() => {
        const loadClients = async () => {
            setLoading(true);
            setError(null);

            const tenantId = await getCurrentUserTenantId();
            if (!tenantId) {
                setError('Unable to determine your tenant. Please contact support.');
                setLoading(false);
                return;
            }

            const result = await getClients(tenantId);
            if (result.success) {
                setClients(result.data);
            } else {
                setError(result.error);
            }
            setLoading(false);
        };

        loadClients();
    }, [refreshTrigger]);

    const handleDelete = async (clientId: string, clientName: string) => {
        if (!confirm(`Are you sure you want to delete ${clientName}? This action cannot be undone.`)) {
            return;
        }

        const tenantId = await getCurrentUserTenantId();
        if (!tenantId) {
            alert('Unable to determine your tenant.');
            return;
        }

        const result = await deleteClient(tenantId, clientId);
        if (result.success) {
            // Trigger a refresh by incrementing the counter
            setRefreshTrigger(prev => prev + 1);
        } else {
            alert(`Failed to delete client: ${result.error}`);
        }
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-black">
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-foreground">Clients</h1>
                        <p className="text-zinc-600 dark:text-zinc-400 mt-2">
                            Manage your client records
                        </p>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1">
                            <Input
                                type="search"
                                placeholder="Search clients by name, email, or ABN..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <Button
                            onClick={() => router.push(CLIENT_ROUTES.NEW)}
                            className="whitespace-nowrap"
                        >
                            + New Client
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
                                <p className="text-zinc-600 dark:text-zinc-400">Loading clients...</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty State */}
                    {!loading && !error && filteredClients.length === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    {searchTerm ? 'No clients found' : 'No clients yet'}
                                </h3>
                                <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                                    {searchTerm 
                                        ? 'Try adjusting your search terms'
                                        : 'Get started by creating your first client'
                                    }
                                </p>
                                {!searchTerm && (
                                    <Button onClick={() => router.push(CLIENT_ROUTES.NEW)}>
                                        + New Client
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Clients List */}
                    {!loading && !error && filteredClients.length > 0 && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredClients.map((client) => (
                                <Card key={client.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="text-lg truncate">
                                                    {client.name}
                                                </CardTitle>
                                                {!client.isActive && (
                                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 mt-1">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2 text-sm mb-4">
                                            {client.email && (
                                                <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                                                    <span className="truncate">{client.email}</span>
                                                </div>
                                            )}
                                            {client.phone && (
                                                <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                                                    <span>{client.phone}</span>
                                                </div>
                                            )}
                                            {client.abn && (
                                                <div className="flex items-center text-zinc-600 dark:text-zinc-400">
                                                    <span className="text-xs">ABN: {client.abn}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Link 
                                                href={CLIENT_ROUTES.VIEW(client.id)}
                                                className="flex-1"
                                            >
                                                <Button variant="secondary" className="w-full">
                                                    View
                                                </Button>
                                            </Link>
                                            <Link 
                                                href={CLIENT_ROUTES.EDIT(client.id)}
                                                className="flex-1"
                                            >
                                                <Button variant="secondary" className="w-full">
                                                    Edit
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="secondary"
                                                onClick={() => handleDelete(client.id, client.name)}
                                                className="px-3"
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
                    {!loading && !error && filteredClients.length > 0 && (
                        <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
                            Showing {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}
                            {searchTerm && ` matching "${searchTerm}"`}
                        </div>
                    )}
                </main>
            </div>
        </ProtectedRoute>
    );
}
