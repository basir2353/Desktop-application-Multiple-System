export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function startOfTodayLocal(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

export function startOfWeekLocal(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

export function startOfMonthLocal(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

export function nowLocal(): string {
  return toDatetimeLocalValue(new Date());
}

export function formatPeriodLabel(fromLocal: string, toLocal: string): string {
  if (!fromLocal && !toLocal) return "All time";
  const fmt = (v: string) =>
    new Date(v).toLocaleString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (fromLocal && toLocal) return `${fmt(fromLocal)} — ${fmt(toLocal)}`;
  if (fromLocal) return `From ${fmt(fromLocal)}`;
  return `Until ${fmt(toLocal)}`;
}

export function toIsoRange(fromLocal: string, toLocal: string): { fromIso: string; toIso: string } {
  return {
    fromIso: fromLocal ? new Date(fromLocal).toISOString() : "",
    toIso: toLocal ? new Date(toLocal).toISOString() : "",
  };
}

export function isWithinRange(iso: string, fromLocal: string, toLocal: string): boolean {
  const t = new Date(iso).getTime();
  if (fromLocal && t < new Date(fromLocal).getTime()) return false;
  if (toLocal && t > new Date(toLocal).getTime()) return false;
  return true;
}

export type ReportDatePreset = "today" | "week" | "month" | "all";

export function presetRange(preset: ReportDatePreset): { from: string; to: string } {
  if (preset === "all") return { from: "", to: "" };
  const to = nowLocal();
  const from =
    preset === "today" ? startOfTodayLocal() : preset === "week" ? startOfWeekLocal() : startOfMonthLocal();
  return { from, to };
}
