import { loadBusinessProfile } from "./businessProfileSettings";
import { resolveMenuImageUrl } from "./menuImageUrl";

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return null;
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
    const b64 = btoa(binary);
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
    return `data:${contentType};base64,${b64}`;
  } catch {
    return null;
  }
}

/**
 * Absolute URL (or data URL) for the company logo on receipt header.
 * Returns null when Content Updation has no business logo.
 * Prefer {@link resolveBusinessLogoDataUrl} before silent HTML→PNG (remote URLs break raster).
 */
export function resolveBusinessLogoSrc(branchCode?: string): string | null {
  if (!branchCode) return null;
  const raw = loadBusinessProfile(branchCode).logoUrl;
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  return resolveMenuImageUrl(raw);
}

/**
 * Data-URL logo for thermal silent print. Remote http(s) logos taint html-to-image
 * and caused "Missing image/HTML payload for silent print" on mobile receipt jobs.
 */
export async function resolveBusinessLogoDataUrl(branchCode?: string): Promise<string | null> {
  const src = resolveBusinessLogoSrc(branchCode);
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  return (await fetchImageAsDataUrl(src)) ?? null;
}
