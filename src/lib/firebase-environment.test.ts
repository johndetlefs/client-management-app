import assert from "node:assert/strict";
import test from "node:test";
import { assertLiveHasNoEmulatorHosts, resolveFirebaseDataMode } from "./firebase-environment";

test("development defaults to emulators and live is an explicit shared selection", () => {
  assert.equal(resolveFirebaseDataMode("development", undefined), "emulator");
  assert.equal(resolveFirebaseDataMode("development", "live"), "live");
  assert.equal(resolveFirebaseDataMode("production", undefined), "live");
  assert.throws(() => resolveFirebaseDataMode("production", "emulator"));
  assert.throws(() => resolveFirebaseDataMode("development", "production"));
});
test("LIVE mode rejects mixed emulator authentication database or storage hosts", () => {
  for (const key of ["FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_FIRESTORE_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) assert.throws(() => assertLiveHasNoEmulatorHosts("live", { [key]: "127.0.0.1:1234" }));
  assert.doesNotThrow(() => assertLiveHasNoEmulatorHosts("live", {}));
  assert.doesNotThrow(() => assertLiveHasNoEmulatorHosts("emulator", { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }));
});
