import { loadBusinessProfile } from "./businessProfileSettings";
import { resolveMenuImageUrl } from "./menuImageUrl";

/**
 * Absolute URL (or data URL) for the company logo on receipt header.
 * Returns null when Content Updation has no business logo.
 */
export function resolveBusinessLogoSrc(branchCode?: string): string | null {
  if (!branchCode) return null;
  const raw = loadBusinessProfile(branchCode).logoUrl;
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  return resolveMenuImageUrl(raw);
}
