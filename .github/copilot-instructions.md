# Copilot Instructions

## Project Overview

This is a multi-tenant invoicing/client management SaaS built with Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Firebase (Auth/Firestore/Storage). The app allows businesses to manage clients, jobs, billable items, and generate invoices with proper locking mechanisms to prevent double-billing.

## Architecture & Key Patterns

### Stack & Runtime Constraints

- **Frontend**: React 19.2, Next.js 16 App Router, TypeScript (strict mode), Tailwind CSS 4
- **Backend**: Firebase (Auth, Firestore, Storage) via `firebase-admin` SDK
- **Server Logic**: Use Next.js Route Handlers or Server Actions (NOT Cloud Functions)
- **Runtime**: Server routes touching Firestore must use Node.js runtime (not Edge)
- **Deployment**: Vercel with environment variables for Firebase client + admin SDKs

### Data Architecture

```
Firestore Structure:
tenants/{tenantId}/
  ├── users/        # Role-based access (owner, staff)
  ├── clients/      # Customer records
  ├── jobs/         # Projects/engagements per client
  ├── jobItems/     # Billable line items (hourly, daily, unit, expense)
  └── invoices/     # Generated invoices with locking refs
```

### Critical Domain Concepts

**Money Handling**: Store all amounts in **minor units** (e.g., cents). Use consistent rounding (banker's or standard) across all calculations. Never use floating-point arithmetic for currency.

**Item Locking Pattern**: Job items have three states: `open` → `selected` → `invoiced`. When drafting an invoice:

1. Server action validates item is `open` with no `lock` field
2. Transaction sets `lock: { invoiceId, at }` and `status: selected`
3. Removing from draft reverts to `open` and clears `lock`
4. Issuing invoice transitions to `invoiced` (permanent)

This prevents concurrent invoice creation from double-billing the same item.

**Invoice Numbering**: Sequential per tenant/year using a counter document under `tenants/{tenantId}` updated in a Firestore transaction to guarantee uniqueness.

## Development Workflow

### Local Development

```bash
npm run dev                    # Start Next.js dev server + Firebase emulators (both)
npm run dev:next               # Start only Next.js dev server
npm run dev:live               # Start Next.js with live Firebase (no emulators)
npm run emulators              # Start only Firebase emulators
npm run emulators:clear        # Clear all emulator data (users, Firestore, Storage)
npm run lint                   # ESLint check
npm run build                  # Production build test
```

**Environment**: `npm run dev` automatically starts both Firebase emulators and Next.js. The app uses emulators when `NODE_ENV=development`. Use `npm run dev:live` to test against live Firebase. Ensure `.env.local` contains `NEXT_PUBLIC_FIREBASE_*` client config and admin SDK credentials.

### Path Aliases

Use `@/*` for imports from `src/`: `import { Component } from '@/components/...'`

## Code Conventions

### Firebase Usage

- **Client-side**: Use `firebase` SDK in Client Components only
- **Server-side**: Use `firebase-admin` SDK in Server Components/Actions/Route Handlers
- **Transactions**: Always use Firestore transactions for operations requiring consistency (item locking, invoice numbering, status transitions)
- **Timestamp Serialization**: Always convert Firestore `Timestamp` objects to JavaScript `Date` objects in server actions before returning to client components (use `timestamp.toDate()`)

### TypeScript

- Strict mode enabled; no implicit `any`
- Use `type` for domain models, `interface` for React component props
- Date formatting: Use Australian standard (DD/MM/YYYY, e.g., "26/11/1975")
- **Write complete implementations, not placeholder comments** - implement the full logic rather than leaving TODOs or "implementation here" comments

### Styling

- Tailwind CSS 4 with custom theme in `globals.css` using `@theme inline`
- CSS variables: `--background`, `--foreground`, `--font-geist-sans`, `--font-geist-mono`
- Dark mode via `prefers-color-scheme` media query
- Print styles: `@media print` for invoice PDF generation (margin, page breaks, hide chrome)

### Components

- Use Next.js App Router conventions: `page.tsx`, `layout.tsx`, `route.ts`
- Font loading: Geist Sans & Geist Mono via `next/font/google` (already configured in `layout.tsx`)
- Image optimization: Always use `next/image` for static assets

### Code Quality Standards

- **No placeholder comments**: Write complete implementations instead of leaving `// TODO`, `// Implementation here`, or `...existing code...` markers
- **Proactive implementation**: When creating functions, write the full logic immediately rather than stub implementations
- **Complete error handling**: Include proper try-catch blocks, user-friendly error messages, and logging
- **Type safety**: Use explicit types, avoid `any`, prefer `unknown` when type is truly unknown
- **React 19 patterns**: Move async logic directly into `useEffect`, use `useMemo` for derived state instead of separate state + effect

## Security & RBAC

**Tenant Isolation**: All queries must scope to `tenants/{tenantId}`. Never expose cross-tenant data.

**Role Enforcement**: Two roles: `owner` (full access), `staff` (limited). Server actions must verify role before mutations (e.g., voiding invoices, changing settings). Client UI hides restricted actions but server must enforce.

**Public Invoices**: Use `publicToken` field for read-only public invoice pages. Log `viewed` status via server action (not client-side).

## Testing Strategy (MVP)

Manual smoke tests only:

- Auth flows (sign-up, sign-in, password reset)
- Client/Job/Item CRUD
- Invoice draft → select items → send → payment status
- Public invoice link access
- Print page formatting

A11y checklist: keyboard navigation, visible focus styles, skip links, empty states.

## Common Tasks

**Adding a new collection**: Update Firestore structure diagram above, define TypeScript types, add composite indexes to `firestore.indexes.json` if querying by multiple fields, update `firestore.rules` for security.

**Server action for mutations**:

- Create in `app/.../actions.ts` with `"use server"` directive
- Use `firebase-admin` SDK (import from `@/lib/firebase-admin`)
- Always serialize Firestore Timestamps to Date objects before returning data
- Use transactions for consistency when needed
- Validate user role/tenantId at the start of the function
- Return typed `ActionResult<T>` with proper error handling
- Write complete implementations with full error handling and edge cases covered

**Adding a route**: Follow App Router conventions (folders with `page.tsx`). Use Server Components by default; add `'use client'` only when needed (forms, interactivity). Write complete component implementations with proper state management, loading states, and error boundaries.

**Formatting dates**: Use `toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })` for consistent DD/MM/YYYY display.

**React patterns**:

- Define async functions directly inside `useEffect` rather than using `useCallback` + dependency
- Use `useMemo` for derived/filtered state instead of maintaining separate state
- Use state triggers (increment counters) to reload data instead of calling load functions directly

## Known Limitations

- Single Firebase project for both dev (emulators) and prod
- No automated CI/CD pipeline (manual Vercel deployments)
- No Cloud Functions (all server logic in Next.js)
- Minimal error boundary implementation
- Basic RBAC (only owner/staff roles)

## References

- Next.js 16 docs: https://nextjs.org/docs
- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
- Tailwind CSS 4: https://tailwindcss.com/docs
- Project plan: `.github/IMPLEMENTATION_PLAN.md` (implementation phases)
