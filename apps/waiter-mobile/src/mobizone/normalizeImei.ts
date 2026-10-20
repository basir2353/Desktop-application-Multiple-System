/** Prefer a 15-digit IMEI if the barcode embeds extra text / *stars*. */
export function normalizeImeiScan(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const unwrapped = trimmed.replace(/\*/g, " ").replace(/\s+/g, " ").trim();
  const beforeSlash = unwrapped.split("/")[0]?.trim() ?? unwrapped;
  const imei15 = beforeSlash.match(/\b\d{15}\b/) || unwrapped.match(/\b\d{15}\b/);
  if (imei15) return imei15[0]!;
  const digits = beforeSlash.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length <= 17) return digits;
  const allDigits = unwrapped.replace(/\D/g, "");
  if (allDigits.length >= 8 && allDigits.length <= 17) return allDigits;
  return beforeSlash;
}
