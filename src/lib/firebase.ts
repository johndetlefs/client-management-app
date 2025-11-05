import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only once
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Connect to emulators in development (both client and server)
if (process.env.NODE_ENV === "development") {
  // Only try to connect if we haven't already
  const isServer = typeof window === "undefined";

  // For client-side
  if (!isServer) {
    try {
      connectAuthEmulator(auth, "http://localhost:9099", {
        disableWarnings: true,
      });
      console.log("🔧 Connected to Firebase Auth Emulator (Client)");
    } catch {
      // Emulator already connected, ignore
      console.log("🔧 Firebase Auth Emulator already connected (Client)");
    }

    try {
      connectFirestoreEmulator(db, "localhost", 8080);
      console.log("🔧 Connected to Firestore Emulator (Client)");
    } catch {
      // Emulator already connected, ignore
      console.log("🔧 Firestore Emulator already connected (Client)");
    }
  } else {
    // For server-side (server actions, API routes)
    try {
      connectFirestoreEmulator(db, "localhost", 8080);
      console.log("🔧 Connected to Firestore Emulator (Server)");
    } catch {
      // Emulator already connected, ignore
      console.log("🔧 Firestore Emulator already connected (Server)");
    }
  }
}

export { app, auth, db };
