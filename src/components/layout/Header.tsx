'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { AppHeader } from './AppHeader';

export function Header() {
    const { user, loading } = useAuth();
    const pathname = usePathname();

    // Define public/marketing routes (landing, auth pages)
    const publicRoutes = [
        '/',
        '/login',
        '/signup',
        '/reset-password',
        // Add future marketing pages here: '/about', '/pricing', etc.
    ];

    // Define private app routes
    const appRoutes = [
        '/dashboard',
        '/clients',
        '/jobs',
        '/invoices',
        // Add other app routes here
    ];

    // Determine which header to show
    const isPublicRoute = pathname && publicRoutes.some(route =>
        route === '/' ? pathname === '/' : pathname.startsWith(route)
    );

    const isAppRoute = pathname && appRoutes.some(route =>
        pathname.startsWith(route)
    );

    // Show app header for authenticated app routes
    if (isAppRoute) {
        return <AppHeader />;
    }

    // Show public header for marketing/auth pages
    if (!isPublicRoute) {
        return null;
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 text-xl font-semibold hover:opacity-80 transition-opacity">
                    <svg
                        className="h-8 w-8"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <path d="M9 3v18" />
                        <path d="M9 9h6" />
                        <path d="M9 15h6" />
                    </svg>
                    <span>ClientFlow</span>
                </Link>

                {/* Navigation */}
                <nav className="flex items-center gap-4">
                    {loading ? (
                        <div className="h-9 w-24 animate-pulse bg-foreground/10 rounded" />
                    ) : user ? (
                        <>
                            <Link
                                href="/dashboard"
                                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors hidden xs:inline-block"
                            >
                                Dashboard
                            </Link>
                            <Link href="/dashboard">
                                <Button variant="secondary">Go to App</Button>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
                            >
                                Login
                            </Link>
                            <Link href="/signup">
                                <Button>Sign Up</Button>
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
