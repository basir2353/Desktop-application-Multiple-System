import type { MobizoneDocumentAttachment } from "@platform/contracts";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

const MAX_BYTES = 4 * 1024 * 1024;

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Pick any file type (PDF, Word, PPT, etc.) and return stored attachments. */
export async function pickReferenceDocuments(
  existing: MobizoneDocumentAttachment[],
  maxFiles = 8,
): Promise<MobizoneDocumentAttachment[]> {
  const room = Math.max(0, maxFiles - existing.length);
  if (room === 0) throw new Error(`Maximum ${maxFiles} files per voucher.`);

  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: "*/*",
  });
  if (result.canceled) return existing;

  const next = [...existing];
  for (const asset of result.assets.slice(0, room)) {
    const size = asset.size ?? 0;
    if (size > MAX_BYTES) {
      throw new Error(`"${asset.name}" is too large (max 4 MB).`);
    }
    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mime = asset.mimeType || "application/octet-stream";
    next.push({
      id: newId(),
      fileName: asset.name || "document",
      mimeType: mime,
      sizeBytes: size,
      dataUrl: `data:${mime};base64,${base64}`,
      uploadedAt: new Date().toISOString(),
    });
  }
  return next;
}
