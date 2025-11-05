'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-zinc-50 dark:bg-black">
                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Welcome!</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    You are signed in as:
                                </p>
                                <p className="font-medium text-foreground mt-2">{user?.email}</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Clients</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    Manage your client records
                                </p>
                                <Button 
                                    variant="secondary" 
                                    className="mt-4 w-full"
                                    onClick={() => router.push(ROUTES.CLIENTS.LIST)}
                                >
                                    View Clients
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Invoices</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    Create and manage invoices
                                </p>
                                <Button variant="secondary" className="mt-4 w-full" disabled>
                                    Coming Soon
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Auth Status Info */}
                    <Card className="mt-8">
                        <CardHeader>
                            <CardTitle className="text-lg">Authentication Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">User ID:</span>
                                    <span className="font-mono text-foreground">{user?.uid}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">Email Verified:</span>
                                    <span className={`font-medium ${user?.emailVerified ? 'text-green-600' : 'text-amber-600'}`}>
                                        {user?.emailVerified ? 'Yes' : 'No'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-600 dark:text-zinc-400">Created:</span>
                                    <span className="font-medium text-foreground">
                                        {user?.metadata.creationTime ?
                                            new Date(user.metadata.creationTime).toLocaleDateString('en-AU', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                            }) : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </ProtectedRoute>
    );
}
