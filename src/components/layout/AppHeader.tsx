'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { UserMenu } from '@/components/layout/UserMenu';
import { ROUTES, WORKSPACE_NAV_ITEMS, type NavItem } from '@/lib/routes';

export function AppHeader() {
    const { user } = useAuth();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const avatarButtonRef = useRef<HTMLButtonElement>(null);

    const toggleUserMenu = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.stopPropagation(); // Prevent event from bubbling to backdrop
        setUserMenuOpen(!userMenuOpen);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleUserMenu(e);
        }
    };

    return (
        <>
            <UserMenu isOpen={userMenuOpen} onClose={() => setUserMenuOpen(false)} triggerRef={avatarButtonRef} />
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

                        <button
                            ref={avatarButtonRef}
                            onClick={toggleUserMenu}
                            onKeyDown={handleKeyDown}
                            className="ml-4 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:ring-offset-2 rounded-full"
                            aria-label={userMenuOpen ? "Close user menu" : "Open user menu"}
                            aria-expanded={userMenuOpen}
                        >
                            <Avatar
                                email={user?.email || ''}
                                photoURL={user?.photoURL}
                                displayName={user?.displayName}
                                size={36}
                            />
                        </button>
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

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMobileMenuOpen(false);
                                    setUserMenuOpen(true);
                                }}
                                className="pt-4 border-t border-foreground/10 flex items-center gap-3 hover:bg-foreground/5 rounded-lg p-3 -mx-3 transition-colors"
                                aria-label="Open account menu"
                            >
                                <Avatar
                                    email={user?.email || ''}
                                    photoURL={user?.photoURL}
                                    displayName={user?.displayName}
                                    size={40}
                                />
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-medium">Account</div>
                                    <div className="text-xs text-foreground/60">{user?.email}</div>
                                </div>
                                <svg
                                    className="h-5 w-5 text-foreground/60"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                        </nav>
                    </div>
                )}
            </header>
        </>
    );
}
