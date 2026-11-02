export type FirebaseDataMode = "emulator" | "live";

export function resolveFirebaseDataMode(nodeEnvironment: string | undefined, requested: string | undefined): FirebaseDataMode {
  if (requested !== undefined && requested !== "emulator" && requested !== "live") throw new Error("Firebase mode must be emulator or live");
  if (nodeEnvironment === "production" && requested === "emulator") throw new Error("Production builds cannot use Firebase emulators");
  return requested || (nodeEnvironment === "development" ? "emulator" : "live");
}

// Public build-time selection is shared by browser and server; credentials stay server-only.
export const firebaseDataMode = resolveFirebaseDataMode(process.env.NODE_ENV, process.env.NEXT_PUBLIC_FIREBASE_MODE);

export function assertLiveHasNoEmulatorHosts(mode: FirebaseDataMode, environment: Record<string, string | undefined>) {
  if (mode === "live" && ["FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_FIRESTORE_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"].some((key) => Boolean(environment[key]))) throw new Error("LIVE Firebase mode cannot start with emulator host variables set");
}
