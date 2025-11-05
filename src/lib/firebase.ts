import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

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

// Connect to emulator in development
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  // Check if we're already connected to avoid double initialization
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(auth as any)._canInitEmulator) {
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
  }
}

export { app, auth };
