/**
 * Firebase Admin SDK initialization for server-side operations
 * Used in Server Actions and Route Handlers
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminDb: Firestore;

/**
 * Initialize Firebase Admin SDK
 * Supports both emulator (development) and production environments
 */
function initializeFirebaseAdmin() {
    if (getApps().length > 0) {
        adminApp = getApps()[0];
        adminDb = getFirestore(adminApp);
        return;
    }

    // In development, connect to emulators
    if (process.env.NODE_ENV === 'development') {
        adminApp = initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
        });

        adminDb = getFirestore(adminApp);

        // Connect to Firestore emulator
        const firestoreHost = process.env.FIREBASE_FIRESTORE_EMULATOR_HOST || 'localhost:8080';
        const [host, port] = firestoreHost.split(':');
        adminDb.settings({
            host: `${host}:${port}`,
            ssl: false,
        });
    } else {
        // Production: use service account credentials
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
        }

        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

        adminApp = initializeApp({
            credential: cert(serviceAccount),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });

        adminDb = getFirestore(adminApp);
    }
}

// Initialize on module load
initializeFirebaseAdmin();

export { adminApp, adminDb };
