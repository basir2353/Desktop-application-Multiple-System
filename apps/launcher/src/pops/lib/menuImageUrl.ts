import { getApiBaseUrl } from "../../lib/apiBase";

/** True when the value is stored in DB as an embedded photo (survives redeploys). */
export function isEmbeddedMenuImage(imageUrl: string | null | undefined): boolean {
  return Boolean(imageUrl?.trim().startsWith("data:image/"));
}

/** Legacy path written to ephemeral API disk — often 404 after deploy/update. */
export function isEphemeralUploadPath(imageUrl: string | null | undefined): boolean {
  return Boolean(imageUrl?.trim().startsWith("/uploads/"));
}

/** Turn a stored menu image path / data-URL into a value for <img src>. */
export function resolveMenuImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  // Relative paths (legacy /uploads/...) — may 404 after Railway/app update.
  return `${getApiBaseUrl()}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}
