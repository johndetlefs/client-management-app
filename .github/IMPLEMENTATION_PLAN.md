# Invoicing App – Step‑by‑Step Implementation Plan (MVP) — Simplified

**Stack**: Next.js (App Router, TypeScript), Tailwind CSS, Firebase (**single prod project** using **local emulators** for dev), Hosting on **Vercel**. **No Cloud Functions** unless absolutely necessary; use **Next.js Route Handlers/Server Actions** with **Firebase Admin** for server‑side invariants.

> This version trims testing/CI depth to the essentials and uses one Firebase project.

---

## Phase 0 — One‑time Setup

### 0.1 Create a Single Firebase Project (Prod)

**Tasks**

- Create one Firebase project (e.g., `invoices-prod`).
- Enable: **Authentication**, **Firestore (Native)**, **Storage**.
- Add a Web App to obtain client config (apiKey, authDomain, projectId, etc.).

**Acceptance Criteria**

- Project exists with Auth/Firestore/Storage enabled; web app config available.

---

### 0.2 Repository & Packages

**Tasks**

- Initialize Next.js (TypeScript) with App Router.
- Install packages:

  - Core: `next`, `react`, `react-dom`, `typescript`, `@types/node`.
  - UI: `tailwindcss`, `postcss`, `@tailwindcss/postcss`.
  - Firebase (client + server): `firebase`, `firebase-admin`.
  - Validation/util: `zod`, `date-fns`, `clsx`.
  - Lint/format: `eslint`, `eslint-config-next`, `prettier`.

- Create `postcss.config.mjs` with:

  - `export default { plugins: { '@tailwindcss/postcss': {} } }`

- In `globals.css`, import Tailwind with: `@import "tailwindcss";`
- Add npm scripts: `dev`, `build`, `start`, `lint`, `typecheck`. `dev`, `build`, `start`, `lint`, `typecheck`.

**Acceptance Criteria**

- `npm run dev` starts app; TypeScript strict mode passes; Tailwind styles load.

---

### 0.3 Emulators & Env Vars

**Tasks**

- Add Firebase Emulator Suite config (`firebase.json`, `.firebaserc`) for **Auth, Firestore, Storage**.
- Create `.env.local` with client SDK vars (`NEXT_PUBLIC_FIREBASE_*`).
- Create **Admin SDK** envs for server code (store on **Vercel** later):

  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY` (escaped for Vercel; no quotes)

- Ensure local dev uses emulators when `NODE_ENV=development`.

**Acceptance Criteria**

- `firebase emulators:start` runs locally; app connects to emulators during dev.

---

## Phase 1 — Minimal Shared Foundations

### 1.1 Domain Types & Schemas

**Tasks**

- Define TS types & Zod schemas for: Tenant, User (role), Client, Job, JobItem, Invoice, InvoiceLine, TaxRate, Money (minor units).
- Enumerate `BillableUnit`: `hour | half_day | day | unit | expense`.

**Acceptance Criteria**

- Types compile; schemas validate basic constraints (non‑negative amounts/quantities).

---

### 1.2 Money & Totals Rules

**Tasks**

- Decide rounding (banker’s or standard) and stick to it.
- Store all amounts in **minor units**; compute per‑line subtotal, tax, totals.

**Acceptance Criteria**

- Manual checks with sample values match expected totals.

---

### 1.3 Firestore Structure & Basic Indexes

**Tasks**

- Collections under `tenants/{tenantId}`: `users`, `clients`, `jobs`, `jobItems`, `invoices`.
- Add composite indexes you know you’ll need:

  - `jobItems`: by `clientId`, `status` (for selection), optional `jobId`.
  - `invoices`: by `clientId`, `status`, `issueDate`.

**Acceptance Criteria**

- Emulator logs show **no missing index** prompts during normal flows.

---

## Phase 2 — Auth & Tenant Bootstrap (No Functions)

### 2.1 Auth (Email/Password)

**Tasks**

- Build sign‑up, sign‑in, sign‑out, password reset.
- After sign‑up, require email verification (optional for MVP if it slows you down).

**Acceptance Criteria**

- You can create an account and access the app; unauthenticated users are redirected.

### 2.2 Tenant & Roles

**Tasks**

- On first login, create a tenant doc and add the user to `tenants/{tenantId}/users` with role `owner`.
- Store `tenantId` in user profile doc for scoping queries.

**Acceptance Criteria**

- New users get a fresh tenant automatically; tenantId propagates into app state.

---

## Phase 3 — App Shell & A11y Basics

### 3.1 Layout & Navigation

**Tasks**

- App shell with sidebar/topbar: **Clients**, **Jobs**, **Invoices**, **Settings**.
- Add skip link, keyboard focus styles, and empty states.

**Acceptance Criteria**

- Keyboard‑only navigation works; visible focus; routes load without errors.

---

## Phase 4 — Core CRUD

### 4.1 Clients

**Tasks**

- List, create, edit, soft delete.
- Fields: name, contacts, billing address, tax label/id, default tax, currency.

**Acceptance Criteria**

- You can create/edit clients; search/filter by name works.

### 4.2 Jobs

**Tasks**

- List by client; create/edit/archive.
- Fields: title, reference, dates, status, defaultDailyHours.

**Acceptance Criteria**

- Jobs attach to clients; status updates persist.

### 4.3 Job Items

**Tasks**

- Within a job, list/create/edit/delete items.
- Fields: title, unit, quantity, unitPriceMinor, optional taxRate; `status` defaults to `open`.

**Acceptance Criteria**

- Items render with computed line subtotal; validation prevents invalid values.

---

## Phase 5 — Invoices without Cloud Functions

> Implement invariants in **Next.js server code** (Route Handlers/Server Actions) using **`firebase-admin`** with **Firestore transactions**. Ensure these handlers run on the **Node.js runtime** (not Edge) on Vercel.

### 5.1 Server Utilities

**Tasks**

- Create a singleton Firebase Admin initializer for server use.
- Create helpers for: fetching open items by client, computing totals, and running transactions.

**Acceptance Criteria**

- Server utilities can read/write Firestore successfully locally and on Vercel.

### 5.2 Draft Invoice & Item Selection (Locking)

**Tasks**

- Create draft invoice for a client.
- Item selector lists **open** items across that client’s jobs.
- Server action/route handler:

  - **Transaction**: confirm each item `status == open` and no `lock`.
  - Set `lock = { invoiceId, at }`, set `status = selected`.
  - Upsert invoice lines, totals, and `lockedJobItemIds`.

- Removing a line in draft unlocks that item in a transaction (`status → open`, `lock = null`).

**Acceptance Criteria**

- Two concurrent attempts to select the same item result in one success and one clear error.
- Draft shows accurate totals and references.

### 5.3 Issue/Send & Status

**Tasks**

- On **Send**: allocate an invoice number sequentially per tenant/year (maintain a counter doc under `tenants/{tenantId}` in a **transaction**).
- Transition invoice `draft → sent` and all selected items `selected → invoiced`.
- Manual payments UI: update `amountPaidMinor` and set status to `partially_paid/paid` accordingly.
- Overdue: a simple UI badge based on dueDate (no scheduler in MVP).

**Acceptance Criteria**

- Invoice numbers are unique and monotonic per tenant/year.
- Status transitions occur only through server handlers; client cannot bypass.

---

## Phase 6 — Public & Print View

### 6.1 Public Read‑Only Invoice Page

**Tasks**

- Public route with a token embedded in the invoice doc (e.g., `publicToken`).
- Opening public URL sets `viewed` (do this via a server handler that records the state before rendering; no scheduler required).

**Acceptance Criteria**

- Public link shows read‑only invoice; no tenant leakage; `viewed` reflected in UI.

### 6.2 Print in New Tab

**Tasks**

- Route: `/invoices/[id]/print` opens in a **new tab**.
- `@media print` CSS to format for “Save as PDF”: margins, page breaks, monochrome friendly. Hide app chrome.
- Include company legal name, tax label/id, client address, invoice number, dates, items, tax breakdown, totals, payment instructions.

**Acceptance Criteria**

- Browser print preview/PDF shows a clean one‑to‑two page invoice with no clipped totals.

---

## Phase 7 — Settings & Minimal RBAC

### 7.1 Settings

**Tasks**

- Tenant settings: brand (legal name, tax label/id), locale/currency, default tax, logo upload (Storage).

**Acceptance Criteria**

- Updated settings appear on invoice/public/print pages.

### 7.2 Roles (Simple)

**Tasks**

- Support `owner` and `staff` for MVP. Owner can manage settings/void invoices; staff cannot.
- UI hides restricted actions; server verifies role before mutating.

**Acceptance Criteria**

- Staff cannot change settings/void invoices even if they attempt via network calls.

---

## Phase 8 — Minimal Quality Gate & Deployment

### 8.1 Minimal Checks

**Tasks**

- Run basic manual smoke tests for: auth, clients, jobs, items, invoice draft/select/send, public link, print.
- Ensure keyboard navigation and visible focus across forms and dialogs.

**Acceptance Criteria**

- Smoke tests pass; no show‑stopper errors.

### 8.2 Vercel Deployment

**Tasks**

- Set Vercel env vars for client SDK (`NEXT_PUBLIC_FIREBASE_*`) and Admin SDK (`FIREBASE_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`).
- Mark server routes that touch Firestore as **Node.js runtime** (not Edge) in Next config/route options if needed.
- Verify public invoice links work on production URL.

**Acceptance Criteria**

- App deploys on Vercel; server actions/handlers can read/write Firestore; printing works.

---

## Phase 9 — Nice‑to‑Have (Optional, Post‑MVP)

- Invite flow for multi‑user tenants.
- Basic export (CSV/PDF download wrapper for the print page).
- Simple dashboard totals (sum of outstanding, paid this month).

---

## Guardrails & Simplifications Recap

- **Single Firebase project**; local dev uses **Emulators**.
- **No Cloud Functions**; enforce invariants in **Next.js server handlers** with **Firestore transactions** via Admin SDK.
- **Essential testing only** (manual smoke checks); prioritize shipping.
- Hosted on **Vercel** with Node runtime for server routes that need Admin SDK.
