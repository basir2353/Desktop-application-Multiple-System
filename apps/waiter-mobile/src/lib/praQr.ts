import type { PraInvoiceMode } from "@platform/contracts";
import { getApiBaseUrl } from "./apiBase";

/**
 * Dead https host (RFC `.invalid`) — FPRA only.
 * Real PRA QR opens our public verify page (auto-searches e-IMS).
 */
const PRA_PHONE_BLOCK_PREFIX = "https://pra-inv.invalid/v1/";

/** Public host for phone QR scans (never localhost). */
function praPublicVerifyBase(): string {
  return `${getApiBaseUrl().replace(/\/$/, "")}/v1/pra/public-verify`;
}

/** Compact PRA mark for thermal receipts (inline SVG). */
const PRA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 72 72" role="img" aria-label="PRA">
  <circle cx="36" cy="36" r="34" fill="#ffffff" stroke="#0a5c2e" stroke-width="2.5"/>
  <circle cx="36" cy="36" r="28" fill="none" stroke="#0a5c2e" stroke-width="1.2"/>
  <path d="M36 12c-2.2 6.5-7.5 11.2-14 13.5 4.2 1.2 7.6 4.2 9.5 8.2-1.8 5.8-1.2 11.5 2.2 16.2 4.8-3.5 8.2-8.8 9.2-15 4.5 2.8 7.8 7.2 9.2 12.5 3.5-6.2 3.8-13.5.8-19.8C48.5 21.2 42.8 15.5 36 12z" fill="#0a5c2e"/>
  <text x="36" y="58" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#0a5c2e">PRA</text>
</svg>`;

// Vendored qrcode core + dijkstrajs (Metro resolves via vendor/).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("../../vendor/qrcode/lib/core/qrcode.js") as {
  create: (
    text: string,
    opts?: { errorCorrectionLevel?: string },
  ) => { modules: { size: number; get: (row: number, col: number) => boolean } };
};

/** e-IMS fiscal # pattern e.g. 197476FGYI38421035 */
export function looksLikeRealPraInvoiceNumber(value: string): boolean {
  return /^\d{4,8}[A-Za-z]{2,8}\d{6,}$/.test(value.trim());
}

/** Phone-scan URL → public verify page which auto-searches PRA e-IMS. */
export function realPraVerifyUrl(invoiceNumber: string): string {
  const base = praPublicVerifyBase();
  const inv = invoiceNumber.trim();
  if (!inv) return base;
  return `${base}?InvoiceNo=${encodeURIComponent(inv)}`;
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

  if (/\/v1\/pra\/public-verify/i.test(cleaned)) return cleaned;

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

  if (/^https:\/\//i.test(cleaned) && /fbr\.gov|fbr\.gov\.pk/i.test(cleaned)) {
    return cleaned;
  }

  return `${PRA_PHONE_BLOCK_PREFIX}${encodeURIComponent(cleaned)}`;
}

/** Inline SVG QR — works in silent HTML→PNG without network (no remote img). */
export function buildPraQrSvg(payload: string, size = 130, mode?: PraInvoiceMode | null): string {
  const text = sanitizePraQrPayload(payload.trim() || "PRA", mode);
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
  ];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (qr.modules.get(y, x)) {
        parts.push(
          `<rect x="${(x * cell).toFixed(3)}" y="${(y * cell).toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}" fill="#000000"/>`,
        );
      }
    }
  }
  parts.push("</svg>");
  return parts.join("");
}

export type PraReceiptFooter = {
  mode: PraInvoiceMode;
  invoiceNumber: string;
  orderRef: string;
  qrPayload: string;
  qrSvg: string;
};

export function preparePraReceiptFooter(input: {
  mode: PraInvoiceMode;
  invoiceNumber: string;
  orderRef: string;
  qrPayload: string;
}): PraReceiptFooter {
  const raw = (input.qrPayload?.trim() || input.invoiceNumber).trim();
  const qrPayload = sanitizePraQrPayload(raw, input.mode);
  return {
    mode: input.mode,
    invoiceNumber: input.invoiceNumber.trim(),
    orderRef: input.orderRef,
    qrPayload,
    qrSvg: buildPraQrSvg(qrPayload, 130, input.mode),
  };
}

export function buildPraReceiptFooterHtml(pra: PraReceiptFooter): string {
  return `
  <div class="pra-fbr-block">
    <div class="pra-rule"></div>
    <div class="pra-invoice-line"><strong>PRA Invoice #</strong> ${escapeHtml(pra.invoiceNumber)}</div>
    <table class="pra-qr-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;border-collapse:collapse;">
      <tr>
        <td align="center" valign="middle" style="text-align:center;width:100%;">
          <div class="pra-qr-wrap">${pra.qrSvg}</div>
        </td>
      </tr>
      <tr>
        <td align="center" valign="middle" style="text-align:center;width:100%;padding-top:6px;">
          <div class="pra-logo-wrap">${PRA_LOGO_SVG}</div>
        </td>
      </tr>
    </table>
    <div class="pra-logo-label">Punjab Revenue Authority</div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const PRA_RECEIPT_FOOTER_CSS = `
    .pra-fbr-block {
      margin-top: 10px;
      padding: 6px 0 4px;
      text-align: center !important;
      color: #000;
      width: 100% !important;
    }
    .pra-rule {
      border-top: 1.5px dashed #000;
      margin: 0 0 10px;
      width: 100%;
    }
    .pra-invoice-line {
      text-align: center;
      font-size: 12px;
      font-weight: 700;
      margin: 0 0 8px;
      word-break: break-all;
    }
    .pra-qr-table {
      width: 100% !important;
      margin: 0 auto !important;
      border-collapse: collapse;
    }
    .pra-qr-table td {
      text-align: center !important;
      vertical-align: middle !important;
      width: 100%;
    }
    .pra-qr-wrap {
      display: inline-block;
      width: 130px;
      height: 130px;
      margin: 0 auto;
    }
    .pra-qr-wrap svg {
      display: block;
      width: 130px;
      height: 130px;
    }
    .pra-logo-wrap {
      display: inline-block;
      width: 56px;
      height: 56px;
      margin: 0 auto;
    }
    .pra-logo-wrap svg {
      display: block;
      width: 56px;
      height: 56px;
    }
    .pra-logo-label {
      display: block;
      width: 100%;
      margin-top: 4px;
      text-align: center !important;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.2;
      color: #000;
    }
    .meta-pra-invoice .meta-value {
      font-weight: 700;
      letter-spacing: 0.01em;
      word-break: break-all;
      overflow-wrap: anywhere;
      white-space: normal !important;
    }
`;
