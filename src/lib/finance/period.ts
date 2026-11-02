export interface FinancialPeriod { start: string; end: string; label: string }

export function calendarDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("Use a valid YYYY-MM-DD calendar date");
  return value;
}
export function sydneyDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (kind: string) => parts.find((p) => p.type === kind)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function nextDate(date: string): string { const d = new Date(`${calendarDate(date)}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
/** Sydney civil midnight, including the UTC date shift and daylight saving. */
export function sydneyMidnight(date: string): Date {
  const target = Date.parse(`${calendarDate(date)}T00:00:00Z`);
  let value = target;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(value));
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    value += target - localAsUtc;
  }
  return new Date(value);
}
export function periodBounds(period: FinancialPeriod) { validatePeriod(period); return { start: sydneyMidnight(period.start), endExclusive: sydneyMidnight(nextDate(period.end)) }; }
export function validatePeriod(period: FinancialPeriod) { calendarDate(period.start); calendarDate(period.end); if (period.end < period.start) throw new Error("Period end precedes start"); if (Number(period.end.slice(0, 4)) - Number(period.start.slice(0, 4)) > 10) throw new Error("Choose a period of ten years or less"); }
export function financialYear(startYear: number, through?: string): FinancialPeriod {
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) throw new Error("Invalid financial year");
  const start = `${startYear}-07-01`, end = `${startYear + 1}-06-30`;
  if (through && (calendarDate(through) < start || through > end)) throw new Error("Through date is outside the financial year");
  return { start, end: through || end, label: `${startYear}–${String(startYear + 1).slice(-2)}${through ? " year to date" : " full year"}` };
}
export function monthPeriod(month: string): FinancialPeriod {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Choose a month");
  const start = calendarDate(`${month}-01`), d = new Date(`${start}T00:00:00Z`);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { start, end, label: month };
}
export function inPeriod(date: string, period: FinancialPeriod) { return date >= period.start && date <= period.end; }
