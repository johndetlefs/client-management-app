'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { getCurrentUserTenantId } from '@/lib/tenant';

export default function PrintLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantLoading, setTenantLoading] = useState(true);
    const [tenantError, setTenantError] = useState<string | null>(null);

    // First check auth, then check tenant
    useEffect(() => {
        async function checkTenant() {
            if (authLoading) return;

            if (!user) {
                router.push('/login');
                return;
            }

            setTenantLoading(true);
            setTenantError(null);

            try {
                const id = await getCurrentUserTenantId();
                setTenantId(id);
            } catch (error) {
                console.error('Error loading tenant:', error);
                setTenantError('Failed to load workspace. Please try again.');
            } finally {
                setTenantLoading(false);
            }
        }

        checkTenant();
    }, [user, authLoading, router]);

    // Show loading state while checking auth
    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-600">Checking authentication...</p>
            </div>
        );
    }

    // Show loading state while fetching tenant
    if (tenantLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-600">Loading workspace...</p>
            </div>
        );
    }

    // Show error state
    if (tenantError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <p className="text-red-600">{tenantError}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                    Reload
                </button>
            </div>
        );
    }

    // Only render when we have tenantId
    if (!tenantId) {
        return null;
    }

    return (
        <WorkspaceProvider tenantId={tenantId}>
            {children}
        </WorkspaceProvider>
    );
}

