'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { ROUTES, WORKSPACE_NAV_ITEMS, type NavItem } from '@/lib/routes';

export function AppHeader() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        router.push(ROUTES.PUBLIC.LOGIN);
        setMobileMenuOpen(false);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
                {/* Logo */}
                <Link
                    href={ROUTES.WORKSPACE.DASHBOARD}
                    className="flex items-center gap-2 text-xl font-semibold hover:opacity-80 transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                >
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

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-6">
                    {WORKSPACE_NAV_ITEMS.map((item: NavItem) => (
                        <Link
                            key={item.href}
                            href={item.comingSoon ? '#' : item.href}
                            className={`text-sm font-medium transition-colors flex items-center gap-1 ${item.comingSoon
                                    ? 'text-foreground/40 cursor-not-allowed'
                                    : pathname === item.href || pathname.startsWith(item.href + '/')
                                        ? 'text-foreground'
                                        : 'text-foreground/80 hover:text-foreground'
                                }`}
                            onClick={(e) => {
                                if (item.comingSoon) {
                                    e.preventDefault();
                                } else {
                                    setMobileMenuOpen(false);
                                }
                            }}
                        >
                            {item.icon && <span>{item.icon}</span>}
                            <span>{item.label}</span>
                            {item.comingSoon && (
                                <span className="text-xs bg-foreground/10 px-1.5 py-0.5 rounded">Soon</span>
                            )}
                        </Link>
                    ))}

                    <div className="flex items-center gap-3 ml-2 pl-2 border-l border-foreground/10">
                        <span className="text-sm text-foreground/60 hidden lg:inline-block">
                            {user?.email}
                        </span>
                        <Button onClick={handleSignOut} variant="ghost" className="text-sm">
                            Sign Out
                        </Button>
                    </div>
                </nav>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden p-2 hover:bg-foreground/5 rounded-md transition-colors"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label="Toggle menu"
                >
                    {mobileMenuOpen ? (
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden border-t border-foreground/10 bg-background">
                    <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
                        {WORKSPACE_NAV_ITEMS.map((item: NavItem) => (
                            <Link
                                key={item.href}
                                href={item.comingSoon ? '#' : item.href}
                                className={`text-sm font-medium py-2 transition-colors flex items-center gap-2 ${item.comingSoon
                                        ? 'text-foreground/40 cursor-not-allowed'
                                        : pathname === item.href || pathname.startsWith(item.href + '/')
                                            ? 'text-foreground'
                                            : 'text-foreground/80 hover:text-foreground'
                                    }`}
                                onClick={(e) => {
                                    if (item.comingSoon) {
                                        e.preventDefault();
                                    } else {
                                        setMobileMenuOpen(false);
                                    }
                                }}
                            >
                                {item.icon && <span>{item.icon}</span>}
                                <span>{item.label}</span>
                                {item.comingSoon && (
                                    <span className="text-xs bg-foreground/10 px-1.5 py-0.5 rounded">Soon</span>
                                )}
                            </Link>
                        ))}

                        <div className="pt-4 border-t border-foreground/10 flex flex-col gap-3">
                            <span className="text-sm text-foreground/60">
                                {user?.email}
                            </span>
                            <Button onClick={handleSignOut} variant="secondary" className="w-full">
                                Sign Out
                            </Button>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
}
