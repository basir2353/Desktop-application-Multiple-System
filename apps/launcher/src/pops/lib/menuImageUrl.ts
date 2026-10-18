import { getApiBaseUrl } from "../../lib/apiBase";

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
  return `${getApiBaseUrl()}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}
