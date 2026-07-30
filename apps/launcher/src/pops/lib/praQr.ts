import QRCode from "qrcode";

/**
 * Dead https host (RFC `.invalid`) so phone camera opens the browser and gets
 * "site not found" — instead of Google-searching the plain invoice text.
 * Printed thermal scanners still read the full QR string from the slip.
 */
const PRA_PHONE_BLOCK_PREFIX = "https://pra-inv.invalid/v1/";

/** Strip Fake/Demo markers so QR / payload never advertise demo mode. */
export function sanitizePraQrPayload(payload: string): string {
  let cleaned = payload
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^FAKE$/i.test(p) && !/^DEMO$/i.test(p))
    .join("|")
    .trim();

  if (!cleaned) cleaned = "PRA";

  // Already phone-blocked.
  if (/^https:\/\/pra-inv\.invalid\//i.test(cleaned)) return cleaned;
  if (/^pra-inv:\/\//i.test(cleaned)) {
    try {
      const inner = decodeURIComponent(cleaned.replace(/^pra-inv:\/\/v1\//i, ""));
      return `${PRA_PHONE_BLOCK_PREFIX}${encodeURIComponent(inner || "PRA")}`;
    } catch {
      return `${PRA_PHONE_BLOCK_PREFIX}${encodeURIComponent(cleaned)}`;
    }
  }

  // Keep real government verify portals openable on phone.
  if (
    /^https:\/\//i.test(cleaned) &&
    /pra\.gov|punjab\.gov|eims|fbr\.gov|fbr\.gov\.pk/i.test(cleaned)
  ) {
    return cleaned;
  }

  // Plain text / PRA|… / invoice # → wrap so phones hit "not found", not Google.
  return `${PRA_PHONE_BLOCK_PREFIX}${encodeURIComponent(cleaned)}`;
}

/** Decode a scanned payload back to the raw fiscal string (for POS scanners). */
export function decodePraQrPayload(scanned: string): string {
  const raw = scanned.trim();
  if (/^https:\/\/pra-inv\.invalid\/v1\//i.test(raw)) {
    try {
      return decodeURIComponent(raw.replace(/^https:\/\/pra-inv\.invalid\/v1\//i, ""));
    } catch {
      return raw.replace(/^https:\/\/pra-inv\.invalid\/v1\//i, "");
    }
  }
  if (/^pra-inv:\/\/v1\//i.test(raw)) {
    try {
      return decodeURIComponent(raw.replace(/^pra-inv:\/\/v1\//i, ""));
    } catch {
      return raw.replace(/^pra-inv:\/\/v1\//i, "");
    }
  }
  return raw;
}

/** Build a PNG data URL for the PRA QR payload (thermal-friendly). */
export async function praQrDataUrl(payload: string, size = 180): Promise<string> {
  const text = sanitizePraQrPayload(payload.trim() || "PRA");
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
