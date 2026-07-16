import type { Bill, KitchenTicket } from "@platform/contracts";
import { billChannelLabel } from "./orderSales";
import { parseItemsSummary, type PosRecentOrder } from "./recentOrders";
import {
<<<<<<< Updated upstream
  billReceiptFontSizes,
=======
>>>>>>> Stashed changes
  DEFAULT_BILL_PRINT_SETTINGS,
  loadBillPrintSettings,
  type BillPrintSettings,
} from "./billPrintSettings";
import {
  DEFAULT_KOT_PRINT_SETTINGS,
  loadKotPrintSettings,
  type KotPrintSettings,
} from "./kotPrintSettings";

export type PrintLine = {
  label: string;
  qty: number;
  unitPrice: number;
};

export type PrintTicketInput = {
  kind: "receipt" | "kot";
  branchName: string;
  branchCode: string;
  orderRef: string;
  billRef?: string;
  modeLabel: string;
  tableLabel?: string;
  waiterName?: string;
  /** Assigned waiter printer — shown on ticket and print job title. */
  printerName?: string;
  notes?: string;
  lines: PrintLine[];
  subtotal: number;
  discount: number;
  service: number;
  tax: number;
  deliveryCharge?: number;
  total: number;
  servicePct: number;
  taxPct?: number;
  discountPct: number;
  kotSettings?: KotPrintSettings;
<<<<<<< Updated upstream
  billPrintSettings?: BillPrintSettings;
=======
  billSettings?: BillPrintSettings;
>>>>>>> Stashed changes
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(pkr: number): string {
  return `Rs ${pkr.toLocaleString("en-PK")}`;
}

export function buildTicketHtml(input: PrintTicketInput): string {
  const isReceipt = input.kind === "receipt";
  const kotSettings =
    input.kotSettings ??
    (input.branchCode ? loadKotPrintSettings(input.branchCode) : DEFAULT_KOT_PRINT_SETTINGS);
  const billSettings =
<<<<<<< Updated upstream
    input.billPrintSettings ??
    (input.branchCode ? loadBillPrintSettings(input.branchCode) : DEFAULT_BILL_PRINT_SETTINGS);
  const receiptFonts = billReceiptFontSizes(billSettings.baseFontSize);
  const fields = isReceipt ? billSettings.fields : null;
=======
    input.billSettings ??
    (input.branchCode ? loadBillPrintSettings(input.branchCode) : DEFAULT_BILL_PRINT_SETTINGS);
>>>>>>> Stashed changes
  const title = isReceipt ? billSettings.documentTitle : "Kitchen Order";
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const totalItems = input.lines.length;
  const totalQty = input.lines.reduce((sum, line) => sum + line.qty, 0);
  const showAmounts = isReceipt && billSettings.showItemPrices;

  const lineRows = input.lines
    .map((line) => {
      const lineTotal = line.unitPrice * line.qty;
      const itemBorder = !isReceipt && kotSettings.itemUnderlineSeparator
        ? ' style="border-bottom: 1px solid #111827"'
        : "";
      if (!isReceipt) {
        return `<tr${itemBorder}>
        <td class="item-name">${escapeHtml(line.label)}</td>
        <td class="qty">${line.qty}</td>
      </tr>`;
      }
      const showQty = fields!.itemQty;
      const showAmt = fields!.itemAmount;
      const colCount = 1 + (showQty ? 1 : 0) + (showAmt ? 2 : 0);
      return `<tr>
<<<<<<< HEAD
=======
<<<<<<< Updated upstream
        <td class="item-name" colspan="${showQty || showAmt ? 1 : 3}">${escapeHtml(line.label)}</td>
>>>>>>> d254a17d4c4c9e28e2ec23741cf4b524cadd10c9
        ${showQty ? `<td class="qty">${line.qty}</td>` : ""}
        <td class="item-name" colspan="${showQty || showAmt ? 1 : colCount}">${escapeHtml(line.label)}</td>
        ${showAmt ? `<td class="price">${formatMoney(line.unitPrice)}</td>` : ""}
        ${showAmt ? `<td class="amt">${formatMoney(lineTotal)}</td>` : ""}
=======
        <td class="item-name">${escapeHtml(line.label)}</td>
        <td class="qty">${line.qty}</td>
        ${showAmounts ? `<td class="amt">${formatMoney(lineTotal)}</td>` : ""}
>>>>>>> Stashed changes
      </tr>`;
    })
    .join("");

<<<<<<< Updated upstream
  const totalsRows = isReceipt && fields
    ? [
        fields.subtotal
          ? `<div class="row"><span class="label">Subtotal</span><span class="value">${formatMoney(input.subtotal)}</span></div>`
          : "",
        fields.discount && input.discount > 0
          ? `<div class="row"><span class="label">Discount${input.discountPct > 0 ? ` (${input.discountPct}%)` : ""}</span><span class="value discount">− ${formatMoney(input.discount)}</span></div>`
          : "",
        fields.service
          ? `<div class="row"><span class="label">Service charge (${input.servicePct}%)</span><span class="value">${formatMoney(input.service)}</span></div>`
          : "",
        fields.tax
          ? `<div class="row"><span class="label">Tax (${input.taxPct ?? 15}%)</span><span class="value">${formatMoney(input.tax)}</span></div>`
          : "",
        fields.delivery && (input.deliveryCharge ?? 0) > 0
          ? `<div class="row"><span class="label">Delivery</span><span class="value">${formatMoney(input.deliveryCharge!)}</span></div>`
          : "",
        fields.total
          ? `<div class="row grand"><span class="label">Total</span><span class="value">${formatMoney(input.total)}</span></div>`
          : "",
      ].filter(Boolean)
    : [];

  const totalsBlock =
    isReceipt && totalsRows.length > 0 ? `<div class="totals">${totalsRows.join("")}</div>` : "";

  const metaRows = isReceipt && fields
    ? [
        fields.orderRef ? `<span class="meta-chip meta-primary">${escapeHtml(input.orderRef)}</span>` : null,
        fields.orderType ? `<span class="meta-chip meta-primary">${escapeHtml(input.modeLabel)}</span>` : null,
        fields.tableLabel && input.tableLabel
          ? `<span class="meta-chip meta-primary">${escapeHtml(input.tableLabel)}</span>`
          : null,
        fields.billRef && input.billRef
          ? `<span class="meta-chip bill-ref">Bill ${escapeHtml(input.billRef)}</span>`
          : null,
        fields.waiterName && input.waiterName
          ? `<span class="meta-chip">Waiter: ${escapeHtml(input.waiterName)}</span>`
          : null,
        fields.printerName && input.printerName
          ? `<span class="meta-chip">Printer: ${escapeHtml(input.printerName)}</span>`
          : null,
      ]
        .filter(Boolean)
        .join("")
    : [
        `<span class="meta-chip meta-primary">${escapeHtml(input.orderRef)}</span>`,
        `<span class="meta-chip meta-primary">${escapeHtml(input.modeLabel)}</span>`,
        input.tableLabel
          ? `<span class="meta-chip meta-primary">${escapeHtml(input.tableLabel)}</span>`
          : null,
        input.billRef ? `<span class="meta-chip bill-ref">Bill ${escapeHtml(input.billRef)}</span>` : null,
        input.waiterName ? `<span class="meta-chip">Waiter: ${escapeHtml(input.waiterName)}</span>` : null,
        input.printerName ? `<span class="meta-chip">Printer: ${escapeHtml(input.printerName)}</span>` : null,
      ]
        .filter(Boolean)
        .join("");
=======
  const totalsBlock = isReceipt
    ? `<div class="totals">
        <div class="row"><span class="label">Subtotal</span><span class="value">${formatMoney(input.subtotal)}</span></div>
        ${
          billSettings.showDiscountLine && input.discount > 0
            ? `<div class="row"><span class="label">Discount${input.discountPct > 0 ? ` (${input.discountPct}%)` : ""}</span><span class="value discount">− ${formatMoney(input.discount)}</span></div>`
            : ""
        }
        ${
          billSettings.showServiceCharge
            ? `<div class="row"><span class="label">Service charge (${input.servicePct}%)</span><span class="value">${formatMoney(input.service)}</span></div>`
            : ""
        }
        ${
          billSettings.showTaxLine
            ? `<div class="row"><span class="label">Tax (${input.taxPct ?? 15}%)</span><span class="value">${formatMoney(input.tax)}</span></div>`
            : ""
        }
        ${(input.deliveryCharge ?? 0) > 0 ? `<div class="row"><span class="label">Delivery</span><span class="value">${formatMoney(input.deliveryCharge!)}</span></div>` : ""}
        <div class="row grand"><span class="label">Total</span><span class="value">${formatMoney(input.total)}</span></div>
      </div>`
    : "";

  const metaRows = [
    `<span class="meta-chip meta-primary">${escapeHtml(input.orderRef)}</span>`,
    `<span class="meta-chip meta-primary">${escapeHtml(input.modeLabel)}</span>`,
    input.tableLabel
      ? `<span class="meta-chip meta-primary">${escapeHtml(input.tableLabel)}</span>`
      : null,
    input.billRef ? `<span class="meta-chip bill-ref">Bill ${escapeHtml(input.billRef)}</span>` : null,
    input.waiterName && (!isReceipt || billSettings.showWaiterName)
      ? `<span class="meta-chip">Waiter: ${escapeHtml(input.waiterName)}</span>`
      : null,
    input.printerName && (!isReceipt || billSettings.showPrinterName)
      ? `<span class="meta-chip">Printer: ${escapeHtml(input.printerName)}</span>`
      : null,
  ]
    .filter(Boolean)
    .join("");
>>>>>>> Stashed changes

  const kotTotalsBlock =
    !isReceipt && kotSettings.showItemTotals
      ? `<div class="kot-totals">
          <div class="row"><span class="label">Total items</span><span class="value">${totalItems}</span></div>
          <div class="row"><span class="label">Total quantity</span><span class="value">${totalQty}</span></div>
        </div>`
      : "";

<<<<<<< Updated upstream
  const bodyFontSize = !isReceipt ? kotSettings.baseFontSize : receiptFonts.body;
  // Order ref / type / table chips are always emphasized (bold, larger) on customer receipts;
  // on kitchen tickets it stays behind the existing toggle.
  const emphasizeMeta = isReceipt || kotSettings.emphasizeOrderMeta;
  const compact = isReceipt && billSettings.layout === "compact";
  const headerAlign = isReceipt && billSettings.headerAlign === "left" ? "left" : "center";
  const showItemTable = !isReceipt || fields!.itemQty || fields!.itemAmount || input.lines.length > 0;
  const showQtyCol = !isReceipt || fields!.itemQty;
  // Price/Amount are receipt-only — kitchen tickets never show pricing to kitchen staff.
  const showAmtCol = isReceipt && fields!.itemAmount;
  const showItemHeaders = !isReceipt || fields!.itemHeaders;
  const displayBusinessName =
    isReceipt && billSettings.headerBusinessName.trim()
      ? billSettings.headerBusinessName.trim()
      : input.branchName;
  const showHeaderSubtitle =
    isReceipt && fields!.headerSubtitle && billSettings.headerSubtitle.trim().length > 0;
  const showFooterPrimary = isReceipt && fields!.footer;
  const showFooterSecondary =
    isReceipt && fields!.footerSecondary && billSettings.footerSecondaryText.trim().length > 0;
  const showHeaderBlock =
    isReceipt && fields && (fields.branchName || fields.documentTitle || showHeaderSubtitle);
  const receiptCss = isReceipt
    ? `
    body { padding: ${compact ? "8px 10px 12px" : "16px 14px 20px"}; line-height: ${compact ? "1.35" : "1.5"}; }
    .header { text-align: ${headerAlign}; padding-bottom: ${compact ? "8px" : "12px"}; margin-bottom: ${compact ? "8px" : "12px"}; }
    .meta { justify-content: ${headerAlign === "left" ? "flex-start" : "center"}; margin: ${compact ? "8px 0 10px" : "12px 0 14px"}; }
    .notes, .timestamp { text-align: ${headerAlign}; }
    tbody td { padding: ${compact ? "3px 0" : "5px 0"}; }
    .branch-name { font-size: ${receiptFonts.branchName}px; }
    .doc-type { font-size: ${receiptFonts.docType}px; }
    .meta-chip { font-size: ${receiptFonts.metaChip}px; }
    .meta-chip.bill-ref { font-size: ${receiptFonts.metaChipBillRef}px; }
    .notes { font-size: ${receiptFonts.notes}px; }
    .timestamp { font-size: ${receiptFonts.timestamp}px; }
    thead th { font-size: ${receiptFonts.th}px; }
    td.item-name { font-size: ${receiptFonts.itemName}px; }
    td.qty { font-size: ${receiptFonts.qty}px; }
    td.price { font-size: ${receiptFonts.amt}px; }
    td.amt { font-size: ${receiptFonts.amt}px; }
    .row .label { font-size: ${receiptFonts.rowLabel}px; }
    .row .value { font-size: ${receiptFonts.rowValue}px; }
    .row.grand .label { font-size: ${receiptFonts.grandLabel}px; }
    .row.grand .value { font-size: ${receiptFonts.grandValue}px; }
    .footer { font-size: ${receiptFonts.footer}px; }
    .header-subtitle { font-size: ${receiptFonts.headerSubtitle}px; }
    .footer-secondary { font-size: ${receiptFonts.footerSecondary}px; }
    `
    : "";
=======
  const bodyFontSize = isReceipt ? billSettings.baseFontSize : kotSettings.baseFontSize;
  const emphasizeMeta = !isReceipt && kotSettings.emphasizeOrderMeta;
  const paperWidth = isReceipt ? billSettings.paperWidthMm : 80;
  const headerSubtitle =
    isReceipt && billSettings.headerSubtitle.trim()
      ? `<div class="header-subtitle">${escapeHtml(billSettings.headerSubtitle.trim())}</div>`
      : "";
  const notesBlock =
    input.notes && (!isReceipt || billSettings.showOrderNotes)
      ? `<p class="notes">${escapeHtml(input.notes)}</p>`
      : "";
  const timestampBits = [
    isReceipt && billSettings.showBranchCode ? escapeHtml(input.branchCode) : null,
    !isReceipt ? escapeHtml(input.branchCode) : null,
    (!isReceipt || billSettings.showTimestamp) ? escapeHtml(printedAt) : null,
  ].filter(Boolean);
  const timestampBlock =
    timestampBits.length > 0
      ? `<div class="timestamp">${timestampBits.join(" · ")}</div>`
      : "";
  const footerText = isReceipt
    ? escapeHtml(billSettings.footerMessage)
    : '<div class="kot-banner">Kitchen copy — order</div>';
>>>>>>> Stashed changes

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — ${escapeHtml(input.orderRef)}${input.printerName ? ` · ${escapeHtml(input.printerName)}` : ""}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: ${bodyFontSize}px;
      font-weight: 400;
      line-height: 1.5;
      color: #111827;
      background: #fff;
      margin: 0 auto;
      padding: 16px 14px 20px;
      max-width: ${paperWidth}mm;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .header {
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 1.5px solid #111827;
      margin-bottom: 12px;
    }
    .branch-name {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.25;
      color: #111827;
    }
    .header-subtitle {
      margin-top: 4px;
      font-size: 9px;
      font-weight: 500;
      color: #6b7280;
    }
    .doc-type {
      margin-top: 6px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #4b5563;
    }
    .header-subtitle {
      margin-top: 4px;
      font-size: 8.5px;
      font-weight: 500;
      color: #6b7280;
      line-height: 1.35;
    }
    .meta {
      margin: 12px 0 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 6px;
      justify-content: center;
    }
    .meta-chip {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 500;
      color: #374151;
      background: #f3f4f6;
      border-radius: 4px;
      padding: 2px 6px;
      line-height: 1.4;
    }
    .meta-chip.bill-ref {
      font-weight: 600;
      color: #111827;
      background: #e5e7eb;
    }
    .meta-chip.meta-primary {
      font-size: ${emphasizeMeta ? "12px" : "9.5px"};
      font-weight: ${emphasizeMeta ? "700" : "500"};
      color: #111827;
      background: ${emphasizeMeta ? "#fde68a" : "#f3f4f6"};
    }
    .notes {
      margin: -6px 0 12px;
      text-align: center;
      font-size: 9.5px;
      font-style: italic;
      color: #6b7280;
    }
    .timestamp {
      text-align: center;
      font-size: 9px;
      font-weight: 500;
      color: #9ca3af;
      margin-bottom: 14px;
      letter-spacing: 0.02em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 10px;
    }
    thead th {
      font-size: 8.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
      padding: 0 0 6px;
      border-bottom: 1px solid #d1d5db;
      text-align: left;
    }
    thead th.qty { width: 32px; text-align: center; }
    thead th.price { text-align: right; }
    thead th.amt { text-align: right; }
    tbody td {
      padding: 5px 0;
      vertical-align: top;
      border-bottom: 1px solid #f3f4f6;
    }
    tbody tr:last-child td { border-bottom: none; }
    td.item-name {
      font-size: 10.5px;
      font-weight: 500;
      color: #111827;
      padding-right: 6px;
    }
    td.qty {
      width: 32px;
      text-align: center;
      font-size: 10px;
      font-weight: 600;
      color: #374151;
      font-variant-numeric: tabular-nums;
    }
    td.price {
      text-align: right;
      white-space: nowrap;
      font-size: 10px;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
      color: #6b7280;
      padding-right: 8px;
    }
    td.amt {
      text-align: right;
      white-space: nowrap;
      font-size: 10px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: #111827;
    }
    .totals {
      border-top: 1.5px solid #111827;
      padding-top: 8px;
      margin-top: 4px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin: 3px 0;
      gap: 12px;
    }
    .row .label {
      font-size: 9.5px;
      font-weight: 500;
      color: #4b5563;
    }
    .row .value {
      font-size: 10px;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: #111827;
      white-space: nowrap;
    }
    .row .value.discount { color: #dc2626; }
    .row.grand {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #d1d5db;
    }
    .row.grand .label {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
    }
    .row.grand .value {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.02em;
    }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #9ca3af;
    }
    .footer-secondary {
      margin-top: 6px;
      font-size: 8px;
      font-weight: 400;
      letter-spacing: 0.02em;
      text-transform: none;
      color: #6b7280;
      line-height: 1.4;
    }
    .kot-banner {
      margin-top: 8px;
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #111827;
      border: 1.5px solid #111827;
      padding: 6px 8px;
    }
    .kot-totals {
      border-top: 1px dashed #9ca3af;
      padding-top: 8px;
      margin: 8px 0 4px;
    }
    @media print {
      body { padding: 0; }
      .meta-chip { background: transparent; padding: 0; }
      @page { margin: 4mm; size: ${paperWidth}mm auto; }
    }
    ${receiptCss}
  </style>
</head>
<body>
  ${showHeaderBlock
    ? `<header class="header">
    ${fields!.branchName ? `<div class="branch-name">${escapeHtml(displayBusinessName)}</div>` : ""}
    ${showHeaderSubtitle ? `<div class="header-subtitle">${escapeHtml(billSettings.headerSubtitle.trim())}</div>` : ""}
    ${fields!.documentTitle ? `<div class="doc-type">${escapeHtml(title)}</div>` : ""}
  </header>`
    : !isReceipt
      ? `<header class="header">
    <div class="branch-name">${escapeHtml(input.branchName)}</div>
    ${headerSubtitle}
    <div class="doc-type">${escapeHtml(title)}</div>
<<<<<<< Updated upstream
  </header>`
      : ""}
  ${metaRows ? `<div class="meta">${metaRows}</div>` : ""}
  ${isReceipt && fields?.notes && input.notes ? `<p class="notes">${escapeHtml(input.notes)}</p>` : !isReceipt && input.notes ? `<p class="notes">${escapeHtml(input.notes)}</p>` : ""}
  ${isReceipt && fields && (fields.timestamp || fields.branchCode)
    ? `<div class="timestamp">${[
        fields.branchCode ? escapeHtml(input.branchCode) : "",
        fields.timestamp ? escapeHtml(printedAt) : "",
      ]
        .filter(Boolean)
        .join(" · ")}</div>`
    : !isReceipt
      ? `<div class="timestamp">${escapeHtml(input.branchCode)} · ${escapeHtml(printedAt)}</div>`
      : ""}
  ${showItemTable
    ? `<table>
    ${showItemHeaders
      ? `<thead>
      <tr>
        ${showQtyCol ? '<th class="qty">Qty</th>' : ""}
        <th>Item</th>
        ${showAmtCol ? '<th class="price">Price</th>' : ""}
        ${showAmtCol ? '<th class="amt">Amount</th>' : ""}
=======
  </header>
  <div class="meta">${metaRows}</div>
  ${notesBlock}
  ${timestampBlock}
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="qty">Qty</th>
        ${showAmounts ? '<th class="amt">Amount</th>' : ""}
>>>>>>> Stashed changes
      </tr>
    </thead>`
      : ""}
    <tbody>${lineRows}</tbody>
  </table>`
    : ""}
  ${kotTotalsBlock}
  ${totalsBlock}
<<<<<<< Updated upstream
  ${showFooterPrimary || showFooterSecondary
    ? `<div class="footer">
    ${showFooterPrimary ? escapeHtml(billSettings.footerText) : ""}
    ${showFooterSecondary ? `<div class="footer-secondary">${escapeHtml(billSettings.footerSecondaryText.trim())}</div>` : ""}
  </div>`
    : !isReceipt
      ? '<div class="footer"><div class="kot-banner">Kitchen copy — order</div></div>'
      : ""}
=======
  <div class="footer">${footerText}</div>
>>>>>>> Stashed changes
</body>
</html>`;
}

/** Opens the system print dialog with a thermal-style ticket. */
export function printTicket(input: PrintTicketInput): boolean {
  if (input.lines.length === 0) return false;

  const html = buildTicketHtml(input);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "print");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  if (input.printerName) {
    doc.title = `${input.kind === "receipt" ? "Receipt" : "KOT"} · ${input.printerName}`;
  }

  const cleanup = (): void => {
    setTimeout(() => iframe.remove(), 500);
  };

  win.onafterprint = cleanup;

  // Give layout a tick before print (WebKit / Tauri webview).
  requestAnimationFrame(() => {
    win.focus();
    win.print();
    setTimeout(cleanup, 30_000);
  });

  return true;
}

export function billToPrintInput(
  branchName: string,
  branchCode: string,
  bill: Bill,
): Omit<PrintTicketInput, "kind"> {
  return {
    branchName,
    branchCode,
    orderRef: bill.orderRef ?? bill.billRef,
    billRef: bill.billRef,
    modeLabel: billChannelLabel(bill.tableLabel),
    tableLabel: bill.tableLabel,
    waiterName: bill.waiterName,
    notes: bill.notes ?? undefined,
    lines: bill.lines.map((line) => ({
      label: line.label,
      qty: line.qty,
      unitPrice: line.unitPrice,
    })),
    subtotal: bill.subtotal,
    discount: bill.discount,
    service: bill.service,
    tax: bill.tax,
    deliveryCharge: bill.deliveryChargePkr > 0 ? bill.deliveryChargePkr : undefined,
    total: bill.total,
    servicePct: bill.servicePct,
    taxPct: bill.taxPct,
    discountPct: bill.subtotal > 0 ? Math.round((bill.discount / bill.subtotal) * 100) : 0,
  };
}

export function printReceipt(input: Omit<PrintTicketInput, "kind">): boolean {
  return printTicket({ ...input, kind: "receipt" });
}

export function printBill(
  branchName: string,
  branchCode: string,
  bill: Bill,
  options?: { printerName?: string; billPrintSettings?: BillPrintSettings },
): boolean {
  return printReceipt({
    ...billToPrintInput(branchName, branchCode, bill),
    printerName: options?.printerName,
    billPrintSettings: options?.billPrintSettings ?? loadBillPrintSettings(branchCode),
  });
}

export function kitchenTicketToKotPrint(
  ticket: KitchenTicket,
  branchName: string,
  branchCode: string,
): Omit<PrintTicketInput, "kind"> {
  const lines = parseItemsSummary(ticket.itemsSummary).map((line) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: line.unitPrice ?? 0,
  }));

  return {
    branchName,
    branchCode,
    orderRef: ticket.orderRef ?? ticket.ticketRef,
    modeLabel: billChannelLabel(ticket.stationLabel),
    tableLabel: ticket.stationLabel,
    lines: lines.length > 0 ? lines : [{ label: ticket.itemsSummary || "Items", qty: 1, unitPrice: 0 }],
    subtotal: 0,
    discount: 0,
    service: 0,
    tax: 0,
    total: 0,
    servicePct: 0,
    discountPct: 0,
  };
}

export function printPosRecentOrder(
  branchName: string,
  branchCode: string,
  order: PosRecentOrder,
  options?: { printerName?: string },
): boolean {
  if (order.kind === "paid" && order.bill) {
    return printBill(branchName, branchCode, order.bill, { printerName: options?.printerName });
  }
  if (order.kitchenTicket) {
    return printKot(kitchenTicketToKotPrint(order.kitchenTicket, branchName, branchCode));
  }
  if (order.detail.kind === "pending") {
    return printKot({
      branchName,
      branchCode,
      orderRef: order.detail.orderRef ?? order.detail.ticketRef,
      modeLabel: order.orderMode,
      tableLabel: order.stationLabel,
      lines: order.detail.lines.map((line) => ({
        label: line.label,
        qty: line.qty,
        unitPrice: line.unitPrice ?? 0,
      })),
      subtotal: 0,
      discount: 0,
      service: 0,
      tax: 0,
      total: 0,
      servicePct: 0,
      discountPct: 0,
    });
  }
  return false;
}

export function printKot(input: Omit<PrintTicketInput, "kind">): boolean {
  return printTicket({ ...input, kind: "kot" });
}
