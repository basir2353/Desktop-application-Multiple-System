/** Asia/Karachi calendar helpers for Admin date-to-date filters. */

const KARACHI_TZ = "Asia/Karachi";

export function currentBusinessDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shiftDateKeyForRange(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12));
  return dt.toISOString().slice(0, 10);
}

export function inDateRange(iso: string, fromKey: string, toKey: string): boolean {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: KARACHI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  const from = fromKey <= toKey ? fromKey : toKey;
  const to = fromKey <= toKey ? toKey : fromKey;
  return key >= from && key <= to;
}
