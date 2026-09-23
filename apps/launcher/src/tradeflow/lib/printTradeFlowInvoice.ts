import type { TradeFlowInvoice, TradeFlowPurchase } from "@platform/contracts";
import { logPrintEvent } from "../../pops/lib/printHistory";
import { printHtmlDocumentDetailed } from "../../pops/lib/printTicket";
import {
  ensureReceiptPrinterLinked,
  resolveTradeFlowPrinter,
} from "../../pops/lib/printerRouting";
import { useSessionStore } from "../../stores/sessionStore";

export type TradeFlowPrintSize = "a4" | "a5" | "thermal";

function money(n: number): string {
  return `Rs ${n.toLocaleString()}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paperWidthMm(size: TradeFlowPrintSize): number {
  if (size === "thermal") return 80;
  if (size === "a5") return 148;
  return 210;
}

function pageCss(size: TradeFlowPrintSize): string {
  if (size === "thermal") return "80mm auto";
  if (size === "a5") return "A5";
  return "A4";
}

export function buildTradeFlowInvoiceHtml(invoice: TradeFlowInvoice, size: TradeFlowPrintSize): string {
  const width = size === "thermal" ? "80mm" : size === "a5" ? "148mm" : "210mm";
  const title = size === "thermal" ? "12px" : "18px";
  const page = pageCss(size);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNo)}</title>
  <style>
    @page { size: ${page}; margin: ${size === "thermal" ? "2mm" : "10mm"}; }
    body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 16px; width: ${width}; }
    h1 { font-size: ${title}; margin: 0 0 4px; }
    .muted { color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; }
    th { text-transform: uppercase; font-size: 10px; color: #666; }
    .right { text-align: right; }
    .total { font-weight: 700; font-size: 14px; }
  </style>
</head>
<body>
  <h1>MaterialFlow Invoice</h1>
  <div class="muted">${escapeHtml(invoice.invoiceNo)} · ${escapeHtml(new Date(invoice.createdAt).toLocaleString())}</div>
  <div class="muted">Party: ${escapeHtml(invoice.customerName)} · Mode: ${escapeHtml(invoice.paymentMode.toUpperCase())}${invoice.dueDate ? ` · Due ${escapeHtml(invoice.dueDate)}` : ""}</div>
  ${invoice.salesPersonName ? `<div class="muted">Sales person: ${escapeHtml(invoice.salesPersonName)}</div>` : ""}
  <table>
    <thead>
      <tr><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Disc</th><th class="right">Amount</th></tr>
    </thead>
    <tbody>
      ${invoice.lines
        .map(
          (l) =>
            `<tr><td>${escapeHtml(l.itemName)}${l.bookingQty > 0 ? ` <span class="muted">(booking ${l.bookingQty}, rem ${l.bookingRemainingAfter ?? 0})</span>` : ""}</td><td class="right">${l.qty} ${escapeHtml(l.unit)}</td><td class="right">${money(l.ratePkr)}</td><td class="right">${money(l.discountPkr)}</td><td class="right">${money(l.lineTotalPkr)}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <p class="right">Subtotal ${money(invoice.subtotalPkr)}</p>
  <p class="right">Discount ${money(invoice.discountPkr)}</p>
  <p class="right total">Total ${money(invoice.totalPkr)}</p>
  <p class="right">Received ${money(invoice.receivedPkr)}</p>
  ${invoice.expensePkr > 0 ? `<p class="muted">Internal expenses ${money(invoice.expensePkr)}</p>` : ""}
  ${invoice.notes ? `<p class="muted">${escapeHtml(invoice.notes)}</p>` : ""}
</body>
</html>`;
}

export function buildTradeFlowPurchaseHtml(purchase: TradeFlowPurchase, size: TradeFlowPrintSize): string {
  const width = size === "thermal" ? "80mm" : size === "a5" ? "148mm" : "210mm";
  const title = size === "thermal" ? "12px" : "18px";
  const page = pageCss(size);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(purchase.invoiceNo)}</title>
  <style>
    @page { size: ${page}; margin: ${size === "thermal" ? "2mm" : "10mm"}; }
    body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 16px; width: ${width}; }
    h1 { font-size: ${title}; margin: 0 0 4px; }
    .muted { color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; }
    th { text-transform: uppercase; font-size: 10px; color: #666; }
    .right { text-align: right; }
    .total { font-weight: 700; font-size: 14px; }
  </style>
</head>
<body>
  <h1>MaterialFlow Purchase</h1>
  <div class="muted">${escapeHtml(purchase.invoiceNo)} · ${escapeHtml(new Date(purchase.createdAt).toLocaleString())}</div>
  <div class="muted">Supplier: ${escapeHtml(purchase.supplierName)}</div>
  <table>
    <thead>
      <tr><th>Item</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
    </thead>
    <tbody>
      ${purchase.lines
        .map((l) => `<tr><td>${escapeHtml(l.itemName)}</td><td class="right">${l.qty} ${escapeHtml(l.unit)}</td><td class="right">${money(l.ratePkr)}</td><td class="right">${money(l.lineTotalPkr)}</td></tr>`)
        .join("")}
    </tbody>
  </table>
  <p class="right total">Total ${money(purchase.totalPkr)}</p>
  <p class="right">Paid ${money(purchase.paidPkr)}</p>
  ${purchase.notes ? `<p class="muted">${escapeHtml(purchase.notes)}</p>` : ""}
</body>
</html>`;
}

export async function printTradeFlowInvoiceAsync(
  invoice: TradeFlowInvoice,
  size: TradeFlowPrintSize,
  branchCode?: string,
): Promise<boolean> {
  const html = buildTradeFlowInvoiceHtml(invoice, size);
  const userId = useSessionStore.getState().claims?.sub ?? null;
  if (branchCode) {
    await ensureReceiptPrinterLinked(branchCode, userId);
  }
  const profile = branchCode ? resolveTradeFlowPrinter(branchCode, size, userId) : null;
  const result = await printHtmlDocumentDetailed(html, {
    systemPrinterName: profile?.systemPrinterName,
    jobTitle: `${invoice.invoiceNo} ${size.toUpperCase()}`,
    paperWidthMm: paperWidthMm(size),
    copies: profile?.copies ?? 1,
    requireNamedPrinter: false,
  });
  if (branchCode) {
    logPrintEvent(branchCode, {
      kind: "receipt",
      printerName: profile?.systemPrinterName ?? profile?.name ?? `${size} dialog`,
      ok: result.ok,
    });
  }
  return result.ok;
}

export function printTradeFlowInvoice(
  invoice: TradeFlowInvoice,
  size: TradeFlowPrintSize,
  branchCode?: string,
): void {
  void printTradeFlowInvoiceAsync(invoice, size, branchCode);
}
