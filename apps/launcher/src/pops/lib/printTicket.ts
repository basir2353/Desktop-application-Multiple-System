import type { Bill, KitchenTicket } from "@platform/contracts";
import { billChannelLabel } from "./orderSales";
import { parseItemsSummary, type PosRecentOrder } from "./recentOrders";

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

function buildTicketHtml(input: PrintTicketInput): string {
  const isReceipt = input.kind === "receipt";
  const title = isReceipt ? "Tax invoice" : "Kitchen order ticket";
  const printedAt = new Date().toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const lineRows = input.lines
    .map((line) => {
      const lineTotal = line.unitPrice * line.qty;
      if (!isReceipt) {
        return `<tr>
        <td>${escapeHtml(line.label)}</td>
        <td class="qty">${line.qty}</td>
      </tr>`;
      }
      return `<tr>
        <td>${escapeHtml(line.label)}</td>
        <td class="qty">${line.qty}</td>
        <td class="amt">${formatMoney(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const totalsBlock = isReceipt
    ? `<div class="totals">
        <div class="row"><span>Subtotal</span><span>${formatMoney(input.subtotal)}</span></div>
        ${input.discount > 0 ? `<div class="row"><span>Discount${input.discountPct > 0 ? ` (${input.discountPct}%)` : ""}</span><span>− ${formatMoney(input.discount)}</span></div>` : ""}
        <div class="row"><span>Service (${input.servicePct}%)</span><span>${formatMoney(input.service)}</span></div>
        <div class="row"><span>Tax (${input.taxPct ?? 15}%)</span><span>${formatMoney(input.tax)}</span></div>
        ${(input.deliveryCharge ?? 0) > 0 ? `<div class="row"><span>Delivery</span><span>${formatMoney(input.deliveryCharge!)}</span></div>` : ""}
        <div class="row grand"><span>Total</span><span>${formatMoney(input.total)}</span></div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — ${escapeHtml(input.orderRef)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 12px 10px;
      max-width: 80mm;
    }
    h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
    .meta { text-align: center; margin-bottom: 10px; font-size: 11px; }
    .meta p { margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { padding: 3px 0; vertical-align: top; }
    th { border-bottom: 1px dashed #000; text-align: left; font-size: 10px; }
    td.qty { width: 28px; text-align: center; }
    td.amt { text-align: right; white-space: nowrap; }
    .totals { border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .grand { font-weight: bold; font-size: 13px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #000; }
    .footer { margin-top: 12px; text-align: center; font-size: 10px; }
    @media print {
      body { padding: 0; }
      @page { margin: 4mm; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(input.branchName)}</h1>
  <div class="meta">
    <p><strong>${escapeHtml(title)}</strong></p>
    <p>${escapeHtml(input.orderRef)} · ${escapeHtml(input.modeLabel)} · ${escapeHtml(input.tableLabel ?? "—")}</p>
    ${input.notes ? `<p>${escapeHtml(input.notes)}</p>` : ""}
    ${input.billRef ? `<p>Bill ${escapeHtml(input.billRef)}</p>` : ""}
    ${input.waiterName ? `<p>Waiter: ${escapeHtml(input.waiterName)}</p>` : ""}
    <p>${escapeHtml(input.branchCode)} · ${escapeHtml(printedAt)}</p>
  </div>
  <table>
    <thead>
      <tr><th>Item</th><th class="qty">Qty</th>${isReceipt ? '<th class="amt">Amount</th>' : ""}</tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>
  ${totalsBlock}
  <div class="footer">${isReceipt ? "Thank you — visit again" : "*** KITCHEN COPY — ORDER ***"}</div>
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
): boolean {
  return printReceipt(billToPrintInput(branchName, branchCode, bill));
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
): boolean {
  if (order.kind === "paid" && order.bill) {
    return printBill(branchName, branchCode, order.bill);
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
