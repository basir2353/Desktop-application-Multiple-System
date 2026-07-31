import type { Bill, KitchenTicket, MenuItem } from "@platform/contracts";
import * as Print from "expo-print";
import { Alert } from "react-native";
import { extractKitchenNotes } from "./loadOrder";
import {
  activeKitchenPrinters,
  loadMobilePrinterSettings,
} from "./mobilePrinterSettings";
import { formatPkr, orderRefFromTicket } from "./orderDisplay";
import { trySilentBranchPrint } from "./branchPrintClient";
import { resolvePraFooterForBillPrint } from "./praReceipt";
import {
  buildPraReceiptFooterHtml,
  PRA_RECEIPT_FOOTER_CSS,
  type PraReceiptFooter,
} from "./praQr";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type PrintLine = { label: string; qty: number; unitPrice?: number };

function linesFromTicket(ticket: KitchenTicket): PrintLine[] {
  if (ticket.lines && ticket.lines.length > 0) {
    return ticket.lines.map((line) => ({
      label: line.label,
      qty: line.qty,
      unitPrice: line.unitPrice,
    }));
  }

  const foodPart =
    ticket.itemsSummary.split(/\s·\s*Delivery\b/i)[0]?.split(" · ")[0]?.trim() ||
    ticket.itemsSummary.trim();

  return foodPart
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s+x(\d+)$/i);
      return match
        ? { label: match[1].trim(), qty: Number(match[2]), unitPrice: 0 }
        : { label: part, qty: 1, unitPrice: 0 };
    });
}

function buildKotHtml(input: {
  branchName: string;
  branchCode: string;
  orderRef: string;
  ticketRef: string;
  stationLabel: string;
  waiterName?: string | null;
  notes?: string | null;
  priority?: string;
  lines: PrintLine[];
  total?: number | null;
  isOrderUpdate?: boolean;
}): string {
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const totalQty = input.lines.reduce((sum, line) => sum + line.qty, 0);
  const totalItems = input.lines.length;
  const mode = input.stationLabel.trim();
  const tableMatch = mode.match(/table\s+(.+)$/i);
  const tableLabel = tableMatch?.[1]?.trim() ?? "";
  const showTable = Boolean(tableLabel) && tableLabel.toLowerCase() !== mode.toLowerCase();
  const isUpdate = Boolean(input.isOrderUpdate);

  const lineRows = input.lines
    .map(
      (line) => `<tr class="kot-item-sep">
        <td class="qty">${line.qty}</td>
        <td class="item-name">${escapeHtml(line.label)}</td>
      </tr>`,
    )
    .join("");

  const metaChips = [
    `<span class="meta-chip meta-primary">${escapeHtml(input.orderRef)}</span>`,
    `<span class="meta-chip meta-primary">${escapeHtml(mode)}</span>`,
    showTable ? `<span class="meta-chip meta-primary">${escapeHtml(tableLabel)}</span>` : null,
    input.waiterName ? `<span class="meta-chip">By: ${escapeHtml(input.waiterName)}</span>` : null,
    isUpdate ? `<span class="meta-chip meta-update">UPDATE</span>` : null,
    input.priority === "priority" ? `<span class="meta-chip meta-update">PRIORITY</span>` : null,
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body.ticket-kot {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.25;
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 6px 3px 10px;
      overflow-x: hidden;
    }
    .header {
      text-align: center;
      padding-bottom: 8px;
      border-bottom: 1.5px solid #000;
      margin-bottom: 10px;
    }
    .branch-name {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
      color: #000;
    }
    .doc-type {
      margin-top: 6px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #000;
    }
    .meta {
      margin: 8px 0 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
    }
    .meta-chip {
      display: inline-block;
      max-width: 100%;
      font-size: 13px;
      font-weight: 500;
      color: #000;
      border-radius: 4px;
      padding: 3px 7px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }
    .meta-chip.meta-primary {
      font-size: 15px;
      font-weight: 800;
      background: #facc15 !important;
      border: 1.5px solid #000 !important;
      border-radius: 2px;
      padding: 4px 8px;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .meta-chip.meta-update {
      font-weight: 800;
      border: 1.5px solid #000;
    }
    .kot-update-banner {
      text-align: center;
      font-weight: 800;
      letter-spacing: 0.06em;
      border: 2px solid #000;
      padding: 6px 4px;
      margin: 0 0 8px;
    }
    .notes {
      margin: -2px 0 8px;
      text-align: center;
      font-size: 13px;
      font-style: italic;
      color: #000;
    }
    .timestamp {
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      color: #000;
      margin-bottom: 0;
      letter-spacing: 0.02em;
    }
    .kot-mid-space {
      height: 8px;
      margin: 0 0 4px;
      border-bottom: 1.5px solid #000;
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      table-layout: fixed;
    }
    thead th {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #000;
      padding: 6px 0 5px;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      text-align: left;
    }
    thead th.qty, td.qty {
      width: 16%;
      text-align: left;
      padding-right: 12px;
      white-space: nowrap;
      font-weight: 800;
    }
    thead th.item, td.item-name {
      text-align: right;
      width: auto;
      padding-left: 0;
      font-weight: 800;
    }
    tbody td {
      padding: 8px 0;
      border-bottom: 1px solid #000;
      line-height: 1.25;
      vertical-align: middle;
      color: #000;
    }
    tbody tr:last-child td { border-bottom: 1.5px solid #000; }
    td.item-name {
      font-size: 16px;
      overflow-wrap: break-word;
    }
    td.qty {
      font-size: 17px;
      font-variant-numeric: tabular-nums;
    }
    .kot-totals {
      margin: 10px 0 4px;
      padding-top: 8px;
      border-top: 1px dashed #000;
    }
    .kot-totals .row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      font-weight: 700;
      font-size: 13px;
    }
    .footer { margin-top: 12px; }
    .kot-banner {
      margin-top: 8px;
      padding: 10px 8px;
      border: 2.5px solid #000;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-align: center;
      text-transform: uppercase;
    }
  </style>
</head>
<body class="ticket-kot">
  <header class="header">
    <div class="branch-name">${escapeHtml(input.branchName)}</div>
    <div class="doc-type">Kitchen Order</div>
  </header>
  <div class="meta">${metaChips}</div>
  ${isUpdate ? `<div class="kot-update-banner">*** UPDATE — REVISED ORDER ***</div>` : ""}
  ${input.notes?.trim() ? `<p class="notes">${escapeHtml(input.notes.trim())}</p>` : ""}
  <div class="timestamp">${escapeHtml(printedAt)}</div>
  <div class="kot-mid-space" aria-hidden="true"></div>
  <table class="items">
    <thead>
      <tr>
        <th class="qty">QTY</th>
        <th class="item">ITEM</th>
      </tr>
    </thead>
    <tbody>${lineRows || `<tr><td class="qty">—</td><td class="item-name">No items</td></tr>`}</tbody>
  </table>
  <div class="kot-totals">
    <div class="row"><span class="label">Total items</span><span class="value">${totalItems}</span></div>
    <div class="row"><span class="label">Total quantity</span><span class="value">${totalQty}</span></div>
  </div>
  <div class="footer">
    <div class="kot-banner">${isUpdate ? "Kitchen copy — UPDATE" : "Kitchen copy — order"}</div>
  </div>
</body>
</html>`;
}

function buildReceiptHtml(
  branchName: string,
  branchCode: string,
  bill: Bill,
  pra?: PraReceiptFooter | null,
): string {
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const lineRows = bill.lines
    .map(
      (line) => `<tr>
        <td class="qty">${line.qty}</td>
        <td class="item-name">${escapeHtml(line.label)}</td>
        <td class="amt">${formatPkr(line.unitPrice * line.qty)}</td>
      </tr>`,
    )
    .join("");

  const metaRows = [
    `<div class="meta-row meta-row-strong"><span class="meta-label">Order</span><span class="meta-value">${escapeHtml(bill.orderRef ?? bill.billRef)}</span></div>`,
    pra?.invoiceNumber
      ? `<div class="meta-row meta-row-strong meta-pra-invoice"><span class="meta-label">PRA Invoice #</span><span class="meta-value">${escapeHtml(pra.invoiceNumber)}</span></div>`
      : "",
    `<div class="meta-row meta-row-strong"><span class="meta-label">Type</span><span class="meta-value">${escapeHtml(bill.tableLabel)}</span></div>`,
    `<div class="meta-row"><span class="meta-label">Bill</span><span class="meta-value">${escapeHtml(bill.billRef)}</span></div>`,
    bill.waiterName
      ? `<div class="meta-row"><span class="meta-label">Cashier</span><span class="meta-value">${escapeHtml(bill.waiterName)}</span></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const praFooter = pra ? buildPraReceiptFooterHtml(pra) : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body.ticket-receipt {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.25;
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 6px 3px 10px;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .branch-name {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
      text-align: center;
      color: #000;
      padding: 2px 0 4px;
      border-bottom: 1.5px solid #000;
    }
    .doc-type {
      margin-top: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-align: center;
      color: #000;
    }
    .meta-block { margin: 10px 0 12px; }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 2px 0;
      font-size: 12px;
    }
    .meta-row-strong { font-weight: 800; }
    .meta-label { color: #000; font-weight: 600; }
    .meta-value { text-align: right; font-weight: 700; }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 10px;
      table-layout: fixed;
    }
    thead th {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #000;
      padding: 0 0 6px;
      border-bottom: 1px solid #d1d5db;
      text-align: left;
    }
    thead th.qty { width: 12%; }
    thead th.amt { width: 28%; text-align: right; }
    tbody td {
      padding: 5px 0;
      vertical-align: top;
      border-bottom: 1px solid #f3f4f6;
    }
    tbody tr:last-child td { border-bottom: none; }
    td.qty { font-weight: 700; font-variant-numeric: tabular-nums; }
    td.item-name { font-weight: 700; font-size: 12px; overflow-wrap: break-word; }
    td.amt { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .totals { margin-top: 8px; }
    .totals .row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      font-size: 12px;
    }
    .totals .row.grand {
      font-weight: 800;
      font-size: 14px;
      border-top: 2px solid #000;
      margin-top: 6px;
      padding-top: 6px;
    }
    .timestamp {
      text-align: center;
      font-size: 11px;
      font-weight: 500;
      margin: 10px 0 6px;
    }
    .footer {
      text-align: center;
      margin-top: 10px;
      font-weight: 700;
      font-size: 12px;
    }
    .held {
      text-align: center;
      margin-top: 12px;
      font-weight: 800;
      border: 2px solid #000;
      padding: 8px;
    }
    ${PRA_RECEIPT_FOOTER_CSS}
  </style>
</head>
<body class="ticket-receipt">
  <div class="branch-name">${escapeHtml(branchName)}</div>
  <div class="doc-type">Customer Receipt</div>
  <div class="meta-block">${metaRows}</div>
  <table class="items">
    <thead>
      <tr>
        <th class="qty">QTY</th>
        <th class="item">ITEM</th>
        <th class="amt">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatPkr(bill.subtotal)}</span></div>
    <div class="row"><span>Service (${bill.servicePct}%)</span><span>${formatPkr(bill.service)}</span></div>
    <div class="row"><span>${pra ? `Sales Tax (${bill.taxPct}%)` : `Tax (${bill.taxPct}%)`}</span><span>${formatPkr(bill.tax)}</span></div>
    ${bill.deliveryChargePkr > 0 ? `<div class="row"><span>Delivery</span><span>${formatPkr(bill.deliveryChargePkr)}</span></div>` : ""}
    <div class="row grand"><span>Total</span><span>${formatPkr(bill.total)}</span></div>
  </div>
  <div class="timestamp">${escapeHtml(printedAt)} · ${escapeHtml(branchCode)}</div>
  ${bill.status === "held" ? '<div class="held">*** ON HOLD — NOT PAID ***</div>' : '<div class="footer">Thank you — visit again</div>'}
  ${praFooter}
</body>
</html>`;
}

async function printHtml(
  html: string,
  hint?: string,
  opts?: {
    branchCode?: string;
    kind?: "receipt" | "kot";
    /** Soft profile/label hint for desktop routing — never treated as Windows spooler name. */
    printerName?: string | null;
    orderId?: string | null;
  },
): Promise<boolean> {
  if (opts?.branchCode) {
    const { loadMobilePrinterSettings } = await import("./mobilePrinterSettings");
    const settings = await loadMobilePrinterSettings();
    if (!settings.autoPrint) return false;

    const anySilentMode = settings.modeLive || settings.modeIp || settings.modeServer;

    // Never send mobile display labels as systemPrinterName — that caused XPS/PDF picks on Windows.
    const silent = await trySilentBranchPrint({
      branchCode: opts.branchCode,
      printerName: opts.printerName ?? null,
      orderId: opts.orderId ?? null,
      payload: {
        kind: opts.kind ?? "receipt",
        html,
        systemPrinterName: null,
        copies: 1,
        orderRef: opts.orderId ?? null,
      },
    });
    if (silent) return true;

    // Silent modes are configured — do not fall back to Expo dialog (wrong format / PDF / loops).
    if (anySilentMode) {
      return false;
    }
  }

  // Expo dialog only when every silent mode is OFF (manual / debug).
  try {
    if (hint?.trim()) {
      await new Promise<void>((resolve) => {
        Alert.alert(
          "Select printer",
          `In the print dialog, choose:\n\n${hint.trim()}`,
          [{ text: "Continue", onPress: () => resolve() }],
          { cancelable: false },
        );
      });
    }
    await Print.printAsync({ html });
    return true;
  } catch {
    return false;
  }
}

async function printKitchenHtml(
  html: string,
  opts?: { branchCode?: string; orderId?: string | null },
): Promise<boolean> {
  const settings = await loadMobilePrinterSettings();
  const kitchens = activeKitchenPrinters(settings);
  // Profile label only (e.g. "Kitchen 1") — desktop routes to linked OS printer by kind/name.
  const printerName = kitchens[0] ?? null;
  return printHtml(html, undefined, {
    branchCode: opts?.branchCode,
    kind: "kot",
    printerName,
    orderId: opts?.orderId ?? null,
  });
}

async function printBillHtml(
  html: string,
  opts?: { branchCode?: string; orderId?: string | null },
): Promise<boolean> {
  const settings = await loadMobilePrinterSettings();
  const bill = settings.billPrinter.trim() || null;
  return printHtml(html, undefined, {
    branchCode: opts?.branchCode,
    kind: "receipt",
    printerName: bill,
    orderId: opts?.orderId ?? null,
  });
}

export async function printBillReceipt(
  branchName: string,
  branchCode: string,
  bill: Bill,
): Promise<boolean> {
  const pra = await resolvePraFooterForBillPrint({
    branchCode,
    bill,
    issueIfMissing: true,
  }).catch(() => null);
  return printBillHtml(buildReceiptHtml(branchName, branchCode, bill, pra), {
    branchCode,
    orderId: bill.billRef,
  });
}

/** Print a customer bill from cart / ticket lines (before or without a saved bill). */
export async function printCartBill(input: {
  branchName: string;
  branchCode: string;
  orderRef: string;
  tableLabel: string;
  waiterName?: string | null;
  lines: Array<{ label: string; qty: number; unitPrice: number }>;
  subtotal: number;
  service: number;
  servicePct: number;
  tax: number;
  taxPct: number;
  total: number;
  deliveryChargePkr?: number;
}): Promise<boolean> {
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const lineRows = input.lines
    .map(
      (line) => `<tr>
        <td class="qty">${line.qty}</td>
        <td class="item-name">${escapeHtml(line.label)}</td>
        <td class="amt">${formatPkr(line.unitPrice * line.qty)}</td>
      </tr>`,
    )
    .join("");
  const delivery = input.deliveryChargePkr ?? 0;
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body.ticket-receipt {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.25;
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 6px 3px 10px;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .branch-name {
      font-size: 16px; font-weight: 700; text-align: center;
      padding: 2px 0 4px; border-bottom: 1.5px solid #000;
    }
    .doc-type {
      margin-top: 6px; font-size: 11px; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase; text-align: center;
    }
    .meta-block { margin: 10px 0 12px; }
    .meta-row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .meta-row-strong { font-weight: 800; }
    .meta-label { font-weight: 600; }
    .meta-value { text-align: right; font-weight: 700; }
    table.items { width: 100%; border-collapse: collapse; margin: 8px 0 10px; table-layout: fixed; }
    thead th {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      padding: 0 0 6px; border-bottom: 1px solid #d1d5db; text-align: left;
    }
    thead th.qty { width: 12%; }
    thead th.amt { width: 28%; text-align: right; }
    tbody td { padding: 5px 0; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    td.qty { font-weight: 700; }
    td.item-name { font-weight: 700; overflow-wrap: break-word; }
    td.amt { text-align: right; font-weight: 700; }
    .totals { margin-top: 8px; }
    .totals .row { display: flex; justify-content: space-between; padding: 2px 0; }
    .totals .row.grand {
      font-weight: 800; font-size: 14px; border-top: 2px solid #000;
      margin-top: 6px; padding-top: 6px;
    }
    .timestamp { text-align: center; font-size: 11px; margin: 10px 0 6px; }
    .footer { text-align: center; margin-top: 10px; font-weight: 700; }
  </style>
</head>
<body class="ticket-receipt">
  <div class="branch-name">${escapeHtml(input.branchName)}</div>
  <div class="doc-type">Customer Receipt</div>
  <div class="meta-block">
    <div class="meta-row meta-row-strong"><span class="meta-label">Order</span><span class="meta-value">${escapeHtml(input.orderRef)}</span></div>
    <div class="meta-row meta-row-strong"><span class="meta-label">Type</span><span class="meta-value">${escapeHtml(input.tableLabel)}</span></div>
    ${input.waiterName ? `<div class="meta-row"><span class="meta-label">Cashier</span><span class="meta-value">${escapeHtml(input.waiterName)}</span></div>` : ""}
  </div>
  <table class="items">
    <thead><tr><th class="qty">QTY</th><th class="item">ITEM</th><th class="amt">AMOUNT</th></tr></thead>
    <tbody>${lineRows || `<tr><td class="qty">—</td><td class="item-name">No items</td><td class="amt">—</td></tr>`}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${formatPkr(input.subtotal)}</span></div>
    <div class="row"><span>Service (${input.servicePct}%)</span><span>${formatPkr(input.service)}</span></div>
    <div class="row"><span>Tax (${input.taxPct}%)</span><span>${formatPkr(input.tax)}</span></div>
    ${delivery > 0 ? `<div class="row"><span>Delivery</span><span>${formatPkr(delivery)}</span></div>` : ""}
    <div class="row grand"><span>Total</span><span>${formatPkr(input.total)}</span></div>
  </div>
  <div class="timestamp">${escapeHtml(printedAt)} · ${escapeHtml(input.branchCode)}</div>
  <div class="footer">Thank you — visit again</div>
</body>
</html>`;
  return printBillHtml(html, {
    branchCode: input.branchCode,
    orderId: input.orderRef,
  });
}

/** Print kitchen / dine-in / delivery order ticket (KOT). */
export async function printKitchenOrder(
  branchName: string,
  branchCode: string,
  ticket: KitchenTicket,
  _menuItems?: MenuItem[],
): Promise<boolean> {
  const lines = linesFromTicket(ticket);
  const notes = ticket.notes?.trim() || extractKitchenNotes(ticket) || null;
  const html = buildKotHtml({
    branchName,
    branchCode,
    orderRef: orderRefFromTicket(ticket),
    ticketRef: ticket.ticketRef,
    stationLabel: ticket.stationLabel,
    waiterName: ticket.createdByName,
    notes,
    priority: ticket.priority,
    lines,
  });
  return printKitchenHtml(html, {
    branchCode,
    orderId: orderRefFromTicket(ticket),
  });
}

/** Print current cart as an order ticket before/without a saved ticket id. */
export async function printCartOrder(input: {
  branchName: string;
  branchCode: string;
  orderRef: string;
  stationLabel: string;
  waiterName?: string | null;
  notes?: string | null;
  lines: PrintLine[];
  total?: number | null;
}): Promise<boolean> {
  const html = buildKotHtml({
    branchName: input.branchName,
    branchCode: input.branchCode,
    orderRef: input.orderRef,
    ticketRef: input.orderRef,
    stationLabel: input.stationLabel,
    waiterName: input.waiterName,
    notes: input.notes,
    lines: input.lines,
    total: input.total,
  });
  return printKitchenHtml(html, {
    branchCode: input.branchCode,
    orderId: input.orderRef,
  });
}
