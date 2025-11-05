# Client Management & Invoicing App

A multi-tenant SaaS application for managing clients, jobs, and invoices built with Next.js 16, TypeScript, Tailwind CSS 4, and Firebase.

## Quick Start

### Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- Java 17+ (required for Firebase emulators): `brew install openjdk` or download from https://jdk.java.net/
- A Firebase project (see `.firebaserc` for project ID)

### Setup

1. **Clone and install dependencies**:

   ```bash
   npm install
   ```

2. **Configure environment variables**:

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Firebase credentials
   ```

3. **Start Firebase emulators** (in one terminal):

   ```bash
   firebase emulators:start
   ```

4. **Start Firebase emulators** (in one terminal):

   ```bash
   firebase emulators:start
   ```

5. **Start development server** (in another terminal):

   ```bash
   npm run dev
   ```

6. **Open the app**:
   - App: http://localhost:3000
   - Firebase Emulator UI: http://localhost:4000

## Features

### ✅ Implemented

- **Firebase Authentication**: Email/password authentication with emulator support
- **Route Protection**: Public, conditionally public, and private route patterns
- **Auth Pages**: Login, signup, password reset with Tailwind UI
- **Protected Dashboard**: Example private page with user info
- **Dark Mode**: Automatic dark mode via `prefers-color-scheme`
- **TypeScript**: Strict mode with full type safety
- **Tailwind CSS 4**: Modern utility-first styling with custom theme

### 🚧 Coming Soon (See `.github/IMPLEMENTATION_PLAN.md`)

- Multi-tenant architecture with automatic tenant creation
- Client management (CRUD operations)
- Job/project tracking
- Billable items with locking mechanism
- Invoice generation with sequential numbering
- Public invoice pages
- Print/PDF functionality
- Role-based access control (owner/staff)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── login/             # Conditionally public
│   ├── signup/            # Conditionally public
│   ├── reset-password/    # Conditionally public
│   ├── dashboard/         # Private (protected)
│   ├── layout.tsx         # Root layout with AuthProvider
│   └── page.tsx           # Homepage (redirects based on auth)
├── components/
│   ├── auth/              # Route protection wrappers
│   └── ui/                # Reusable UI components
├── contexts/
│   └── AuthContext.tsx    # Auth state management
└── lib/
    └── firebase.ts        # Firebase client SDK initialization
```

## Documentation

- **[AUTH.md](./AUTH.md)**: Complete authentication system guide
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)**: AI agent guidelines
- **[.github/IMPLEMENTATION_PLAN.md](./.github/IMPLEMENTATION_PLAN.md)**: Detailed MVP implementation phases

## Development

```bash
npm run dev              # Start dev server + Firebase emulators (both in one command)
npm run dev:next         # Start only Next.js dev server
npm run dev:live         # Start Next.js with live Firebase (no emulators)
npm run emulators        # Start only Firebase emulators
npm run emulators:clear  # Clear all emulator data (users, Firestore, Storage)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

## Firebase Emulators

When `NODE_ENV=development`, the app automatically connects to local emulators:

- **Auth**: http://localhost:9099
- **Firestore**: http://localhost:8080
- **Storage**: http://localhost:9199
- **Emulator UI**: http://localhost:4000

### Data Persistence

Emulator data is automatically saved to `./emulator-data` directory on exit and restored on startup. This means:

- ✅ Test users persist between restarts
- ✅ Firestore data is preserved
- ✅ No need to recreate test data every time

To start fresh:

```bash
npm run emulators:clear
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Deployment**: Vercel
- **Runtime**: Node.js (for server routes with Firestore)

## Security

- Firebase service account JSON files are git-ignored
- Environment variables required for both client and server SDKs
- Firestore security rules enforce tenant isolation
- Role-based access control at both client and server levels

## Contributing

1. Check `.github/IMPLEMENTATION_PLAN.md` for planned features
2. Follow patterns in `.github/copilot-instructions.md`
3. Use Australian date format (DD/MM/YYYY)
4. Store monetary amounts in minor units (cents)
5. Test with Firebase emulators before deploying

## License

Private - All rights reserved
