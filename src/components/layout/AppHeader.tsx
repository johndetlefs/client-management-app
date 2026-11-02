'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef } from 'react';
import { UserMenu } from '@/components/layout/UserMenu';
import { ROUTES, WORKSPACE_NAV_ITEMS, getWorkspaceNavigation } from '@/lib/routes';

export function AppHeader() {
    const pathname = usePathname();
    const { section, item: activeItem } = getWorkspaceNavigation(pathname);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [accountFromMobile, setAccountFromMobile] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const accountButtonRef = useRef<HTMLButtonElement>(null);
    const closeNavigation = () => setMobileMenuOpen(false);
    return <>
        <UserMenu isOpen={userMenuOpen} onClose={() => setUserMenuOpen(false)} triggerRef={accountFromMobile ? menuButtonRef : accountButtonRef} />
        <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background no-print">
            <div className="mx-auto max-w-7xl flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
                <Link href={ROUTES.WORKSPACE.DASHBOARD} onClick={closeNavigation} aria-label="ClientFlow home" className="text-xl font-semibold hover:opacity-80 shrink-0">ClientFlow</Link>
                <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1 lg:gap-3">
                    {WORKSPACE_NAV_ITEMS.map(item => <Link key={item.id} href={item.href} onClick={closeNavigation} aria-current={section?.id === item.id ? 'page' : undefined} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${section?.id === item.id ? 'bg-foreground/5 text-foreground' : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'}`}>{item.label}</Link>)}
                </nav>
                <button ref={accountButtonRef} onClick={() => { setAccountFromMobile(false); setUserMenuOpen(true); }} aria-haspopup="dialog" aria-expanded={userMenuOpen} className="hidden md:block text-sm font-medium px-3 py-2 rounded-lg hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-foreground">Settings &amp; account</button>
                <button ref={menuButtonRef} onClick={() => setMobileMenuOpen(open => !open)} aria-controls="workspace-mobile-menu" aria-expanded={mobileMenuOpen} className="md:hidden text-sm font-medium px-3 py-2 rounded-lg border border-foreground/20">{mobileMenuOpen ? 'Close menu' : 'Menu'}</button>
            </div>
            {mobileMenuOpen && <nav id="workspace-mobile-menu" aria-label="Main navigation" className="md:hidden border-t border-foreground/10 px-4 py-4 max-h-[calc(100dvh-4rem)] overflow-y-auto space-y-3">
                {WORKSPACE_NAV_ITEMS.map(group => <div key={group.id}><Link href={group.href} onClick={closeNavigation} aria-current={section?.id === group.id ? 'page' : undefined} className={`block px-3 py-2 rounded-lg font-medium ${section?.id === group.id ? 'bg-foreground/5' : 'hover:bg-foreground/5'}`}>{group.label}</Link>{group.children.length > 0 && <ul className="ml-3 mt-1 border-l border-foreground/15 pl-3 space-y-1">{group.children.map(item => <li key={item.href}><Link href={item.href} onClick={closeNavigation} aria-current={activeItem?.href === item.href ? 'page' : undefined} className="block px-3 py-2 text-sm text-foreground/70 hover:text-foreground hover:underline">{item.label}</Link></li>)}</ul>}</div>)}
                <button onClick={() => { setMobileMenuOpen(false); setAccountFromMobile(true); setUserMenuOpen(true); }} className="w-full text-left font-medium border-t border-foreground/10 px-3 pt-4 pb-2">Settings &amp; account</button>
            </nav>}
        </header>
    </>;
}
