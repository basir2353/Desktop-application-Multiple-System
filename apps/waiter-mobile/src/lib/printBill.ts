import type { Bill, BillPayment, KitchenTicket, MenuItem } from "@platform/contracts";
import { PAYMENT_METHOD_LABELS } from "@platform/contracts";
import * as Print from "expo-print";
import { Alert } from "react-native";
import { extractKitchenNotes } from "./loadOrder";
import {
  loadMobilePrinterSettings,
} from "./mobilePrinterSettings";
import { formatPkr, orderRefFromTicket } from "./orderDisplay";
import { parseDeliveryFieldsFromNotes, resolveTicketDeliveryNotes } from "./orderMode";
import { trySilentBranchPrint } from "./branchPrintClient";
import { createPrintDedupeGate, mobilePrintDedupeKey } from "./printDedupe";
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

/** Structured receipt payload — desktop rebuilds with EXE `buildTicketHtml` (same design). */
type MobileReceiptTicket = {
  branchName?: string;
  modeLabel?: string;
  tableLabel?: string;
  waiterName?: string;
  notes?: string;
  billRef?: string;
  orderRef?: string;
  lines?: Array<{
    label: string;
    qty: number;
    unitPrice?: number;
    menuItemId?: string;
    categoryId?: string;
  }>;
  subtotal?: number;
  discount?: number;
  service?: number;
  tax?: number;
  deliveryCharge?: number;
  total?: number;
  servicePct?: number;
  taxPct?: number;
  discountPct?: number;
  payments?: BillPayment[];
  /** When true, desktop/KOT rebuild shows UPDATE REVISED. */
  isOrderUpdate?: boolean;
  /** Serializable PRA fields (desktop regenerates QR/logo). */
  praFiscal?: {
    mode: PraReceiptFooter["mode"];
    invoiceNumber: string;
    orderRef: string;
    qrPayload: string;
  } | null;
};

function receiptTicketFromBill(
  branchName: string,
  bill: Bill,
  pra?: PraReceiptFooter | null,
): MobileReceiptTicket {
  const discount = Math.max(0, Number(bill.discount) || 0);
  const subtotal = Math.max(0, Number(bill.subtotal) || 0);
  const payments = (bill.payments ?? []).filter((p) => p.amount > 0);
  return {
    branchName,
    modeLabel: bill.tableLabel,
    tableLabel: bill.tableLabel,
    waiterName: bill.waiterName?.trim() || undefined,
    notes: bill.notes?.trim() || undefined,
    billRef: bill.billRef,
    orderRef: bill.orderRef ?? bill.billRef,
    lines: (bill.lines ?? []).map((l) => ({
      label: l.label,
      qty: l.qty,
      unitPrice: l.unitPrice,
    })),
    subtotal,
    discount,
    service: bill.service,
    tax: bill.tax,
    deliveryCharge: bill.deliveryChargePkr,
    total: bill.total,
    servicePct: bill.servicePct,
    taxPct: bill.taxPct,
    discountPct: subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0,
    payments: payments.length ? payments : undefined,
    praFiscal: pra?.invoiceNumber
      ? {
          mode: pra.mode,
          invoiceNumber: pra.invoiceNumber,
          orderRef: pra.orderRef,
          // EXE rebuild requires non-empty qrPayload; fall back to invoice #.
          qrPayload: (pra.qrPayload?.trim() || pra.invoiceNumber).trim(),
        }
      : null,
  };
}

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
  ${isUpdate ? `<div class="kot-update-banner">*** UPDATE REVISED ***</div>` : ""}
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
    <div class="kot-banner">${isUpdate ? "Kitchen copy — UPDATE REVISED" : "Kitchen copy — order"}</div>
  </div>
</body>
</html>`;
}

function buildReceiptHtml(
  branchName: string,
  branchCode: string,
  bill: Bill,
  pra?: PraReceiptFooter | null,
  opts?: { isOrderUpdate?: boolean },
): string {
  const isUpdate = Boolean(opts?.isOrderUpdate);
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

  const contact = parseDeliveryFieldsFromNotes(bill.notes);
  const riderLabel = bill.riderName?.trim() || contact.riderName;
  const metaRows = [
    pra?.invoiceNumber
      ? `<div class="meta-row meta-row-strong meta-pra-invoice"><span class="meta-label">PRA Invoice #</span><span class="meta-value">${escapeHtml(pra.invoiceNumber)}</span></div>`
      : "",
    `<div class="meta-row meta-row-strong"><span class="meta-label">Order</span><span class="meta-value">${escapeHtml(bill.orderRef ?? bill.billRef)}</span></div>`,
    `<div class="meta-row meta-row-strong"><span class="meta-label">Type</span><span class="meta-value">${escapeHtml(bill.tableLabel)}</span></div>`,
    `<div class="meta-row"><span class="meta-label">Bill</span><span class="meta-value">${escapeHtml(bill.billRef)}</span></div>`,
    bill.waiterName
      ? `<div class="meta-row"><span class="meta-label">Cashier</span><span class="meta-value">${escapeHtml(bill.waiterName)}</span></div>`
      : "",
    contact.customer
      ? `<div class="meta-row meta-row-strong"><span class="meta-label">Customer</span><span class="meta-value">${escapeHtml(contact.customer)}</span></div>`
      : "",
    contact.phone
      ? `<div class="meta-row meta-row-strong"><span class="meta-label">Phone</span><span class="meta-value">${escapeHtml(contact.phone)}</span></div>`
      : "",
    contact.address
      ? `<div class="meta-row meta-row-strong"><span class="meta-label">Address</span><span class="meta-value">${escapeHtml(contact.address)}</span></div>`
      : "",
    riderLabel
      ? `<div class="meta-row meta-row-strong"><span class="meta-label">Rider</span><span class="meta-value">${escapeHtml(riderLabel)}</span></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const packedDelivery = Boolean(
    contact.customer || contact.phone || contact.address || riderLabel,
  );
  const rawNotes = bill.notes?.trim() ?? "";
  const cleanedNotes = rawNotes
    .split(" · ")
    .map((p) => p.trim())
    .filter((p) => p && !/^Disc(?:Pct|Rs):\d+$/i.test(p) && !/^CashRecv:\d+$/i.test(p))
    .join(" · ")
    .trim();
  const displayNotes =
    cleanedNotes && !(packedDelivery && /^Delivery\s*·/i.test(cleanedNotes))
      ? cleanedNotes
      : "";

  const praFooter = pra ? buildPraReceiptFooterHtml(pra) : "";
  const discount = Math.max(0, Number(bill.discount) || 0);
  const payments = (bill.payments ?? []).filter((p) => p.amount > 0);
  const paymentRows = payments
    .map((p) => {
      const label = PAYMENT_METHOD_LABELS[p.method] ?? p.method;
      return `<div class="row"><span>${escapeHtml(label)}</span><span>${formatPkr(p.amount)}</span></div>`;
    })
    .join("");
  let cashReceived = 0;
  for (const part of rawNotes.split(" · ").map((p) => p.trim())) {
    const m = part.match(/^CashRecv:(\d+)$/i);
    if (m) cashReceived = Math.max(0, Number(m[1]) || 0);
  }
  const changeDue = cashReceived > bill.total ? cashReceived - bill.total : 0;
  const changeRows =
    changeDue > 0
      ? `<div class="row"><span>Cash Received</span><span>${formatPkr(cashReceived)}</span></div>
         <div class="row grand"><span>Change Due</span><span>${formatPkr(changeDue)}</span></div>`
      : "";
  const paymentBlock =
    payments.length > 0
      ? `<div class="pay-settled"><div class="pay-settled-title">Payment</div>${paymentRows}${changeRows}</div>`
      : "";

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
    .pay-settled { margin-top: 10px; border-top: 1px dashed #000; padding-top: 8px; }
    .pay-settled-title { font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
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
    .receipt-update-banner {
      text-align: center;
      font-weight: 800;
      letter-spacing: 0.06em;
      border: 2px solid #000;
      padding: 6px 4px;
      margin: 6px 0 8px;
    }
    ${PRA_RECEIPT_FOOTER_CSS}
  </style>
</head>
<body class="ticket-receipt">
  <div class="branch-name">${escapeHtml(branchName)}</div>
  <div class="doc-type">${isUpdate ? "Customer Receipt — UPDATE REVISED" : "Customer Receipt"}</div>
  ${isUpdate ? `<div class="receipt-update-banner">*** UPDATE REVISED ***</div>` : ""}
  <div class="meta-block">${metaRows}</div>
  ${displayNotes ? `<p class="notes" style="text-align:center;font-style:italic;margin:0 0 8px">${escapeHtml(displayNotes)}</p>` : ""}
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
    ${discount > 0 ? `<div class="row"><span>Discount</span><span>${formatPkr(discount)}</span></div>` : ""}
    <div class="row"><span>Service (${bill.servicePct}%)</span><span>${formatPkr(bill.service)}</span></div>
    <div class="row"><span>${pra ? `Sales Tax (${bill.taxPct}%)` : `Tax (${bill.taxPct}%)`}</span><span>${formatPkr(bill.tax)}</span></div>
    ${bill.deliveryChargePkr > 0 ? `<div class="row"><span>Delivery</span><span>${formatPkr(bill.deliveryChargePkr)}</span></div>` : ""}
    <div class="row grand"><span>Total</span><span>${formatPkr(bill.total)}</span></div>
  </div>
  ${paymentBlock}
  <div class="timestamp">${escapeHtml(printedAt)} · ${escapeHtml(branchCode)}</div>
  ${bill.status === "held" ? '<div class="held">*** ON HOLD — NOT PAID ***</div>' : '<div class="footer">Thank you — visit again</div>'}
  ${praFooter}
</body>
</html>`;
}

/** Sync lock + window so one tap cannot enqueue many EXE print jobs. */
const printDedupeGate = createPrintDedupeGate();

async function printHtml(
  html: string,
  hint?: string,
  opts?: {
    branchCode?: string;
    kind?: "receipt" | "kot";
    /** Soft profile/label hint for desktop routing — never treated as Windows spooler name. */
    printerName?: string | null;
    orderId?: string | null;
    sectionId?: string | null;
    ticket?: MobileReceiptTicket & { isOrderUpdate?: boolean };
  },
): Promise<boolean> {
  const dedupeKey = mobilePrintDedupeKey(opts ?? {});
  const early = printDedupeGate.begin(dedupeKey);
  if (early === true) return true;
  if (early) return early;

  const run = async (): Promise<boolean> => {
    if (opts?.branchCode) {
      const { loadMobilePrinterSettings } = await import("./mobilePrinterSettings");
      const settings = await loadMobilePrinterSettings();
      if (!settings.autoPrint) return false;

      let userId: string | null = null;
      try {
        const { useSessionStore } = await import("../stores/sessionStore");
        userId = useSessionStore.getState().claims?.sub ?? null;
      } catch {
        userId = null;
      }

      // Never send mobile display labels as systemPrinterName — that caused XPS/PDF picks on Windows.
      const silent = await trySilentBranchPrint({
        branchCode: opts.branchCode,
        printerName: opts.printerName ?? null,
        orderId: opts.orderId ?? null,
        userId,
        payload: {
          kind: opts.kind ?? "receipt",
          html,
          systemPrinterName: null,
          copies: 1,
          orderRef: opts.orderId ?? null,
          sectionId: opts.sectionId ?? null,
          meta: {
            userId,
            ticket: opts.ticket ?? null,
            source: "waiter-mobile",
          },
        },
      });
      if (silent) {
        printDedupeGate.markDone(dedupeKey);
        return true;
      }

      // Branch print always goes via EXE (Live/IP/Server). Never Expo/phone dialog.
      return false;
    }

    // Expo dialog only for local debug prints that are not tied to a branch.
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
      printDedupeGate.markDone(dedupeKey);
      return true;
    } catch {
      return false;
    }
  };

  return printDedupeGate.track(dedupeKey, run());
}

async function printKitchenHtml(
  html: string,
  opts?: {
    branchCode?: string;
    orderId?: string | null;
    sectionId?: string | null;
    ticket?: {
      branchName?: string;
      modeLabel?: string;
      tableLabel?: string;
      waiterName?: string;
      notes?: string;
      isOrderUpdate?: boolean;
      orderRef?: string;
      lines?: Array<{
        label: string;
        qty: number;
        unitPrice?: number;
        menuItemId?: string;
        categoryId?: string;
      }>;
      total?: number;
    };
  },
): Promise<boolean> {
  // Never send soft labels like "Kitchen 1" — EXE routes like cashier via Assign Users + sections.
  return printHtml(html, undefined, {
    branchCode: opts?.branchCode,
    kind: "kot",
    printerName: null,
    orderId: opts?.orderId ?? null,
    sectionId: opts?.sectionId ?? null,
    ticket: opts?.ticket,
  });
}

async function printBillHtml(
  html: string,
  opts?: {
    branchCode?: string;
    orderId?: string | null;
    ticket?: MobileReceiptTicket;
  },
): Promise<boolean> {
  // Do not send mobile soft labels (e.g. "Cashier / Billing") — desktop routes the bill
  // solely to this logged-in user's assigned receipt/counter printer in POS settings.
  return printHtml(html, undefined, {
    branchCode: opts?.branchCode,
    kind: "receipt",
    printerName: null,
    orderId: opts?.orderId ?? null,
    ticket: opts?.ticket,
  });
}

/**
 * Print customer pay receipt.
 * - `embedPra: false` → simple slip (desktop Print) — never auto-issue PRA
 * - `embedPra: true` → issue/embed FPRA or Real PRA when tax is Active (desktop Close / RPRA)
 */
export async function printBillReceipt(
  branchName: string,
  branchCode: string,
  bill: Bill,
  options?: { embedPra?: boolean; isOrderUpdate?: boolean },
): Promise<boolean> {
  const embedPra = Boolean(options?.embedPra);
  const isOrderUpdate = Boolean(options?.isOrderUpdate);
  const pra = embedPra
    ? await resolvePraFooterForBillPrint({
        branchCode,
        bill,
        issueIfMissing: true,
      }).catch(() => null)
    : null;
  return printBillHtml(buildReceiptHtml(branchName, branchCode, bill, pra, { isOrderUpdate }), {
    branchCode,
    orderId: bill.billRef,
    ticket: {
      ...receiptTicketFromBill(branchName, bill, pra),
      isOrderUpdate,
    },
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
  discount?: number;
  discountPct?: number;
  cashTaxPct?: number;
  cardTaxPct?: number;
  cashTax?: number;
  cardTax?: number;
  cashTotal?: number;
  cardTotal?: number;
  isOrderUpdate?: boolean;
}): Promise<boolean> {
  const isUpdate = Boolean(input.isOrderUpdate);
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
  const discount = Math.max(0, Number(input.discount) || 0);
  const discountPct =
    input.discountPct ??
    (input.subtotal > 0 && discount > 0 ? Math.round((discount / input.subtotal) * 100) : 0);
  const afterDisc = Math.max(0, input.subtotal - discount);
  const cashTaxPct = input.cashTaxPct ?? input.taxPct;
  const cardTaxPct = input.cardTaxPct ?? (cashTaxPct >= 15 ? 8 : cashTaxPct);
  const serviceAmt = Math.round(afterDisc * (input.servicePct / 100));
  const cashTax = input.cashTax ?? Math.round((afterDisc * cashTaxPct) / 100);
  const cardTax = input.cardTax ?? Math.round((afterDisc * cardTaxPct) / 100);
  const cashTotal = input.cashTotal ?? afterDisc + serviceAmt + cashTax + delivery;
  const cardTotal = input.cardTotal ?? afterDisc + serviceAmt + cardTax + delivery;
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
    .receipt-update-banner {
      text-align: center; font-weight: 800; letter-spacing: 0.06em;
      border: 2px solid #000; padding: 6px 4px; margin: 6px 0 8px;
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
    .pay-compare { display: flex; gap: 6px; margin-top: 10px; border-top: 1px dashed #000; padding-top: 8px; }
    .pay-compare-col { flex: 1; min-width: 0; }
    .pay-compare-title { font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; }
    .timestamp { text-align: center; font-size: 11px; margin: 10px 0 6px; }
    .footer { text-align: center; margin-top: 10px; font-weight: 700; }
  </style>
</head>
<body class="ticket-receipt">
  <div class="branch-name">${escapeHtml(input.branchName)}</div>
  <div class="doc-type">${isUpdate ? "Customer Receipt — UPDATE REVISED" : "Customer Receipt"}</div>
  ${isUpdate ? `<div class="receipt-update-banner">*** UPDATE REVISED ***</div>` : ""}
  <div class="meta-block">
    <div class="meta-row meta-row-strong"><span class="meta-label">Order</span><span class="meta-value">${escapeHtml(input.orderRef)}</span></div>
    <div class="meta-row meta-row-strong"><span class="meta-label">Type</span><span class="meta-value">${escapeHtml(input.tableLabel)}</span></div>
    ${input.waiterName ? `<div class="meta-row"><span class="meta-label">Cashier</span><span class="meta-value">${escapeHtml(input.waiterName)}</span></div>` : ""}
  </div>
  <table class="items">
    <thead><tr><th class="qty">QTY</th><th class="item">ITEM</th><th class="amt">AMOUNT</th></tr></thead>
    <tbody>${lineRows || `<tr><td class="qty">—</td><td class="item-name">No items</td><td class="amt">—</td></tr>`}</tbody>
  </table>
  <div class="pay-compare">
    <div class="pay-compare-col">
      <div class="pay-compare-title">On Card Payment</div>
      <div class="row"><span>Sub Total</span><span>${formatPkr(input.subtotal)}</span></div>
      ${discount > 0 ? `<div class="row"><span>Discount${discountPct > 0 ? ` (${discountPct}%)` : ""}</span><span>${formatPkr(discount)}</span></div>` : ""}
      ${serviceAmt > 0 ? `<div class="row"><span>Service (${input.servicePct}%)</span><span>${formatPkr(serviceAmt)}</span></div>` : ""}
      ${delivery > 0 ? `<div class="row"><span>Delivery</span><span>${formatPkr(delivery)}</span></div>` : ""}
      <div class="row"><span>GST (${cardTaxPct}%)</span><span>${formatPkr(cardTax)}</span></div>
      <div class="row grand"><span>Net Total</span><span>${formatPkr(cardTotal)}</span></div>
    </div>
    <div class="pay-compare-col">
      <div class="pay-compare-title">On Cash Payment</div>
      <div class="row"><span>Sub Total</span><span>${formatPkr(input.subtotal)}</span></div>
      ${discount > 0 ? `<div class="row"><span>Discount${discountPct > 0 ? ` (${discountPct}%)` : ""}</span><span>${formatPkr(discount)}</span></div>` : ""}
      ${serviceAmt > 0 ? `<div class="row"><span>Service (${input.servicePct}%)</span><span>${formatPkr(serviceAmt)}</span></div>` : ""}
      ${delivery > 0 ? `<div class="row"><span>Delivery</span><span>${formatPkr(delivery)}</span></div>` : ""}
      <div class="row"><span>GST (${cashTaxPct}%)</span><span>${formatPkr(cashTax)}</span></div>
      <div class="row grand"><span>Net Total</span><span>${formatPkr(cashTotal)}</span></div>
    </div>
  </div>
  <div class="timestamp">${escapeHtml(printedAt)} · ${escapeHtml(input.branchCode)}</div>
  <div class="footer">Thank you — visit again</div>
</body>
</html>`;
  return printBillHtml(html, {
    branchCode: input.branchCode,
    orderId: input.orderRef,
    ticket: {
      branchName: input.branchName,
      modeLabel: input.tableLabel,
      tableLabel: input.tableLabel,
      waiterName: input.waiterName ?? undefined,
      orderRef: input.orderRef,
      lines: input.lines,
      subtotal: input.subtotal,
      service: input.service,
      tax: input.tax,
      deliveryCharge: delivery,
      total: input.total,
      servicePct: input.servicePct,
      taxPct: input.taxPct,
      discount,
      discountPct,
      isOrderUpdate: isUpdate,
    },
  });
}

/** Print kitchen / dine-in / delivery order ticket (KOT). */
export async function printKitchenOrder(
  branchName: string,
  branchCode: string,
  ticket: KitchenTicket,
  menuItems?: MenuItem[],
  opts?: {
    isOrderUpdate?: boolean;
    /** When set (UPDATE REVISED), print only these changed lines. */
    linesOverride?: Array<{
      label: string;
      qty: number;
      unitPrice?: number;
      menuItemId?: string;
      categoryId?: string;
    }>;
  },
): Promise<boolean> {
  const ticketLines = opts?.linesOverride?.length
    ? opts.linesOverride
    : ticket.lines ?? [];
  const lines = (
    opts?.linesOverride?.length
      ? opts.linesOverride.map((line) => ({
          label: line.label,
          qty: line.qty,
          unitPrice: line.unitPrice ?? 0,
          menuItemId: line.menuItemId,
          categoryId: line.categoryId,
        }))
      : linesFromTicket(ticket).map((line, index) => {
          const fromTicket =
            ticketLines[index] ??
            ticketLines.find((l) => l.label === line.label && l.qty === line.qty);
          const menuItemId = fromTicket?.menuItemId?.trim() || undefined;
          const menu =
            (menuItemId ? menuItems?.find((m) => m.id === menuItemId) : undefined) ??
            menuItems?.find(
              (m) => m.name.trim().toLowerCase() === line.label.trim().toLowerCase(),
            );
          return {
            ...line,
            menuItemId: menuItemId ?? menu?.id,
            categoryId: menu?.categoryId,
            unitPrice: line.unitPrice ?? fromTicket?.unitPrice ?? menu?.price ?? 0,
          };
        })
  );
  const notes =
    resolveTicketDeliveryNotes(ticket) ||
    ticket.notes?.trim() ||
    extractKitchenNotes(ticket) ||
    null;
  const orderRef = orderRefFromTicket(ticket);
  const html = buildKotHtml({
    branchName,
    branchCode,
    orderRef,
    ticketRef: ticket.ticketRef,
    stationLabel: ticket.stationLabel,
    waiterName: ticket.createdByName,
    notes,
    priority: ticket.priority,
    lines,
    isOrderUpdate: opts?.isOrderUpdate,
  });
  return printKitchenHtml(html, {
    branchCode,
    orderId: orderRef,
    ticket: {
      branchName,
      modeLabel: ticket.stationLabel,
      tableLabel: ticket.stationLabel,
      waiterName: ticket.createdByName ?? undefined,
      notes: notes ?? undefined,
      isOrderUpdate: opts?.isOrderUpdate,
      orderRef,
      lines,
    },
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
  lines: Array<PrintLine & { menuItemId?: string; categoryId?: string }>;
  total?: number | null;
  isOrderUpdate?: boolean;
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
    isOrderUpdate: input.isOrderUpdate,
  });
  return printKitchenHtml(html, {
    branchCode: input.branchCode,
    orderId: input.orderRef,
    ticket: {
      branchName: input.branchName,
      modeLabel: input.stationLabel,
      tableLabel: input.stationLabel,
      waiterName: input.waiterName ?? undefined,
      notes: input.notes ?? undefined,
      isOrderUpdate: input.isOrderUpdate,
      orderRef: input.orderRef,
      lines: input.lines,
      total: input.total ?? undefined,
    },
  });
}
