/**
 * Firebase Admin SDK initialization for server-side operations
 * Used in Server Actions and Route Handlers
 */

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import { assertLiveHasNoEmulatorHosts, firebaseDataMode } from "./firebase-environment";

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: Storage;

/**
 * Initialize Firebase Admin SDK
 * Supports both emulator (development) and production environments
 */
function initializeFirebaseAdmin() {
  assertLiveHasNoEmulatorHosts(firebaseDataMode, process.env);
  if (firebaseDataMode === "emulator") {
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "localhost:9099";
    process.env.STORAGE_EMULATOR_HOST ||= "http://localhost:9199";
  }

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
    adminStorage = getStorage(adminApp);
    return;
  }

  // In development, connect to emulators
  if (firebaseDataMode === "emulator") {
    adminApp = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
      storageBucket:
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project"}.appspot.com`,
    });

    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
    adminStorage = getStorage(adminApp);

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
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
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
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } else {
      throw new Error(
        "Firebase Admin credentials not configured. Set either FIREBASE_SERVICE_ACCOUNT_KEY or (FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY)"
      );
    }

    adminDb = getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    adminStorage = getStorage(adminApp);
  }
}

// Initialize on module load
initializeFirebaseAdmin();

export { adminApp, adminAuth, adminDb, adminStorage };
