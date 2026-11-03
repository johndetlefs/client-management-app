/**
 * Centralized route configuration for the application
 * Provides type-safe route constants and helper functions
 */

/**
 * Public routes (unauthenticated)
 */
export const PUBLIC_ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  RESET_PASSWORD: "/reset-password",
} as const;

/**
 * Workspace routes (authenticated)
 */
export const WORKSPACE_ROUTES = {
  DASHBOARD: "/workspace/dashboard",
  CLIENTS: "/workspace/clients",
  JOBS: "/workspace/jobs", // Future
  INVOICES: "/workspace/invoices", // Future
  CREDITS: "/workspace/credits",
  EXPENSES: "/workspace/expenses",
  FINANCES: "/workspace/finances", // Legacy payment/report entry
  SALES: "/workspace/sales",
  BOOKKEEPING: "/workspace/bookkeeping",
  PAYMENTS: "/workspace/payments",
  REPORTS: "/workspace/reports",
  RECEIVABLES_REPORT: "/workspace/bookkeeping/receivables",
  BAS_REPORT: "/workspace/bookkeeping/bas",
  PROFIT_LOSS: "/workspace/reports/profit-loss",
  EXPENSE_SETTINGS: "/workspace/settings/expenses",
  QUOTES: "/workspace/quotes",
  SETTINGS: "/workspace/settings",
} as const;

/**
 * Client-specific routes
 */
export const CLIENT_ROUTES = {
  LIST: WORKSPACE_ROUTES.CLIENTS,
  NEW: "/workspace/clients/new/edit",
  VIEW: (id: string) => `/workspace/clients/${id}`,
  EDIT: (id: string) => `/workspace/clients/${id}/edit`,
} as const;

/**
 * Job-specific routes (future)
 */
export const JOB_ROUTES = {
  LIST: WORKSPACE_ROUTES.JOBS,
  NEW: "/workspace/jobs/new/edit",
  VIEW: (id: string) => `/workspace/jobs/${id}`,
  EDIT: (id: string) => `/workspace/jobs/${id}/edit`,
} as const;

/**
 * Invoice-specific routes (future)
 */
export const INVOICE_ROUTES = {
  LIST: WORKSPACE_ROUTES.INVOICES,
  NEW: "/workspace/invoices/new",
  VIEW: (id: string) => `/workspace/invoices/${id}`,
  PRINT: (id: string) => `/workspace/invoices/${id}/print`,
  PUBLIC: (token: string) => `/public/invoice/${token}`, // Public invoice view
} as const;

export const CREDIT_ROUTES = {
  LIST: WORKSPACE_ROUTES.CREDITS,
  NEW: "/workspace/credits/new",
  VIEW: (id: string) => `/workspace/credits/${id}`,
  EDIT: (id: string) => `/workspace/credits/${id}/edit`,
  PRINT: (id: string) => `/workspace/credits/${id}/print`,
  PUBLIC: (token: string) => `/public/credit/${token}`,
} as const;

/**
 * Quote-specific routes
 */
export const QUOTE_ROUTES = {
  LIST: WORKSPACE_ROUTES.QUOTES,
  VIEW: (id: string) => `/workspace/quotes/${id}`,
  PRINT: (id: string) => `/workspace/quotes/${id}/print`,
  PUBLIC: (token: string) => `/public/quote/${token}`,
} as const;

/**
 * All routes combined
 */
export const ROUTES = {
  PUBLIC: PUBLIC_ROUTES,
  WORKSPACE: WORKSPACE_ROUTES,
  CLIENTS: CLIENT_ROUTES,
  JOBS: JOB_ROUTES,
  INVOICES: INVOICE_ROUTES,
  QUOTES: QUOTE_ROUTES,
  CREDITS: CREDIT_ROUTES,
} as const;

/**
 * Navigation items for the workspace header
 */
export interface NavItem {
  label: string;
  href: string;
}
export interface WorkspaceSection extends NavItem {
  id: string;
  children: NavItem[];
}

export const WORKSPACE_NAV_ITEMS: WorkspaceSection[] = [
  { id: "clients", label: "Clients", href: WORKSPACE_ROUTES.CLIENTS, children: [] },
  { id: "jobs", label: "Jobs", href: WORKSPACE_ROUTES.JOBS, children: [] },
  { id: "sales", label: "Sales", href: WORKSPACE_ROUTES.SALES, children: [
    { label: "Quotes", href: WORKSPACE_ROUTES.QUOTES },
    { label: "Invoices", href: WORKSPACE_ROUTES.INVOICES },
    { label: "Credit notes", href: WORKSPACE_ROUTES.CREDITS },
  ] },
  { id: "bookkeeping", label: "Bookkeeping", href: WORKSPACE_ROUTES.BOOKKEEPING, children: [
    { label: "Payments received", href: WORKSPACE_ROUTES.PAYMENTS },
    { label: "Expenses", href: WORKSPACE_ROUTES.EXPENSES },
    { label: "Receivables & client credits", href: WORKSPACE_ROUTES.RECEIVABLES_REPORT },
    { label: "BAS preparation", href: WORKSPACE_ROUTES.BAS_REPORT },
  ] },
  { id: "reports", label: "Reports", href: WORKSPACE_ROUTES.REPORTS, children: [] },
];

const SETTINGS_SECTION: WorkspaceSection = { id: "settings", label: "Business settings", href: WORKSPACE_ROUTES.SETTINGS, children: [
  { label: "Business & invoices", href: WORKSPACE_ROUTES.SETTINGS },
  { label: "Expense settings", href: WORKSPACE_ROUTES.EXPENSE_SETTINGS },
] };

export function isWithinRoute(path: string, href: string): boolean {
  return path === href || path.startsWith(href + "/");
}

/** Shared by desktop and mobile navigation so documents retain the same group. */
export function getWorkspaceNavigation(path: string) {
  const section = [...WORKSPACE_NAV_ITEMS, SETTINGS_SECTION].find(group =>
    isWithinRoute(path, group.href) || group.children.some(item => isWithinRoute(path, item.href))
  );
  const item = section?.children.filter(child => isWithinRoute(path, child.href)).sort((a, b) => b.href.length - a.href.length)[0];
  const base = item?.href || section?.href;
  const remainder = base && path !== base ? path.slice(base.length + 1).split("/") : [];
  const detail = remainder.length ? remainder[0] === "new" ? "New" : remainder.includes("edit") ? "Edit" : remainder.includes("print") ? "Print preview" : "Details" : undefined;
  return { section, item, detail };
}

/** Preserve old Finances bookmarks and invoice-prefilled payment URLs without retaining a mixed workspace. */
export function legacyFinanceDestination(params: Record<string, string | string[] | undefined>): string {
  const report = params.tab === "reports";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab" || value === undefined) continue;
    for (const part of Array.isArray(value) ? value : [value]) query.append(key, part);
  }
  const destination = report ? WORKSPACE_ROUTES.RECEIVABLES_REPORT : WORKSPACE_ROUTES.PAYMENTS;
  return query.size ? `${destination}?${query}` : destination;
}

/**
 * Helper to check if a path is a workspace route
 */
export function isWorkspaceRoute(path: string): boolean {
  return path.startsWith("/workspace");
}

/**
 * Helper to check if a path is a public route
 */
export function isPublicRoute(path: string): boolean {
  return (Object.values(PUBLIC_ROUTES) as string[]).includes(path);
}

/**
 * Get the default route after login
 */
export function getDefaultAuthenticatedRoute(): string {
  return WORKSPACE_ROUTES.DASHBOARD;
}

/**
 * Get the default route when logged out
 */
export function getDefaultUnauthenticatedRoute(): string {
  return PUBLIC_ROUTES.LOGIN;
}
