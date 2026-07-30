import type { PraInvoiceMode } from "@platform/contracts";

/**
 * Dead https host so phone camera opens browser → "site not found"
 * instead of Google-searching the plain invoice text.
 */
const PRA_PHONE_BLOCK_PREFIX = "https://pra-inv.invalid/v1/";

// Vendored qrcode core + dijkstrajs (Metro resolves via vendor/).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const QRCode = require("../../vendor/qrcode/lib/core/qrcode.js") as {
  create: (
    text: string,
    opts?: { errorCorrectionLevel?: string },
  ) => { modules: { size: number; get: (row: number, col: number) => boolean } };
};

/** Strip Fake/Demo markers so QR / payload never advertise demo mode. */
export function sanitizePraQrPayload(payload: string): string {
  let cleaned = payload
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^FAKE$/i.test(p) && !/^DEMO$/i.test(p))
    .join("|")
    .trim();

  if (!cleaned) cleaned = "PRA";

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
    /pra\.gov|punjab\.gov|eims|fbr\.gov|fbr\.gov\.pk/i.test(cleaned)
  ) {
    return cleaned;
  }

  return `${PRA_PHONE_BLOCK_PREFIX}${encodeURIComponent(cleaned)}`;
}

/** Inline SVG QR — works in silent HTML→PNG without network (no remote img). */
export function buildPraQrSvg(payload: string, size = 130): string {
  const text = sanitizePraQrPayload(payload.trim() || "PRA");
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
  const qrPayload = sanitizePraQrPayload(input.qrPayload);
  return {
    mode: input.mode,
    invoiceNumber: input.invoiceNumber.trim(),
    orderRef: input.orderRef,
    qrPayload,
    qrSvg: buildPraQrSvg(qrPayload, 130),
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
    </table>
    <div class="pra-qr-caption">This invoice generated on the PRA</div>
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
    .pra-qr-caption {
      display: block;
      width: 100%;
      margin-top: 6px;
      text-align: center !important;
      font-size: 10px;
      font-weight: 600;
      line-height: 1.3;
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
