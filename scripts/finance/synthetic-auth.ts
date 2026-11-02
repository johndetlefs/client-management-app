/** Runtime-only credentials for disposable local Auth emulator fixtures. */
export function syntheticPassword(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_MODE !== "emulator" || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "demo-cma-finance" || !process.env.FIREBASE_AUTH_EMULATOR_HOST?.startsWith("127.0.0.1:")) throw new Error("Synthetic credentials require the isolated local emulator");
  const value=process.env.CMA_SYNTHETIC_PASSWORD;
  if (!value || value.length<16) throw new Error("Set CMA_SYNTHETIC_PASSWORD for this disposable emulator run");
  return value;
}
