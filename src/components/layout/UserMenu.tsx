'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { ROUTES } from '@/lib/routes';

interface UserMenuProps {
    isOpen: boolean;
    onClose: () => void;
    triggerRef?: React.RefObject<HTMLElement | null>;
}

export function UserMenu({ isOpen, onClose, triggerRef }: UserMenuProps) {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const menuRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    const handleClose = useCallback(() => {
        onClose();
        // Return focus to the trigger button after closing
        setTimeout(() => {
            triggerRef?.current?.focus();
        }, 100);
    }, [onClose, triggerRef]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            // Check if click is outside menu AND not on the trigger button
            const isOutsideMenu = menuRef.current && !menuRef.current.contains(target);
            const isNotTrigger = !triggerRef?.current || !triggerRef.current.contains(target);

            if (isOutsideMenu && isNotTrigger) {
                handleClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };

        // Focus trap: cycle focus within the drawer
        const handleTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab' || !isOpen) return;

            const focusableElements = menuRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            if (!focusableElements || focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey) {
                // Shift + Tab: moving backwards
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: moving forwards
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };

        if (isOpen) {
            // Add a small delay before attaching click-outside handler
            // This prevents the opening click from immediately closing the menu
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);

            document.addEventListener('keydown', handleEscape);
            document.addEventListener('keydown', handleTab);
            // Prevent body scroll when menu is open
            document.body.style.overflow = 'hidden';

            // Focus the close button when drawer opens
            setTimeout(() => {
                closeButtonRef.current?.focus();
            }, 100);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('keydown', handleEscape);
                document.removeEventListener('keydown', handleTab);
                document.body.style.overflow = 'unset';
            };
        }
    }, [isOpen, handleClose, onClose, triggerRef]);

    const handleSignOut = async () => {
        await signOut();
        router.push(ROUTES.PUBLIC.LOGIN);
        onClose();
    };

    const handleUpdatePassword = () => {
        router.push(ROUTES.PUBLIC.RESET_PASSWORD);
        onClose();
    };

    const handleSettings = () => {
        router.push(ROUTES.WORKSPACE.SETTINGS);
        onClose();
    };

    if (!user) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            />

            {/* Side Nav */}
            <div
                ref={menuRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="user-menu-title"
                className={`fixed top-0 right-0 h-full w-80 bg-background border-l border-foreground/10 shadow-xl z-[70] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-foreground/10">
                        <h2 id="user-menu-title" className="text-lg font-semibold">Account</h2>
                        <button
                            ref={closeButtonRef}
                            onClick={handleClose}
                            className="p-2 hover:bg-foreground/5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
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
                                onClick={handleSettings}
                                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
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
                                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                    />
                                </svg>
                                <div>
                                    <div className="font-medium">Settings</div>
                                    <div className="text-xs text-foreground/60">
                                        Business & invoice settings
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={handleUpdatePassword}
                                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
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
                                className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-foreground/5 transition-colors text-left text-red-600 dark:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
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
