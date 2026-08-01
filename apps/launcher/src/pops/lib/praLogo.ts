/**
 * Compact PRA (Punjab Revenue Authority) mark for thermal receipts.
 * Inline SVG so print works offline without fetching image assets.
 * Content Updation can override via businessProfile.praLogoUrl.
 */

import { loadBusinessProfile } from "./businessProfileSettings";
import { resolveMenuImageUrl } from "./menuImageUrl";

export const PRA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="PRA">
  <circle cx="36" cy="36" r="34" fill="#ffffff" stroke="#0a5c2e" stroke-width="2.5"/>
  <circle cx="36" cy="36" r="28" fill="none" stroke="#0a5c2e" stroke-width="1.2"/>
  <path d="M36 12c-2.2 6.5-7.5 11.2-14 13.5 4.2 1.2 7.6 4.2 9.5 8.2-1.8 5.8-1.2 11.5 2.2 16.2 4.8-3.5 8.2-8.8 9.2-15 4.5 2.8 7.8 7.2 9.2 12.5 3.5-6.2 3.8-13.5.8-19.8C48.5 21.2 42.8 15.5 36 12z" fill="#0a5c2e"/>
  <text x="36" y="58" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#0a5c2e">PRA</text>
</svg>`;

/** Data-URL form for <img> tags in print HTML (built-in mark). */
export function praLogoDataUrl(): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PRA_LOGO_SVG)}`;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Custom PRA logo from Content Updation, else built-in SVG.
 * Prefers a data URL so thermal print works offline.
 */
export async function resolvePraLogoSrc(branchCode?: string): Promise<string> {
  if (!branchCode) return praLogoDataUrl();
  const custom = loadBusinessProfile(branchCode).praLogoUrl;
  if (!custom) return praLogoDataUrl();
  if (custom.startsWith("data:")) return custom;
  const absolute = resolveMenuImageUrl(custom);
  if (!absolute) return praLogoDataUrl();
  const asData = await fetchImageAsDataUrl(absolute);
  return asData ?? absolute;
}
