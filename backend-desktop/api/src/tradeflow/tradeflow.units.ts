export function altFactorOf(item: { altFactor: number; defaultRatePkr: number }): number {
  return item.altFactor > 0 ? item.altFactor : item.defaultRatePkr || 1;
}

export function toPrimaryQty(item: { altFactor: number; defaultRatePkr: number }, qty: number, unitKind?: string): number {
  if (unitKind !== "alt") return qty;
  return qty / altFactorOf(item);
}

export function toAltQty(item: { altFactor: number; defaultRatePkr: number }, primaryQty: number): number {
  return primaryQty * altFactorOf(item);
}

export function roundMoney(n: number): number {
  return Math.round(Number.isFinite(n) ? n : 0);
}

export function waDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
}

export function waUrl(phone: string | null | undefined, message: string): string | null {
  const digits = waDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
