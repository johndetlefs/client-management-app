/**
 * Firebase Admin SDK initialization for server-side operations
 * Used in Server Actions and Route Handlers
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

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
  if (process.env.NODE_ENV === "development") {
    adminApp = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
    });

    adminDb = getFirestore(adminApp);

    // Connect to Firestore emulator
    const firestoreHost =
      process.env.FIREBASE_FIRESTORE_EMULATOR_HOST || "localhost:8080";
    const [host, port] = firestoreHost.split(":");
    adminDb.settings({
      host: `${host}:${port}`,
      ssl: false,
    });
  } else {
    // Production: use service account credentials
    // Support two formats:
    // 1. Full JSON service account in FIREBASE_SERVICE_ACCOUNT_KEY
    // 2. Individual fields: FIREBASE_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Format 1: Full service account JSON
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );

      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else if (
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ) {
      // Format 2: Individual credential fields
      const projectId =
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID;

      if (!projectId) {
        throw new Error(
          "FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID must be set"
        );
      }

      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(
            /\\n/g,
            "\n"
          ),
        }),
        projectId,
      });
    } else {
      throw new Error(
        "Firebase Admin credentials not configured. Set either FIREBASE_SERVICE_ACCOUNT_KEY or (FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY)"
      );
    }

    adminDb = getFirestore(adminApp);
  }
}

// Initialize on module load
initializeFirebaseAdmin();

export { adminApp, adminDb };
