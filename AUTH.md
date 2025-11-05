# Authentication System

This application uses Firebase Authentication with a flexible routing system that supports three types of pages:

## Page Types

### 1. **Public Pages**

Pages accessible to everyone, regardless of authentication status.

**Example**: Landing page, marketing pages, public invoice view

**Implementation**: No wrapper needed, just a regular page component.

```tsx
// src/app/about/page.tsx
export default function AboutPage() {
  return <div>About Us</div>;
}
```

### 2. **Conditionally Public Pages**

Pages that are public but redirect authenticated users away (e.g., login, signup).

**Example**: `/login`, `/signup`, `/reset-password`

**Implementation**: Wrap with `<ConditionallyPublicRoute>`

```tsx
// src/app/login/page.tsx
import { ConditionallyPublicRoute } from "@/components/auth/ConditionallyPublicRoute";

export default function LoginPage() {
  return (
    <ConditionallyPublicRoute>{/* Your login form */}</ConditionallyPublicRoute>
  );
}
```

### 3. **Private Pages**

Pages that require authentication. Unauthenticated users are redirected to `/login`.

**Example**: `/dashboard`, `/clients`, `/invoices`

**Implementation**: Wrap with `<ProtectedRoute>`

```tsx
// src/app/dashboard/page.tsx
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function DashboardPage() {
  return <ProtectedRoute>{/* Your protected content */}</ProtectedRoute>;
}
```

## Using Auth in Components

Access auth state and methods via the `useAuth` hook:

```tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function MyComponent() {
  const { user, loading, signIn, signOut, signUp, resetPassword } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not signed in</div>;

  return (
    <div>
      <p>Welcome, {user.email}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

## Available Auth Methods

```tsx
const {
  user, // Current user object (null if not authenticated)
  loading, // true while checking auth state
  signUp, // (email, password) => Promise<User>
  signIn, // (email, password) => Promise<User>
  signOut, // () => Promise<void>
  resetPassword, // (email) => Promise<void>
  sendVerificationEmail, // () => Promise<void>
} = useAuth();
```

## Firebase Emulator Support

The app automatically connects to Firebase emulators in development:

- **Auth Emulator**: http://localhost:9099
- **Firestore Emulator**: http://localhost:8080
- **Storage Emulator**: http://localhost:9199
- **Emulator UI**: http://localhost:4000

Start emulators with:

```bash
firebase emulators:start
```

## Environment Variables

Required in `.env.local`:

```bash
# Client SDK (public)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Admin SDK (server-side only)
FIREBASE_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...

# Development
NODE_ENV=development
```

## File Structure

```
src/
├── app/
│   ├── login/page.tsx           # Conditionally public
│   ├── signup/page.tsx          # Conditionally public
│   ├── reset-password/page.tsx  # Conditionally public
│   ├── dashboard/page.tsx       # Private
│   └── layout.tsx               # Wrapped with AuthProvider
├── components/
│   ├── auth/
│   │   ├── ProtectedRoute.tsx          # Private route wrapper
│   │   └── ConditionallyPublicRoute.tsx # Conditionally public wrapper
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Card.tsx
├── contexts/
│   └── AuthContext.tsx          # Auth state management
└── lib/
    └── firebase.ts              # Firebase client SDK initialization
```

## Testing Auth Locally

1. Start both Firebase emulators and Next.js dev server:

   ```bash
   npm run dev
   ```

   Or start them separately:

   ```bash
   # Terminal 1
   firebase emulators:start

   # Terminal 2
   npm run dev:next
   ```

2. Open http://localhost:3000 - you'll be redirected to `/login`

3. Create an account via `/signup` - user will be created in the emulator

4. View users in the Emulator UI at http://localhost:4000

### Using Live Firebase

To test against the live Firebase project instead of emulators:

```bash
npm run dev:live
```

This will skip the emulators and connect directly to your production Firebase project.

## Next Steps

- [ ] Add tenant creation on first sign-up (Phase 2.2 from implementation plan)
- [ ] Add email verification flow
- [ ] Add user profile management
- [ ] Implement role-based access control (owner/staff)
