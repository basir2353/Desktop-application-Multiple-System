/** Max edge length for menu / logo photos stored on the item row. */
const MAX_EDGE = 640;
/** Target quality — keeps data-URL payloads under Nest/Zod limits. */
const JPEG_QUALITY = 0.72;
/** Hard cap so create/update JSON stays under the API body limit. */
const MAX_DATA_URL_CHARS = 900_000;

/**
 * Resize + JPEG-compress a picked image into a `data:image/jpeg;base64,...` URL.
 * Stored on the menu item/category row so photos survive Railway (no local disk).
 */
export async function compressMenuImageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPEG, PNG, WebP, or GIF).");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("Image is too large (max 12 MB before compress).");
  }

  const bitmap = await loadImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = JPEG_QUALITY;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.4) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error("Image is still too large after compress. Try a smaller photo.");
    }
    return dataUrl;
  } finally {
    bitmap.close?.();
  }
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image."));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image.");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image."))), "image/png");
    });
    return createImageBitmap(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}
