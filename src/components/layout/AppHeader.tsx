'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { UserMenu } from '@/components/layout/UserMenu';
import { ROUTES, WORKSPACE_NAV_ITEMS, getWorkspaceNavigation, type WorkspaceSection } from '@/lib/routes';

interface NavigationSectionProps {
    section: WorkspaceSection;
    active: boolean;
    activeHref?: string;
    open: boolean;
    mobile?: boolean;
    onToggle: (button: HTMLButtonElement) => void;
    onNavigate: () => void;
}

function NavigationSection({ section, active, activeHref, open, mobile = false, onToggle, onNavigate }: NavigationSectionProps) {
    const panelId = `navigation-${mobile ? 'mobile' : 'desktop'}-${section.id}`;
    const itemClass = `block rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${active ? 'bg-foreground/5 text-foreground' : 'text-foreground/70 hover:bg-foreground/5 hover:text-foreground'}`;
    if (!section.children.length) {
        return <Link href={section.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={itemClass}>{section.label}</Link>;
    }
    return <div className="relative">
        <button type="button" aria-expanded={open} aria-controls={panelId} onClick={event => onToggle(event.currentTarget)} className={`${itemClass} ${mobile ? 'w-full text-left' : ''}`}>{section.label}</button>
        {open && <ul id={panelId} aria-label={`${section.label} pages`} className={mobile ? 'ml-3 mt-1 space-y-1 border-l border-foreground/15 pl-3' : 'absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-foreground/10 bg-background p-1.5 shadow-lg'}>
            {section.children.map(item => <li key={item.href}><Link href={item.href} onClick={onNavigate} aria-current={activeHref === item.href ? 'page' : undefined} className={`block rounded-md px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-foreground ${activeHref === item.href ? 'bg-foreground/5 font-medium text-foreground' : 'text-foreground/75 hover:bg-foreground/5 hover:text-foreground'}`}>{item.label}</Link></li>)}
        </ul>}
    </div>;
}

export function AppHeader() {
    const { user } = useAuth();
    const pathname = usePathname();
    const { section, item: activeItem } = getWorkspaceNavigation(pathname);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const headerRef = useRef<HTMLElement>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const accountButtonRef = useRef<HTMLButtonElement>(null);
    const groupButtonRef = useRef<HTMLButtonElement | null>(null);
    const closeNavigation = () => {
        setOpenGroup(null);
        setMobileMenuOpen(false);
    };

    useEffect(() => {
        if (!openGroup && !mobileMenuOpen) return;
        const dismissOutside = (event: PointerEvent) => {
            if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
                setOpenGroup(null);
                setMobileMenuOpen(false);
            }
        };
        const dismissWithEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (openGroup) {
                setOpenGroup(null);
                groupButtonRef.current?.focus();
            } else {
                setMobileMenuOpen(false);
                menuButtonRef.current?.focus();
            }
        };
        document.addEventListener('pointerdown', dismissOutside);
        document.addEventListener('keydown', dismissWithEscape);
        return () => {
            document.removeEventListener('pointerdown', dismissOutside);
            document.removeEventListener('keydown', dismissWithEscape);
        };
    }, [openGroup, mobileMenuOpen]);

    const navigationItems = (mobile: boolean) => WORKSPACE_NAV_ITEMS.map(group => <NavigationSection
        key={group.id}
        section={group}
        active={section?.id === group.id}
        activeHref={activeItem?.href}
        open={openGroup === group.id}
        mobile={mobile}
        onToggle={button => {
            groupButtonRef.current = button;
            setOpenGroup(current => current === group.id ? null : group.id);
        }}
        onNavigate={closeNavigation}
    />);

    return <>
        <UserMenu isOpen={userMenuOpen} onClose={() => setUserMenuOpen(false)} triggerRef={accountButtonRef} />
        <header ref={headerRef} className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background no-print">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
                <Link href={ROUTES.WORKSPACE.DASHBOARD} onClick={closeNavigation} aria-label="ClientFlow home" className="shrink-0 text-xl font-semibold hover:opacity-80">ClientFlow</Link>
                <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex lg:gap-3">{navigationItems(false)}</nav>
                <div className="flex items-center gap-3">
                    <button ref={menuButtonRef} type="button" onClick={() => { setMobileMenuOpen(open => !open); setOpenGroup(null); }} aria-controls="workspace-mobile-menu" aria-expanded={mobileMenuOpen} className="rounded-lg border border-foreground/20 px-3 py-2 text-sm font-medium md:hidden">{mobileMenuOpen ? 'Close menu' : 'Menu'}</button>
                    <button ref={accountButtonRef} type="button" onClick={() => { closeNavigation(); setUserMenuOpen(true); }} aria-label="Settings and account" aria-haspopup="dialog" aria-expanded={userMenuOpen} className="shrink-0 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
                        <Avatar email={user?.email || ''} photoURL={user?.photoURL} displayName={user?.displayName} size={36} />
                    </button>
                </div>
            </div>
            {mobileMenuOpen && <nav id="workspace-mobile-menu" aria-label="Main navigation" className="max-h-[calc(100dvh-4rem)] space-y-2 overflow-y-auto border-t border-foreground/10 px-4 py-4 md:hidden">{navigationItems(true)}</nav>}
        </header>
    </>;
}
