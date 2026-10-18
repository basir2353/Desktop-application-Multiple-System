import { join } from "node:path";

/**
 * Root directory for legacy file-based menu uploads (`/uploads/...`).
 *
 * Prefer `UPLOADS_DIR` or `DATA_DIR` so files can live on a Railway volume /
 * persistent disk outside the ephemeral deploy workspace. Falls back to
 * `cwd/data/uploads` (wiped on most redeploys — do not rely on this alone).
 */
export function resolveUploadsRoot(): string {
  const uploadsDir = process.env.UPLOADS_DIR?.trim();
  if (uploadsDir) return uploadsDir;

  const dataDir = process.env.DATA_DIR?.trim();
  if (dataDir) return join(dataDir, "uploads");

  return join(process.cwd(), "data", "uploads");
}

export function resolveMenuUploadsRoot(): string {
  return join(resolveUploadsRoot(), "menu");
}

/** Map a public `/uploads/...` URL path to an absolute file path, or null. */
export function absolutePathForUploadUrl(imageUrl: string): string | null {
  const trimmed = imageUrl.trim();
  if (!trimmed.startsWith("/uploads/")) return null;
  const relative = trimmed.slice("/uploads/".length);
  if (!relative || relative.includes("..")) return null;
  return join(resolveUploadsRoot(), ...relative.split("/").filter(Boolean));
}

export function mimeFromUploadFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Max data-URL length stored on menu rows (matches contracts Zod max). */
export const MAX_MENU_IMAGE_DATA_URL_CHARS = 1_400_000;

export function bufferToMenuImageDataUrl(buffer: Buffer, mimetype: string): string {
  return `data:${mimetype};base64,${buffer.toString("base64")}`;
}

export function isEphemeralUploadPath(imageUrl: string | null | undefined): boolean {
  return Boolean(imageUrl?.trim().startsWith("/uploads/"));
}

export function isPersistedMenuImageUrl(imageUrl: string | null | undefined): boolean {
  const trimmed = imageUrl?.trim() ?? "";
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  );
}
