'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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

    if (!user || !isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]" />
            <div ref={menuRef} role="dialog" aria-modal="true" aria-labelledby="user-menu-title" className="fixed top-0 right-0 h-full w-full max-w-sm bg-background border-l border-foreground/10 shadow-xl z-[70] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-foreground/10"><h2 id="user-menu-title" className="text-lg font-semibold">Settings &amp; account</h2><button ref={closeButtonRef} onClick={handleClose} className="px-3 py-2 rounded-lg hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-foreground">Close</button></div>
                <div className="p-6 space-y-6">
                    <section><h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60 mb-2">Business</h3><nav aria-label="Business settings" className="space-y-2"><button onClick={handleSettings} className="block w-full text-left px-4 py-3 rounded-lg hover:bg-foreground/5"><span className="block font-medium">Business settings</span><span className="block text-xs text-foreground/60 mt-1">Business details, invoices, quotes and tax</span></button><button onClick={() => { router.push(ROUTES.WORKSPACE.EXPENSE_SETTINGS); onClose(); }} className="block w-full text-left px-4 py-3 rounded-lg hover:bg-foreground/5"><span className="block font-medium">Expense settings</span><span className="block text-xs text-foreground/60 mt-1">Categories, merchant rules and GST treatment</span></button></nav></section>
                    <section className="border-t border-foreground/10 pt-6"><h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60 mb-3">Personal account</h3>{user.displayName && <p className="font-medium">{user.displayName}</p>}<p className="text-sm text-foreground/65 break-all mb-3">{user.email}</p><nav aria-label="Personal account" className="space-y-2"><button onClick={handleUpdatePassword} className="block w-full text-left px-4 py-3 rounded-lg hover:bg-foreground/5 font-medium">Change password</button><button onClick={handleSignOut} className="block w-full text-left px-4 py-3 rounded-lg hover:bg-foreground/5 text-red-600 dark:text-red-400 font-medium">Sign out</button></nav></section>
                </div>
            </div>
        </>
    );
}
