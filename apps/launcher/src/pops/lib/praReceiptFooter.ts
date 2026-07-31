/** PRA footer for POS receipts: Invoice # + QR + PRA logo. */

import type { PraInvoiceMode } from "@platform/contracts";
import { praLogoDataUrl } from "./praLogo";
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

/** Drop leading zeros on numeric FPRA #s so slips show 35929 not 00000006. */
export function formatPraInvoiceNumberForSlip(invoiceNumber: string): string {
  const t = invoiceNumber.trim();
  if (/^\d+$/.test(t)) return String(Number(t));
  return t;
}

export async function preparePraReceiptFooter(input: {
  mode: PraInvoiceMode;
  invoiceNumber: string;
  orderRef: string;
  qrPayload: string;
}): Promise<PraReceiptFooter> {
  // Real: public verify URL. FPRA: https site that only shows "Not Found".
  const raw = (input.qrPayload?.trim() || input.invoiceNumber).trim();
  const qrPayload = sanitizePraQrPayload(raw, input.mode);
  const qrDataUrl = await praQrDataUrl(qrPayload, 160, input.mode);
  return {
    mode: input.mode,
    invoiceNumber: formatPraInvoiceNumberForSlip(input.invoiceNumber),
    orderRef: input.orderRef,
    qrPayload,
    qrDataUrl,
  };
}

/**
 * Bottom of receipt: PRA Invoice # + centered QR + PRA logo (thermal-safe table layout).
 */
export function buildPraReceiptFooterHtml(pra: PraReceiptFooter): string {
  const qr = pra.qrDataUrl
    ? `<img class="pra-qr" src="${pra.qrDataUrl}" alt="PRA QR" width="130" height="130" style="display:block;margin:0 auto;width:130px;height:130px;" />`
    : `<div class="pra-qr-fallback">${escapeHtml((pra.qrPayload || "").slice(0, 48))}</div>`;
  const invoiceNo = escapeHtml(pra.invoiceNumber || "");
  const logoSrc = praLogoDataUrl();

  return `
  <div class="pra-fbr-block">
    <div class="pra-rule"></div>
    <div class="pra-invoice-line"><strong>PRA Invoice #</strong> ${invoiceNo}</div>
    <table class="pra-qr-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;border-collapse:collapse;">
      <tr>
        <td align="center" valign="middle" style="text-align:center;width:100%;">
          ${qr}
        </td>
      </tr>
      <tr>
        <td align="center" valign="middle" style="text-align:center;width:100%;padding-top:6px;">
          <img class="pra-logo" src="${logoSrc}" alt="PRA" width="56" height="56" style="display:block;margin:0 auto;width:56px;height:56px;" />
        </td>
      </tr>
    </table>
    <div class="pra-logo-label">Punjab Revenue Authority</div>
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
    .pra-logo {
      display: block !important;
      width: 56px !important;
      height: 56px !important;
      margin: 0 auto !important;
      padding: 0 !important;
      border: 0 !important;
    }
    .pra-logo-label {
      display: block;
      width: 100%;
      margin-top: 4px;
      text-align: center !important;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.2;
      color: #000;
    }
    .pra-invoice-line {
      display: block;
      width: 100%;
      margin: 0 0 8px;
      text-align: center !important;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.35;
      color: #000;
      word-break: break-all;
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
