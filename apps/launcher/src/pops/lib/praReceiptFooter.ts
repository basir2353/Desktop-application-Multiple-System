/** PRA footer for POS receipts: Invoice # + QR + PRA logo. */

import type { PraInvoiceMode } from "@platform/contracts";
import { praLogoDataUrl, resolvePraLogoSrc } from "./praLogo";
import { praQrDataUrl, sanitizePraQrPayload } from "./praQr";

export type PraReceiptFooter = {
  mode: PraInvoiceMode;
  invoiceNumber: string;
  /** Matched POS order / bill ref for lookup. */
  orderRef: string;
  qrPayload: string;
  /** Pre-rendered PNG data URL (preferred for thermal print). */
  qrDataUrl?: string;
  /** Custom or default PRA mark (data URL preferred). */
  logoDataUrl?: string;
};

/** Keep FPRA / Real invoice ids as stored (e.g. 197476FGYI32391068). */
export function formatPraInvoiceNumberForSlip(
  invoiceNumber: string,
  mode?: PraInvoiceMode,
): string {
  const t = invoiceNumber.trim();
  if (!t) return t;
  // Already real-looking alphanumeric (from updated API).
  if (/[A-Za-z]/.test(t)) return t.toUpperCase();
  // Legacy FPRA short numeric (35929…) → expand for slip so it looks like real PRA.
  if (mode !== "real" && /^\d+$/.test(t)) {
    return expandLegacyFakePraInvoiceNumber(t);
  }
  return t;
}

/** Old API used base 35928 + seq. Map that (or plain seq) into 6+4+8 style. */
export function expandLegacyFakePraInvoiceNumber(raw: string): string {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return raw.trim();
  const FAKE_PRA_INVOICE_BASE = 35928;
  const seq = Math.max(1, Math.floor(num > FAKE_PRA_INVOICE_BASE ? num - FAKE_PRA_INVOICE_BASE : num));
  const prefix = String(197475 + seq).padStart(6, "0").slice(-6);
  const letters = fakePraLetterBlockFromSeq(seq);
  const suffix = String(10_000_000 + ((seq * 7919 + 3_239_106) % 89_999_999)).slice(-8);
  return `${prefix}${letters}${suffix}`;
}

function fakePraLetterBlockFromSeq(seq: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let h = Math.imul(seq, 2654435761) >>> 0;
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += alphabet[(h + i * 17) % alphabet.length]!;
    h = (Math.imul(h, 33) + i) >>> 0;
  }
  return out;
}

export async function preparePraReceiptFooter(input: {
  mode: PraInvoiceMode;
  invoiceNumber: string;
  orderRef: string;
  qrPayload: string;
  /** Branch whose Content Updation PRA logo should print. */
  branchCode?: string;
}): Promise<PraReceiptFooter> {
  // Real: public verify URL. FPRA: https site that only shows "Not Found".
  const raw = (input.qrPayload?.trim() || input.invoiceNumber).trim();
  const qrPayload = sanitizePraQrPayload(raw, input.mode);
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    praQrDataUrl(qrPayload, 160, input.mode),
    resolvePraLogoSrc(input.branchCode),
  ]);
  return {
    mode: input.mode,
    invoiceNumber: formatPraInvoiceNumberForSlip(input.invoiceNumber, input.mode),
    orderRef: input.orderRef,
    qrPayload,
    qrDataUrl,
    logoDataUrl,
  };
}

/**
 * Bottom of receipt: large PRA Invoice # (real-slip style) + centered QR + PRA logo.
 */
export function buildPraReceiptFooterHtml(pra: PraReceiptFooter): string {
  const qr = pra.qrDataUrl
    ? `<img class="pra-qr" src="${pra.qrDataUrl}" alt="PRA QR" width="130" height="130" style="display:block;margin:0 auto;width:130px;height:130px;" />`
    : `<div class="pra-qr-fallback">${escapeHtml((pra.qrPayload || "").slice(0, 48))}</div>`;
  const invoiceNo = escapeHtml(pra.invoiceNumber || "");
  const logoSrc = pra.logoDataUrl || praLogoDataUrl();

  return `
  <div class="pra-fbr-block">
    <div class="pra-rule"></div>
    <div class="pra-invoice-block">
      <div class="pra-invoice-label">PRA Invoice #</div>
      <div class="pra-invoice-number">${invoiceNo}</div>
    </div>
    <table class="pra-qr-table" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;border-collapse:collapse;">
      <tr>
        <td align="center" valign="middle" style="text-align:center;width:100%;">
          ${qr}
        </td>
      </tr>
      <tr>
        <td align="center" valign="middle" style="text-align:center;width:100%;padding-top:6px;">
          <img class="pra-logo" src="${logoSrc}" alt="PRA" width="56" height="56" style="display:block;margin:0 auto;width:56px;height:56px;object-fit:contain;" />
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
      object-fit: contain;
    }
    .pra-logo-label {
      display: block;
      width: 100%;
      margin-top: 4px;
      text-align: center !important;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.02em;
      line-height: 1.2;
      color: #000;
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
    /* Legacy single-line class (if any old HTML still references it). */
    .pra-invoice-line {
      display: block;
      width: 100%;
      margin: 0 0 8px;
      text-align: center !important;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 1.25;
      color: #000;
      font-family: ui-monospace, "Cascadia Mono", "Consolas", "Courier New", monospace;
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
      font-size: 26px !important;
      font-weight: 700;
      letter-spacing: 0;
      font-family: ui-monospace, "Cascadia Mono", "Consolas", "Courier New", monospace;
      word-break: break-all;
      overflow-wrap: anywhere;
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
      line-height: 1.25;
    }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
