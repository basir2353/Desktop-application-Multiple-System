import type { PraInvoiceMode } from "@platform/contracts";

/**
 * Dead https host so phone camera opens browser → "site not found"
 * instead of Google-searching the plain invoice text.
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

/**
 * Remote PNG QR for thermal HTML (phone + desktop print server both have network).
 * Avoids bundling qrcode/dijkstrajs into the APK Metro graph.
 */
export function buildPraQrImageUrl(payload: string, size = 130): string {
  const text = sanitizePraQrPayload(payload.trim() || "PRA");
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=1&data=${encodeURIComponent(text)}`;
}

export type PraReceiptFooter = {
  mode: PraInvoiceMode;
  invoiceNumber: string;
  orderRef: string;
  qrPayload: string;
  qrImageUrl: string;
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
    invoiceNumber: input.invoiceNumber,
    orderRef: input.orderRef,
    qrPayload,
    qrImageUrl: buildPraQrImageUrl(qrPayload, 130),
  };
}

export function buildPraReceiptFooterHtml(pra: PraReceiptFooter): string {
  const qr = `<img class="pra-qr" src="${pra.qrImageUrl}" alt="PRA QR" width="130" height="130" style="display:block;margin:0 auto;width:130px;height:130px;" />`;

  return `
  <div class="pra-fbr-block">
    <div class="pra-rule"></div>
    <table class="pra-qr-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;border-collapse:collapse;">
      <tr>
        <td align="center" valign="middle" style="text-align:center;width:100%;">
          ${qr}
        </td>
      </tr>
    </table>
    <div class="pra-qr-caption">This invoice generated on the PRA</div>
  </div>`;
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
    .pra-qr {
      display: block !important;
      width: 130px !important;
      height: 130px !important;
      margin: 0 auto !important;
      padding: 0 !important;
      border: 0 !important;
      image-rendering: pixelated;
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
