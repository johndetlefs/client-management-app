import { isDateWithinGstRegistration, normalizeGstRegistration } from "@/lib/expenses/calculations";
import type { GstRegistrationSettings, TenantSettings } from "@/types/tenant";
import { calendarDate } from "./period";

export function invoiceGstRate(settings: TenantSettings | null | undefined, date: string): number {
  calendarDate(date);
  const registration = normalizeGstRegistration(settings?.tax?.gstRegistration);
  return settings?.tax?.taxType === "GST" && isDateWithinGstRegistration(date, registration) ? settings.tax.defaultRate : 0;
}
export function assertInvoiceGstSupported(taxMinor: number, settings: TenantSettings | undefined, date: string) {
  if (taxMinor > 0 && !isDateWithinGstRegistration(calendarDate(date), settings?.tax?.gstRegistration)) throw new Error("GST on this draft requires verified effective-dated registration. Review its lines and settings before issuing; historical invoices are unchanged.");
}
export interface GstEvidence {
  currentStatusEvidence?: string;
  historicalRegistration?: { from: string; to: string; evidence: string }[];
  requiredEffectiveDate?: string;
  obligationStatus?: "unresolved" | "reviewed";
  obligationEvidence?: string;
  pricing?: "gst_on_top_owner_confirmed" | "unknown";
  pricingEvidence?: string;
}
export function gstExceptions(registration: GstRegistrationSettings | undefined, evidence?: GstEvidence): string[] {
  const normalized = normalizeGstRegistration(registration), result: string[] = [];
  if (normalized.status === "unknown") result.push("Current GST registration is unverified; no GST credits or net BAS figure is certified.");
  if (!evidence?.currentStatusEvidence) result.push("Registration-status evidence has not been recorded.");
  if (evidence?.obligationStatus !== "reviewed" || !evidence.obligationEvidence) result.push("Historical registration obligation and any legally required new effective date remain unresolved. Current status does not decide historical liability.");
  if (evidence?.pricing === "gst_on_top_owner_confirmed") result.push("GST-on-top pricing is owner-confirmed; contractual recovery and historical customer treatment are unverified.");
  return result;
}
