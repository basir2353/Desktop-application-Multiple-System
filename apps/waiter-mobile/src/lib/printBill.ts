import type { Bill } from "@platform/contracts";
import * as Print from "expo-print";
import { formatPkr } from "./orderDisplay";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export async function printBillReceipt(
  branchName: string,
  branchCode: string,
  bill: Bill,
): Promise<boolean> {
  try {
    const html = buildReceiptHtml(branchName, branchCode, bill);
    await Print.printAsync({ html });
    return true;
  } catch {
    return false;
  }
}
