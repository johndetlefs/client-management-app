'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { ROUTES } from '@/lib/routes';

interface UserMenuProps {
    isOpen: boolean;
    onClose: () => void;
}

export function UserMenu({ isOpen, onClose }: UserMenuProps) {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll when menu is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    const handleSignOut = async () => {
        await signOut();
        router.push(ROUTES.PUBLIC.LOGIN);
        onClose();
    };

    const handleUpdatePassword = () => {
        router.push(ROUTES.PUBLIC.RESET_PASSWORD);
        onClose();
    };

    if (!user) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            />

            {/* Side Nav */}
            <div
                ref={menuRef}
                className={`fixed top-0 right-0 h-full w-80 bg-background border-l border-foreground/10 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-foreground/10">
                        <h2 className="text-lg font-semibold">Account</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-foreground/5 rounded-lg transition-colors"
                            aria-label="Close menu"
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* User Info */}
                    <div className="p-6 border-b border-foreground/10">
                        <div className="flex items-center gap-4">
                            <Avatar
                                email={user.email || ''}
                                photoURL={user.photoURL}
                                displayName={user.displayName}
                                size={64}
                            />
                            <div className="flex-1 min-w-0">
                                {user.displayName && (
                                    <div className="font-medium text-foreground truncate">
                                        {user.displayName}
                                    </div>
                                )}
                                <div className="text-sm text-foreground/60 truncate">
                                    {user.email}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Menu Options */}
                    <div className="flex-1 p-6">
                        <nav className="flex flex-col gap-2">
                            <button
                                onClick={handleUpdatePassword}
                                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors text-left"
                            >
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
                                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                                    />
                                </svg>
                                <div>
                                    <div className="font-medium">Update Password</div>
                                    <div className="text-xs text-foreground/60">
                                        Change your account password
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors text-left text-red-600 dark:text-red-400"
                            >
                                <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                    />
                                </svg>
                                <div>
                                    <div className="font-medium">Sign Out</div>
                                    <div className="text-xs opacity-60">
                                        Sign out of your account
                                    </div>
                                </div>
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        </>
    );
}
