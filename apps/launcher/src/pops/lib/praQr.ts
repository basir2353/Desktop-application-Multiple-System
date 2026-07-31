import QRCode from "qrcode";
import type { PraInvoiceMode } from "@platform/contracts";
import { RAILWAY_API_URL } from "../../lib/apiBase";

/**
 * Dead https host (RFC `.invalid`) — FPRA only.
 * Real PRA QR opens our public verify page (auto-searches e-IMS).
 */
const PRA_PHONE_BLOCK_PREFIX = "https://pra-inv.invalid/v1/";

/** Official PRA public invoice lookup (manual search — ignores query params). */
export const PRA_EIMS_VERIFY_URL = "https://e.pra.punjab.gov.pk/public/eims.xhtml";

/** Public host for phone QR scans (never localhost). */
const PRA_PUBLIC_VERIFY_BASE = `${RAILWAY_API_URL.replace(/\/$/, "")}/v1/pra/public-verify`;

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
  if (!inv) return PRA_PUBLIC_VERIFY_BASE;
  return `${PRA_PUBLIC_VERIFY_BASE}?InvoiceNo=${encodeURIComponent(inv)}`;
}

/**
 * Real PRA QR = public auto-verify link. FPRA = phone-block wrapper.
 */
export function sanitizePraQrPayload(
  payload: string,
  mode?: PraInvoiceMode | null,
): string {
  let cleaned = payload
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^FAKE$/i.test(p) && !/^DEMO$/i.test(p))
    .join("|")
    .trim();

  if (!cleaned) cleaned = "PRA";

  // Already our public verify link — keep.
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

  if (/^https:\/\/pra-inv\.invalid\//i.test(cleaned)) return cleaned;
  if (/^pra-inv:\/\//i.test(cleaned)) {
    try {
      const inner = decodeURIComponent(cleaned.replace(/^pra-inv:\/\/v1\//i, ""));
      return `${PRA_PHONE_BLOCK_PREFIX}${encodeURIComponent(inner || "PRA")}`;
    } catch {
      return `${PRA_PHONE_BLOCK_PREFIX}${encodeURIComponent(cleaned)}`;
    }
  }

  if (
    /^https:\/\//i.test(cleaned) &&
    /fbr\.gov|fbr\.gov\.pk/i.test(cleaned)
  ) {
    return cleaned;
  }

  return `${PRA_PHONE_BLOCK_PREFIX}${encodeURIComponent(cleaned)}`;
}

/** Decode scanned QR back to fiscal Invoice #. */
export function decodePraQrPayload(scanned: string): string {
  const raw = scanned.trim();
  try {
    const u = new URL(raw);
    if (
      /e\.pra\.punjab\.gov\.pk/i.test(u.hostname) ||
      /\/v1\/pra\/public-verify/i.test(u.pathname)
    ) {
      const inv = u.searchParams.get("InvoiceNo") || u.searchParams.get("invoiceNo");
      if (inv) return inv;
    }
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
