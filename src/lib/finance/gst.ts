import { add, exclusiveTaxMinor, minor } from "./money";
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

interface DraftTaxLine { gstApplicable?: boolean; subtotalMinor: number; taxMinor: number; totalMinor: number }
export function refreshDraftTaxLines<T extends DraftTaxLine>(lines: T[], settings: TenantSettings | undefined, date: string): T[] {
  const rate = invoiceGstRate(settings, date);
  return lines.map(line => { const net = minor(line.subtotalMinor); if (net < 0) throw new Error("Invalid line subtotal"); const taxMinor = line.gstApplicable !== false ? exclusiveTaxMinor(net, rate) : 0; return { ...line, taxMinor, totalMinor: add(net, taxMinor) }; });
}
export function draftTaxContext(settings: TenantSettings | undefined, date: string) {
  return { date, rate: invoiceGstRate(settings, date), taxType: settings?.tax?.taxType || "None", registration: normalizeGstRegistration(settings?.tax?.gstRegistration) };
}
export function assertDraftTaxCurrent(document: { lines?: DraftTaxLine[]; subtotalMinor?: number; taxMinor?: number; totalMinor: number }, settings: TenantSettings | undefined, date: string) {
  const lines = document.lines || [], expected = refreshDraftTaxLines(lines, settings, date);
  if (!lines.length || lines.some((line, i) => line.taxMinor !== expected[i].taxMinor || line.totalMinor !== expected[i].totalMinor) || document.subtotalMinor !== add(...expected.map(l => l.subtotalMinor)) || document.taxMinor !== add(...expected.map(l => l.taxMinor)) || document.totalMinor !== add(...expected.map(l => l.totalMinor))) throw new Error("Draft tax or totals changed. Refresh totals and review the draft before issuing.");
  assertInvoiceGstSupported(document.taxMinor || 0, settings, date);
}
