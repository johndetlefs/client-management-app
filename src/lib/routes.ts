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
  SETTINGS: "/workspace/settings", // Future
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
  NEW: "/workspace/invoices/new/edit",
  VIEW: (id: string) => `/workspace/invoices/${id}`,
  EDIT: (id: string) => `/workspace/invoices/${id}/edit`,
  PUBLIC: (token: string) => `/invoices/${token}`, // Public invoice view
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
} as const;

/**
 * Navigation items for the workspace header
 */
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  comingSoon?: boolean;
}

export const WORKSPACE_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: WORKSPACE_ROUTES.DASHBOARD,
    icon: "🏠",
  },
  {
    label: "Clients",
    href: WORKSPACE_ROUTES.CLIENTS,
    icon: "👥",
  },
  {
    label: "Jobs",
    href: WORKSPACE_ROUTES.JOBS,
    icon: "💼",
  },
  {
    label: "Invoices",
    href: WORKSPACE_ROUTES.INVOICES,
    icon: "📄",
    comingSoon: true,
  },
];

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
