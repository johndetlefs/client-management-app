import type { RecipientLine } from "@/types/recipient-document";

/** Only document-facing snapshot fields cross the public boundary. */
export function recipientLines(value: unknown): RecipientLine[] {
  if (!Array.isArray(value)) return [];
  return value.map((line) => ({
    jobTitle: line.jobTitle, title: line.title, description: line.description,
    unit: line.unit, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor,
    gstApplicable: line.gstApplicable, subtotalMinor: line.subtotalMinor,
    taxMinor: line.taxMinor, totalMinor: line.totalMinor,
  }));
}
