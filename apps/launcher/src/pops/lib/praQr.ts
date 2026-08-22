import QRCode from "qrcode";
import type { PraInvoiceMode } from "@platform/contracts";
import { getApiBaseUrl } from "../../lib/apiBase";

/** Official PRA public invoice lookup (manual search — ignores query params). */
export const PRA_EIMS_VERIFY_URL = "https://e.pra.punjab.gov.pk/public/eims.xhtml";

function praApiBase(): string {
  // Use the API this POS is actually talking to (Local or Live) so QR verify works.
  return getApiBaseUrl().replace(/\/$/, "");
}

/** e-IMS fiscal # pattern e.g. 197476FGYI38421035 */
export function looksLikeRealPraInvoiceNumber(value: string): boolean {
  return /^\d{4,8}[A-Za-z]{2,8}\d{6,}$/.test(value.trim());
}

/**
 * Phone-scan URL → our public verify page which auto-searches PRA e-IMS
 * (official eims.xhtml does not fill/search from ?InvoiceNo=).
 */
export function realPraVerifyUrl(invoiceNumber: string): string {
  const inv = invoiceNumber.trim();
  const base = `${praApiBase()}/v1/pra/public-verify`;
  if (!inv) return base;
  return `${base}?InvoiceNo=${encodeURIComponent(inv)}`;
}

/** FPRA slip QR → site page with only "Not Found". */
export function fpraNotFoundUrl(): string {
  return `${praApiBase()}/v1/pra/not-found`;
}

/**
 * Real PRA QR = public auto-verify link.
 * FPRA slip QR = https site that shows only "Not Found" (opens in browser, not Google search).
 */
export function sanitizePraQrPayload(
  payload: string,
  mode?: PraInvoiceMode | null,
): string {
  if (mode === "fake") return fpraNotFoundUrl();

  let cleaned = payload
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^FAKE$/i.test(p) && !/^DEMO$/i.test(p))
    .join("|")
    .trim();

  if (!cleaned) cleaned = "PRA";

  // Already FPRA not-found site — keep.
  if (/\/v1\/pra\/not-found/i.test(cleaned)) return fpraNotFoundUrl();

  // Legacy data:/plain text markers → real Not Found site (phones search those).
  if (/^data:text\/html/i.test(cleaned)) return fpraNotFoundUrl();
  if (/^invalid qr code$/i.test(cleaned)) return fpraNotFoundUrl();

  // Already our public verify link — keep (Real PRA).
  if (/\/v1\/pra\/public-verify/i.test(cleaned)) return cleaned;

  // Official PRA / e-IMS link — rewrite so scan auto-searches.
  if (
    /^https:\/\//i.test(cleaned) &&
    /e\.pra\.punjab\.gov\.pk|pra\.gov|punjab\.gov|eims/i.test(cleaned)
  ) {
    try {
      const u = new URL(cleaned);
      const inv = u.searchParams.get("InvoiceNo") || u.searchParams.get("invoiceNo");
      if (inv) return realPraVerifyUrl(inv);
    } catch {
      /* keep original below */
    }
    return cleaned;
  }

  // Real fiscal number → verify URL.
  if (mode === "real" || looksLikeRealPraInvoiceNumber(cleaned)) {
    if (/^https:\/\/pra-inv\.invalid\/v1\//i.test(cleaned)) {
      try {
        cleaned = decodeURIComponent(cleaned.replace(/^https:\/\/pra-inv\.invalid\/v1\//i, ""));
      } catch {
        cleaned = cleaned.replace(/^https:\/\/pra-inv\.invalid\/v1\//i, "");
      }
    }
    return realPraVerifyUrl(cleaned);
  }

  if (/^https:\/\/pra-inv\.invalid\//i.test(cleaned)) return fpraNotFoundUrl();
  if (/^pra-inv:\/\//i.test(cleaned)) return fpraNotFoundUrl();

  if (
    /^https:\/\//i.test(cleaned) &&
    /fbr\.gov|fbr\.gov\.pk/i.test(cleaned)
  ) {
    return cleaned;
  }

  return fpraNotFoundUrl();
}

/** Decode scanned QR back to fiscal Invoice #. */
export function decodePraQrPayload(scanned: string): string {
  const raw = scanned.trim();
  if (/^data:text\/html/i.test(raw)) return "";
  if (/^invalid qr code$/i.test(raw)) return "";
  try {
    const u = new URL(raw);
    if (
      /e\.pra\.punjab\.gov\.pk/i.test(u.hostname) ||
      /\/v1\/pra\/public-verify/i.test(u.pathname)
    ) {
      const inv = u.searchParams.get("InvoiceNo") || u.searchParams.get("invoiceNo");
      if (inv) return inv;
    }
    if (/\/v1\/pra\/not-found/i.test(u.pathname)) return "";
  } catch {
    /* not a URL */
  }
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

export async function praQrDataUrl(
  payload: string,
  size = 180,
  mode?: PraInvoiceMode | null,
): Promise<string> {
  const text = sanitizePraQrPayload(payload.trim() || "PRA", mode);
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
