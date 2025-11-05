'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useWorkspace } from '@/contexts/WorkspaceContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getClients, deleteClient } from './actions';
import { CLIENT_ROUTES } from '@/lib/routes';
import type { Client } from '@/types/client';

export default function ClientsPage() {
    const router = useRouter();
    const { tenantId } = useWorkspace();
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

            const result = await getClients(tenantId);
            if (result.success) {
                setClients(result.data);
            } else {
                setError(result.error);
            }
            setLoading(false);
        };

        loadClients();
    }, [refreshTrigger, tenantId]);

    const handleDelete = async (clientId: string, clientName: string) => {
        if (!confirm(`Are you sure you want to delete ${clientName}? This action cannot be undone.`)) {
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
                        <Card>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-zinc-200 dark:border-zinc-800">
                                            <th className="text-left py-3 px-4 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                                                Name
                                            </th>
                                            <th className="text-left py-3 px-4 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                                                Email
                                            </th>
                                            <th className="text-left py-3 px-4 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                                                Phone
                                            </th>
                                            <th className="text-left py-3 px-4 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                                                ABN
                                            </th>
                                            <th className="text-left py-3 px-4 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                                                Status
                                            </th>
                                            <th className="text-right py-3 px-4 font-medium text-sm text-zinc-600 dark:text-zinc-400">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredClients.map((client) => (
                                            <tr
                                                key={client.id}
                                                className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                                            >
                                                <td className="py-3 px-4">
                                                    <Link
                                                        href={CLIENT_ROUTES.VIEW(client.id)}
                                                        className="font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                                                    >
                                                        {client.name}
                                                    </Link>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                                                    {client.email || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                                                    {client.phone || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                                                    {client.abn || '—'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${client.isActive
                                                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                                        }`}>
                                                        {client.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={CLIENT_ROUTES.VIEW(client.id)}>
                                                            <Button
                                                                variant="icon"
                                                                aria-label="View client"
                                                                title="View"
                                                            >
                                                                👁️
                                                            </Button>
                                                        </Link>
                                                        <Link href={CLIENT_ROUTES.EDIT(client.id)}>
                                                            <Button
                                                                variant="icon"
                                                                aria-label="Edit client"
                                                                title="Edit"
                                                            >
                                                                ✏️
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="icon"
                                                            onClick={() => handleDelete(client.id, client.name)}
                                                            aria-label="Delete client"
                                                            title="Delete"
                                                        >
                                                            🗑️
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
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
