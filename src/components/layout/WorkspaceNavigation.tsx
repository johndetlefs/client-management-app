'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WORKSPACE_ROUTES, getWorkspaceNavigation } from '@/lib/routes';

export function WorkspaceNavigation() {
    const pathname = usePathname();
    const { section, item, detail } = getWorkspaceNavigation(pathname);
    if (!section) return null;
    return <div className="no-print border-b border-foreground/10 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {section.children.length > 0 && <nav aria-label={`${section.label} sections`} className="flex gap-5 overflow-x-auto whitespace-nowrap">
                {section.children.map(child => <Link href={child.href} key={child.href} aria-current={item?.href === child.href ? 'page' : undefined} className={`py-3 text-sm font-medium border-b-2 shrink-0 ${item?.href === child.href ? 'border-foreground text-foreground' : 'border-transparent text-foreground/65 hover:text-foreground hover:border-foreground/20'}`}>{child.label}</Link>)}
            </nav>}
            <nav aria-label="Breadcrumb" className="py-3 text-xs text-foreground/60"><ol className="flex flex-wrap gap-2 items-center">
                <li><Link href={WORKSPACE_ROUTES.DASHBOARD} className="hover:underline">Home</Link></li>
                <li aria-hidden="true">/</li><li>{item || detail ? <Link href={section.href} className="hover:underline">{section.label}</Link> : <span aria-current="page">{section.label}</span>}</li>
                {item && <><li aria-hidden="true">/</li><li>{detail ? <Link href={item.href} className="hover:underline">{item.label}</Link> : <span aria-current="page">{item.label}</span>}</li></>}
                {detail && <><li aria-hidden="true">/</li><li aria-current="page">{detail}</li></>}
            </ol></nav>
        </div>
    </div>;
}
