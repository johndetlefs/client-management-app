'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { useRouter } from 'next/navigation';
import { getCurrentUserTenantId } from '@/lib/tenant';
import { AppHeader } from '@/components/layout/AppHeader';
import { ROUTES } from '@/lib/routes';

export default function WorkspaceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantLoading, setTenantLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Handle authentication check
    useEffect(() => {
        if (!authLoading && !user) {
            // Not authenticated, redirect to login
            router.push(ROUTES.PUBLIC.LOGIN);
        }
    }, [user, authLoading, router]);

    // Handle tenant check
    useEffect(() => {
        async function checkTenant() {
            if (authLoading || !user) {
                return;
            }

            setTenantLoading(true);
            setError(null);

            try {
                const tid = await getCurrentUserTenantId();
                if (!tid) {
                    setError('No tenant found for this user. Please contact support.');
                } else {
                    setTenantId(tid);
                }
            } catch (err) {
                console.error('Error fetching tenant ID:', err);
                setError('Failed to load workspace. Please try again.');
            } finally {
                setTenantLoading(false);
            }
        }

        checkTenant();
    }, [user, authLoading]);

    // Show loading state while checking auth or tenant
    if (authLoading || tenantLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
                    <p className="text-foreground/60">
                        {authLoading ? 'Checking authentication...' : 'Loading workspace...'}
                    </p>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="max-w-md p-8 bg-foreground/5 rounded-lg text-center">
                    <div className="text-red-600 dark:text-red-400 mb-4">
                        <svg
                            className="h-12 w-12 mx-auto"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Workspace Error</h2>
                    <p className="text-foreground/60 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        );
    }

    // User is authenticated and tenant is loaded
    if (!user || !tenantId) {
        return null;
    }

    return (
        <WorkspaceProvider tenantId={tenantId}>
            <div className="min-h-screen bg-background">
                <AppHeader />
                <main>{children}</main>
            </div>
        </WorkspaceProvider>
    );
}
