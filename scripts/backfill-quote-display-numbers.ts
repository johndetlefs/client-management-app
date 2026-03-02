import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../src/lib/firebase-admin";
import { formatQuoteDisplayNumber } from "../src/lib/invoice-utils";

type QuoteDoc = {
  clientId?: string;
  quoteNumber?: string;
  quoteDisplayNumber?: string;
};

type ClientDoc = {
  shortcode?: string;
};

function getTenantAndQuoteId(
  path: string,
): { tenantId: string; quoteId: string } | null {
  const parts = path.split("/");
  if (parts.length !== 4) {
    return null;
  }

  const [tenantsSegment, tenantId, quotesSegment, quoteId] = parts;
  if (tenantsSegment !== "tenants" || quotesSegment !== "quotes") {
    return null;
  }

  return { tenantId, quoteId };
}

function parseSequenceFromQuoteNumber(
  quoteNumber: string | undefined,
): number | null {
  if (!quoteNumber) {
    return null;
  }

  const match = quoteNumber.match(/-(\d+)$/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLegacyDisplayNumber(
  quoteDisplayNumber: string | undefined,
  quoteNumber: string | undefined,
): boolean {
  if (!quoteDisplayNumber || quoteDisplayNumber.trim() === "") {
    return true;
  }

  if (quoteDisplayNumber.startsWith("Q-")) {
    return false;
  }

  if (quoteNumber && quoteDisplayNumber === quoteNumber) {
    return true;
  }

  return /^\d{4}-\d+$/.test(quoteDisplayNumber);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const quoteIdArg = process.argv.find((arg) => arg.startsWith("--quote-id="));
  const targetQuoteId = quoteIdArg
    ? quoteIdArg.replace("--quote-id=", "")
    : null;

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  if (targetQuoteId) {
    console.log(`Target quote ID: ${targetQuoteId}`);
  }
  console.log("Scanning tenant quotes for legacy/missing display numbers...");

  const quotesSnap = await adminDb.collectionGroup("quotes").get();

  const clientShortcodeCache = new Map<string, string | null>();
  const updates: Array<{
    ref: FirebaseFirestore.DocumentReference;
    from: string | undefined;
    to: string;
  }> = [];
  const skipped: Array<{ reason: string; path: string }> = [];

  for (const doc of quotesSnap.docs) {
    const path = doc.ref.path;
    const location = getTenantAndQuoteId(path);
    if (!location) {
      continue;
    }

    if (targetQuoteId && location.quoteId !== targetQuoteId) {
      continue;
    }

    const quoteData = doc.data() as QuoteDoc;

    if (
      !isLegacyDisplayNumber(
        quoteData.quoteDisplayNumber,
        quoteData.quoteNumber,
      )
    ) {
      continue;
    }

    if (!quoteData.clientId) {
      skipped.push({ reason: "missing clientId", path });
      continue;
    }

    const sequence = parseSequenceFromQuoteNumber(quoteData.quoteNumber);
    if (!sequence) {
      skipped.push({ reason: "invalid quoteNumber sequence", path });
      continue;
    }

    const cacheKey = `${location.tenantId}/${quoteData.clientId}`;
    let shortcode = clientShortcodeCache.get(cacheKey);

    if (shortcode === undefined) {
      const clientRef = adminDb.doc(
        `tenants/${location.tenantId}/clients/${quoteData.clientId}`,
      );
      const clientSnap = await clientRef.get();
      const clientData = (clientSnap.data() || {}) as ClientDoc;
      const normalized =
        typeof clientData.shortcode === "string"
          ? clientData.shortcode.trim().toUpperCase()
          : "";

      shortcode = /^[A-Z]{4}$/.test(normalized) ? normalized : null;
      clientShortcodeCache.set(cacheKey, shortcode);
    }

    if (!shortcode) {
      skipped.push({ reason: "missing/invalid client shortcode", path });
      continue;
    }

    const nextDisplayNumber = formatQuoteDisplayNumber(shortcode, sequence);

    updates.push({
      ref: doc.ref,
      from: quoteData.quoteDisplayNumber,
      to: nextDisplayNumber,
    });
  }

  console.log(`Quotes scanned: ${quotesSnap.size}`);
  console.log(`Candidates to update: ${updates.length}`);
  console.log(`Skipped: ${skipped.length}`);

  if (skipped.length > 0) {
    const sample = skipped.slice(0, 10);
    console.log("Skipped sample:");
    for (const item of sample) {
      console.log(`- ${item.reason}: ${item.path}`);
    }
    if (skipped.length > sample.length) {
      console.log(`...and ${skipped.length - sample.length} more`);
    }
  }

  if (updates.length > 0) {
    const sample = updates.slice(0, 10);
    console.log("Update sample:");
    for (const item of sample) {
      console.log(
        `- ${item.ref.path}: ${item.from || "<empty>"} -> ${item.to}`,
      );
    }
    if (updates.length > sample.length) {
      console.log(`...and ${updates.length - sample.length} more`);
    }
  }

  if (!apply) {
    console.log("Dry run complete. Re-run with --apply to persist changes.");
    return;
  }

  let updatedCount = 0;
  while (updates.length > 0) {
    const chunk = updates.splice(0, 450);
    const batch = adminDb.batch();

    for (const update of chunk) {
      batch.update(update.ref, {
        quoteDisplayNumber: update.to,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    updatedCount += chunk.length;
  }

  console.log(`Applied updates: ${updatedCount}`);
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
