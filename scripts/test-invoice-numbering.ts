import { syntheticPassword } from "./finance/synthetic-auth";
/**
 * Test script to verify sequential invoice numbering
 * Run this with: npx tsx scripts/test-invoice-numbering.ts
 *
 * This script will:
 * 1. Connect to Firebase emulators
 * 2. Create test data (client, job, job items)
 * 3. Create and issue multiple invoices
 * 4. Verify invoice numbers are sequential and unique
 */

import { adminDb, adminAuth } from "../src/lib/firebase-admin";
import {
  createDraftInvoice,
  addItemsToInvoice,
  issueInvoice,
} from "../src/app/workspace/invoices/actions";
import { createClient } from "../src/app/workspace/clients/actions";
import { createJob } from "../src/app/workspace/jobs/actions";
import { createJobItem } from "../src/app/workspace/jobs/itemActions";

const TEST_TENANT_ID = "test-tenant-sequential-numbering";
const TEST_USER_ID = "test-user-123";
let testIdToken = "";

async function authenticateTestOwner() {
  if (process.env.NODE_ENV !== "development" || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("This diagnostic requires Firebase emulators");
  try { await adminAuth.createUser({ uid: TEST_USER_ID, email: "numbering@example.test", password: syntheticPassword() }); } catch (error) {
    if ((error as { code?: string }).code !== "auth/uid-already-exists") throw error;
  }
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "numbering@example.test", password: syntheticPassword(), returnSecureToken: true }) });
  const result = await response.json();
  if (!response.ok || !result.idToken) throw new Error("Synthetic authentication failed");
  testIdToken = result.idToken;
  await adminDb.doc(`tenants/${TEST_TENANT_ID}/users/${TEST_USER_ID}`).set({ role: "owner" });
}

async function cleanup() {
  console.log("🧹 Cleaning up old test data...");

  // Delete all test invoices
  const invoicesRef = adminDb.collection(`tenants/${TEST_TENANT_ID}/invoices`);
  const invoicesSnap = await invoicesRef.get();
  const batch1 = adminDb.batch();
  invoicesSnap.forEach((doc) => batch1.delete(doc.ref));
  await batch1.commit();

  // Delete all test job items
  const itemsRef = adminDb.collection(`tenants/${TEST_TENANT_ID}/jobItems`);
  const itemsSnap = await itemsRef.get();
  const batch2 = adminDb.batch();
  itemsSnap.forEach((doc) => batch2.delete(doc.ref));
  await batch2.commit();

  // Delete all test jobs
  const jobsRef = adminDb.collection(`tenants/${TEST_TENANT_ID}/jobs`);
  const jobsSnap = await jobsRef.get();
  const batch3 = adminDb.batch();
  jobsSnap.forEach((doc) => batch3.delete(doc.ref));
  await batch3.commit();

  // Delete all test clients
  const clientsRef = adminDb.collection(`tenants/${TEST_TENANT_ID}/clients`);
  const clientsSnap = await clientsRef.get();
  const batch4 = adminDb.batch();
  clientsSnap.forEach((doc) => batch4.delete(doc.ref));
  await batch4.commit();

  // Delete counter documents
  const countersRef = adminDb.collection(`tenants/${TEST_TENANT_ID}/counters`);
  const countersSnap = await countersRef.get();
  const batch5 = adminDb.batch();
  countersSnap.forEach((doc) => batch5.delete(doc.ref));
  await batch5.commit();

  console.log("✅ Cleanup complete");
}

async function setupTestData() {
  console.log("📦 Setting up test data...");

  // Create a test client
  const clientResult = await createClient(TEST_TENANT_ID, TEST_USER_ID, {
    name: "Test Client Ltd",
    email: "test@example.com",
    abn: "12345678901",
    shortcode: "TEST",
    isActive: true,
  }, testIdToken);

  if (!clientResult.success) {
    throw new Error(`Failed to create client: ${clientResult.error}`);
  }

  const clientId = clientResult.data;
  console.log(`✅ Created client: ${clientId}`);

  // Create a test job
  const jobResult = await createJob(TEST_TENANT_ID, TEST_USER_ID, {
    clientId,
    title: "Test Job",
    status: "active",
  }, testIdToken);

  if (!jobResult.success) {
    throw new Error(`Failed to create job: ${jobResult.error}`);
  }

  const jobId = jobResult.data;
  console.log(`✅ Created job: ${jobId}`);

  // Create multiple job items
  const itemIds: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const itemResult = await createJobItem(TEST_TENANT_ID, TEST_USER_ID, {
      jobId,
      clientId,
      title: `Test Item ${i}`,
      unit: "hour",
      quantity: 2,
      unitPriceMinor: 10000, // $100.00
      gstApplicable: true,
      status: "open",
    }, testIdToken);

    if (!itemResult.success) {
      throw new Error(`Failed to create item: ${itemResult.error}`);
    }

    itemIds.push(itemResult.data);
  }

  console.log(`✅ Created ${itemIds.length} job items`);

  return { clientId, jobId, itemIds };
}

async function testSequentialNumbering() {
  console.log("\n🧪 Testing Sequential Invoice Numbering\n");
  console.log("=".repeat(60));

  try {
    await authenticateTestOwner();
    // Cleanup first
    await cleanup();

    // Setup test data
    const { clientId, itemIds } = await setupTestData();

    const currentYear = new Date().getFullYear();
    const invoiceNumbers: string[] = [];

    // Create and issue 3 invoices
    console.log("\n📝 Creating and issuing invoices...");
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Invoice ${i} ---`);

      // Create draft
      const draftResult = await createDraftInvoice(
        TEST_TENANT_ID,
        TEST_USER_ID,
        {
          clientId,
          notes: `Test invoice ${i}`,
        }, testIdToken
      );

      if (!draftResult.success) {
        throw new Error(`Failed to create draft: ${draftResult.error}`);
      }

      const invoiceId = draftResult.data;
      console.log(`✅ Created draft: ${invoiceId}`);

      // Add one item to the invoice
      const addItemsResult = await addItemsToInvoice(
        TEST_TENANT_ID,
        invoiceId,
        [itemIds[i - 1]], testIdToken
      );

      if (!addItemsResult.success) {
        throw new Error(`Failed to add items: ${addItemsResult.error}`);
      }

      console.log(`✅ Added item to invoice`);

      // Issue the invoice
      const issueResult = await issueInvoice(
        TEST_TENANT_ID,
        invoiceId,
        TEST_USER_ID, testIdToken
      );

      if (!issueResult.success) {
        throw new Error(`Failed to issue invoice: ${issueResult.error}`);
      }

      console.log(`✅ Issued invoice`);

      // Fetch the invoice to get its number
      const invoiceSnap = await adminDb
        .collection(`tenants/${TEST_TENANT_ID}/invoices`)
        .doc(invoiceId)
        .get();

      const invoice = invoiceSnap.data();
      const invoiceNumber = invoice?.invoiceNumber;
      const displayNumber = invoice?.invoiceDisplayNumber;

      console.log(`📋 Invoice Number: ${invoiceNumber}`);
      console.log(`📋 Display Number: ${displayNumber}`);

      if (invoiceNumber) {
        invoiceNumbers.push(invoiceNumber);
      }
    }

    // Verify sequential numbering
    console.log("\n" + "=".repeat(60));
    console.log("🔍 Verification Results:\n");

    console.log("Invoice Numbers Generated:");
    invoiceNumbers.forEach((num, idx) => {
      console.log(`  ${idx + 1}. ${num}`);
    });

    // Check that they are sequential
    const expectedNumbers = [
      `${currentYear}-001`,
      `${currentYear}-002`,
      `${currentYear}-003`,
    ];

    let allCorrect = true;
    for (let i = 0; i < invoiceNumbers.length; i++) {
      if (invoiceNumbers[i] !== expectedNumbers[i]) {
        console.log(
          `\n❌ FAIL: Invoice ${i + 1} expected ${expectedNumbers[i]}, got ${
            invoiceNumbers[i]
          }`
        );
        allCorrect = false;
      }
    }

    if (allCorrect) {
      console.log(
        "\n✅ SUCCESS: All invoice numbers are sequential and correct!"
      );
      console.log(`✅ Format: YYYY-NNN (e.g., ${currentYear}-001)`);
      console.log("✅ Numbers increment by 1 for each invoice");
    }

    // Check counter document
    console.log("\n📊 Checking counter document...");
    const counterSnap = await adminDb
      .collection(`tenants/${TEST_TENANT_ID}/counters`)
      .doc(`invoices-${currentYear}`)
      .get();

    if (counterSnap.exists) {
      const counter = counterSnap.data();
      console.log(`✅ Counter document exists`);
      console.log(`   Year: ${counter?.year}`);
      console.log(`   Last Number: ${counter?.lastNumber}`);

      if (counter?.lastNumber === 3) {
        console.log("✅ Counter matches number of invoices created");
      } else {
        console.log(
          `❌ Counter mismatch: expected 3, got ${counter?.lastNumber}`
        );
      }
    } else {
      console.log("❌ Counter document not found!");
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Test Complete!\n");
  } catch (error) {
    console.error("\n❌ Test Failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testSequentialNumbering()
  .then(() => {
    console.log("Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
