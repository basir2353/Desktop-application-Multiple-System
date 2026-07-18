import type { Bill, KitchenTicket, MenuItem } from "@platform/contracts";
import * as Print from "expo-print";
import { extractKitchenNotes } from "./loadOrder";
import { formatPkr, orderRefFromTicket } from "./orderDisplay";
import { kitchenTicketTotal } from "./orderHistory";

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
}): string {
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const totalQty = input.lines.reduce((sum, line) => sum + line.qty, 0);
  const lineRows = input.lines
    .map(
      (line) => `<tr>
        <td class="item">${escapeHtml(line.label)}</td>
        <td class="qty">${line.qty}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      color: #111;
      margin: 0 auto;
      padding: 16px 14px 20px;
      max-width: 80mm;
    }
    .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .doc { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #444; }
    .meta { text-align: center; margin: 10px 0 14px; font-size: 12px; line-height: 1.45; }
    .meta strong { font-size: 15px; }
    .badge {
      display: inline-block;
      margin-top: 6px;
      padding: 2px 8px;
      border: 1px solid #111;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 1px solid #111; padding: 4px 2px; }
    th.qty, td.qty { text-align: center; width: 40px; }
    td { padding: 8px 2px; border-bottom: 1px solid #ddd; vertical-align: top; }
    td.item { font-weight: 600; font-size: 14px; }
    td.qty { font-weight: 700; font-size: 16px; }
    .notes {
      border: 1px dashed #111;
      padding: 8px;
      margin: 10px 0;
      font-size: 12px;
    }
    .footer { text-align: center; margin-top: 14px; font-size: 11px; color: #555; }
    .total { text-align: right; font-weight: 700; font-size: 14px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(input.branchName)}</h1>
    <div class="doc">Kitchen Order</div>
    <div style="font-size:11px;color:#666;margin-top:4px">${escapeHtml(input.branchCode)}</div>
  </div>
  <div class="meta">
    <div><strong>${escapeHtml(input.orderRef)}</strong></div>
    <div>${escapeHtml(input.stationLabel)}</div>
    <div>${escapeHtml(input.ticketRef)}${input.waiterName ? ` · ${escapeHtml(input.waiterName)}` : ""}</div>
    <div>${escapeHtml(printedAt)}</div>
    ${input.priority === "priority" ? '<div class="badge">Priority</div>' : ""}
  </div>
  <table>
    <thead><tr><th>Item</th><th class="qty">Qty</th></tr></thead>
    <tbody>${lineRows || `<tr><td colspan="2">No items</td></tr>`}</tbody>
  </table>
  <div style="font-size:12px;color:#444">${input.lines.length} item${input.lines.length === 1 ? "" : "s"} · Qty ${totalQty}</div>
  ${
    input.notes?.trim()
      ? `<div class="notes"><strong>Notes</strong><br/>${escapeHtml(input.notes.trim())}</div>`
      : ""
  }
  ${input.total != null && input.total > 0 ? `<div class="total">Est. total ${formatPkr(input.total)}</div>` : ""}
  <div class="footer">*** ORDER TICKET ***</div>
</body>
</html>`;
}

function buildReceiptHtml(branchName: string, branchCode: string, bill: Bill): string {
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const lineRows = bill.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.label)}</td>
        <td style="text-align:center">${line.qty}</td>
        <td style="text-align:right">${formatPkr(line.unitPrice * line.qty)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 16px; }
    h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
    .meta { text-align: center; color: #555; margin-bottom: 12px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { padding: 4px 2px; border-bottom: 1px solid #ddd; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #666; }
    .totals { margin-top: 8px; }
    .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
    .total { font-weight: 700; font-size: 14px; border-top: 2px solid #111; margin-top: 6px; padding-top: 6px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(branchName)}</h1>
  <div class="meta">${escapeHtml(branchCode)} · ${escapeHtml(bill.billRef)}<br/>${escapeHtml(bill.tableLabel)} · ${escapeHtml(bill.waiterName)}<br/>${printedAt}</div>
  <table>
    <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${lineRows}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${formatPkr(bill.subtotal)}</span></div>
    <div><span>Service (${bill.servicePct}%)</span><span>${formatPkr(bill.service)}</span></div>
    <div><span>Tax (${bill.taxPct}%)</span><span>${formatPkr(bill.tax)}</span></div>
    ${bill.deliveryChargePkr > 0 ? `<div><span>Delivery</span><span>${formatPkr(bill.deliveryChargePkr)}</span></div>` : ""}
    <div class="total"><span>Total</span><span>${formatPkr(bill.total)}</span></div>
  </div>
  ${bill.status === "held" ? '<p style="text-align:center;margin-top:16px;font-weight:600">*** ON HOLD — NOT PAID ***</p>' : ""}
</body>
</html>`;
}

async function printHtml(html: string): Promise<boolean> {
  try {
    await Print.printAsync({ html });
    return true;
  } catch {
    return false;
  }
}

export async function printBillReceipt(
  branchName: string,
  branchCode: string,
  bill: Bill,
): Promise<boolean> {
  return printHtml(buildReceiptHtml(branchName, branchCode, bill));
}

/** Print kitchen / dine-in / delivery order ticket (KOT). */
export async function printKitchenOrder(
  branchName: string,
  branchCode: string,
  ticket: KitchenTicket,
  menuItems?: MenuItem[],
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
    total: kitchenTicketTotal(ticket, menuItems),
  });
  return printHtml(html);
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
  return printHtml(html);
}
