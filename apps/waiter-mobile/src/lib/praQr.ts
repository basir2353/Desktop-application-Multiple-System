import type { PraInvoiceMode } from "@platform/contracts";
import { getApiBaseUrl } from "./apiBase";

/** Public host for phone QR scans (never localhost). Real PRA only. */
function praPublicVerifyBase(): string {
  return `${getApiBaseUrl().replace(/\/$/, "")}/v1/pra/public-verify`;
}

/** FPRA slip QR — real https site that only shows "Not Found". */
export function fpraNotFoundUrl(): string {
  return `${getApiBaseUrl().replace(/\/$/, "")}/v1/pra/not-found`;
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

  if (/\/v1\/pra\/not-found/i.test(cleaned)) return fpraNotFoundUrl();
  if (/^data:text\/html/i.test(cleaned)) return fpraNotFoundUrl();
  if (/^invalid qr code$/i.test(cleaned)) return fpraNotFoundUrl();

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

  if (/^https:\/\/pra-inv\.invalid\//i.test(cleaned)) return fpraNotFoundUrl();
  if (/^pra-inv:\/\//i.test(cleaned)) return fpraNotFoundUrl();

  if (/^https:\/\//i.test(cleaned) && /fbr\.gov|fbr\.gov\.pk/i.test(cleaned)) {
    return cleaned;
  }

  return fpraNotFoundUrl();
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
  // Real: public verify URL. FPRA: https site that only shows "Not Found".
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
    <div class="pra-invoice-block">
      <div class="pra-invoice-label">PRA Invoice #</div>
      <div class="pra-invoice-number">${escapeHtml(pra.invoiceNumber)}</div>
    </div>
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
      font-size: 22px;
      font-weight: 400;
      margin: 0 0 8px;
      letter-spacing: 0;
      font-family: ui-monospace, "Cascadia Mono", "Consolas", "Courier New", monospace;
      word-break: break-all;
    }
    .pra-invoice-block {
      display: block;
      width: 100%;
      margin: 0 0 10px;
      text-align: center !important;
      color: #000;
    }
    .pra-invoice-label {
      display: block;
      width: 100%;
      margin: 0 0 4px;
      text-align: center !important;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1.2;
      color: #000;
    }
    .pra-invoice-number {
      display: block;
      width: 100%;
      text-align: center !important;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 1.25;
      color: #000;
      font-variant-numeric: tabular-nums;
      font-family: ui-monospace, "Cascadia Mono", "Consolas", "Courier New", monospace;
      word-break: break-all;
      overflow-wrap: anywhere;
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
    .meta-pra-invoice {
      flex-direction: column;
      align-items: stretch;
      gap: 2px;
      margin: 2px 0 8px;
      padding: 4px 0 6px;
      border-bottom: 1px dashed #000;
    }
    .meta-pra-invoice .meta-label {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      width: 100%;
    }
    .meta-pra-invoice .meta-value {
      font-size: 26px !important;
      font-weight: 700;
      letter-spacing: 0;
      font-family: ui-monospace, "Cascadia Mono", "Consolas", "Courier New", monospace;
      word-break: break-all;
      overflow-wrap: anywhere;
      white-space: normal !important;
      text-align: left;
      line-height: 1.25;
      width: 100%;
    }
`;
