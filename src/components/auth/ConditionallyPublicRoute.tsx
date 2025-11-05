'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ConditionallyPublicRouteProps {
    children: React.ReactNode;
    redirectTo?: string;
}

/**
 * Wrapper for conditionally public routes (e.g., login, signup)
 * These pages are public, but should redirect authenticated users away
 */
export function ConditionallyPublicRoute({
    children,
    redirectTo = '/dashboard',
}: ConditionallyPublicRouteProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) {
            router.push(redirectTo);
        }
    }, [user, loading, router, redirectTo]);

    // Show loading state while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground"></div>
            </div>
        );
    }

    // Don't render login/signup forms if user is already authenticated
    if (user) {
        return null;
    }

    return <>{children}</>;
}
