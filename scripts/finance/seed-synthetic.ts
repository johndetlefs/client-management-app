import { syntheticPassword } from "./synthetic-auth";
import { adminAuth, adminDb } from "../../src/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export const SYNTHETIC_OWNER = { uid: "finance-owner", email: "finance-owner@example.test", get password() { return syntheticPassword(); } };
export function assertSyntheticEnvironment() {
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== "demo-cma-finance" || process.env.NODE_ENV !== "development" || !process.env.FIREBASE_AUTH_EMULATOR_HOST?.startsWith("127.0.0.1:") || process.env.FIREBASE_FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080") throw new Error("Synthetic finance scripts require the isolated demo project and explicit localhost emulator hosts");
}

export async function seedSynthetic(tenantId = "finance-demo", includeProfile = true) {
  assertSyntheticEnvironment();
  for (const user of [SYNTHETIC_OWNER, { uid: "finance-staff", email: "finance-staff@example.test", get password() { return syntheticPassword(); } }, { uid: "finance-outsider", email: "finance-outsider@example.test", get password() { return syntheticPassword(); } }]) {
    try { await adminAuth.getUser(user.uid); } catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; await adminAuth.createUser({ ...user, displayName: user.uid === SYNTHETIC_OWNER.uid ? "Synthetic Finance Owner" : user.uid, emailVerified: true }); }
  }
  const tenant = adminDb.doc(`tenants/${tenantId}`);
  const batch = adminDb.batch();
  batch.set(tenant, { name: "Synthetic Finance Studio", settings: { businessName: "Synthetic Finance Studio" }, syntheticOnly: true }, { merge: true });
  for (const [uid, role] of [["finance-owner", "owner"], ["finance-staff", "staff"]]) batch.set(tenant.collection("users").doc(uid), { uid, role, email: `${uid}@example.test` });
  if (includeProfile) batch.set(adminDb.doc(`users/${SYNTHETIC_OWNER.uid}`), { uid: SYNTHETIC_OWNER.uid, email: SYNTHETIC_OWNER.email, tenantId, createdAt: Timestamp.now() });
  for (const [id, totalMinor, paid] of [["invoice-june", 100000, 0], ["invoice-part", 100000, 0], ["invoice-legacy", 50000, 50000]] as const) batch.set(tenant.collection("invoices").doc(id), { tenantId, clientId: "synthetic-client", clientName: "Synthetic Client", lines: [], lockedJobItemIds: [], taxBreakdown: [], createdBy: SYNTHETIC_OWNER.uid, invoiceNumber: id, invoiceDisplayNumber: id, issueDate: Timestamp.fromDate(new Date("2026-06-30T01:00:00Z")), dueDate: Timestamp.fromDate(new Date("2026-07-15T01:00:00Z")), totalMinor, subtotalMinor: totalMinor, taxMinor: 0, amountPaidMinor: paid, balanceDueMinor: totalMinor - paid, status: paid ? "paid" : "sent", createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  await batch.commit();
}

if (process.argv.includes("--seed")) seedSynthetic().then(() => { console.log("Synthetic finance owner and invoice fixtures ready in isolated emulator project."); }).catch((error) => { console.error(error.message); process.exitCode = 1; });
