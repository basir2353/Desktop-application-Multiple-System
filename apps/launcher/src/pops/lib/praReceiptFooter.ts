/** PRA footer for POS receipts: centered QR only (invoice # lives in receipt meta). */

import type { PraInvoiceMode } from "@platform/contracts";
import { praQrDataUrl, sanitizePraQrPayload } from "./praQr";

export type PraReceiptFooter = {
  mode: PraInvoiceMode;
  invoiceNumber: string;
  /** Matched POS order / bill ref for lookup. */
  orderRef: string;
  qrPayload: string;
  /** Pre-rendered PNG data URL (preferred for thermal print). */
  qrDataUrl?: string;
};

export async function preparePraReceiptFooter(input: {
  mode: PraInvoiceMode;
  invoiceNumber: string;
  orderRef: string;
  qrPayload: string;
}): Promise<PraReceiptFooter> {
  const qrPayload = sanitizePraQrPayload(input.qrPayload);
  const qrDataUrl = await praQrDataUrl(qrPayload, 160);
  return {
    mode: input.mode,
    invoiceNumber: input.invoiceNumber,
    orderRef: input.orderRef,
    qrPayload,
    qrDataUrl,
  };
}

/**
 * Bottom of receipt: centered QR only (no invoice text / logo).
 * Uses a full-width table — most reliable centering for thermal PNG print.
 */
export function buildPraReceiptFooterHtml(pra: PraReceiptFooter): string {
  const qr = pra.qrDataUrl
    ? `<img class="pra-qr" src="${pra.qrDataUrl}" alt="PRA QR" width="130" height="130" style="display:block;margin:0 auto;width:130px;height:130px;" />`
    : `<div class="pra-qr-fallback">${escapeHtml((pra.qrPayload || "").slice(0, 48))}</div>`;

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
    .pra-qr-fallback {
      display: inline-block;
      width: 130px;
      margin: 0 auto;
      font-size: 7px;
      word-break: break-all;
      border: 1px solid #000;
      padding: 4px;
      text-align: center;
    }
    .meta-pra-invoice .meta-value {
      font-weight: 700;
      letter-spacing: 0.01em;
      word-break: break-all;
      overflow-wrap: anywhere;
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
    }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
