import type { StoreSale } from "@platform/contracts";
import { formatPkr } from "../hooks/useStore";

export function printStoreInvoice(branchName: string, branchCode: string, sale: StoreSale): void {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;

  const lines = sale.lines
    .map(
      (l) =>
        `<tr><td>${l.productName}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${formatPkr(l.unitPrice)}</td><td style="text-align:right">${formatPkr(l.lineTotal)}</td></tr>`,
    )
    .join("");

  win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${sale.invoiceNumber}</title>
<style>body{font-family:monospace;font-size:12px;padding:16px;max-width:320px;margin:0 auto}
h1{font-size:16px;text-align:center;margin:0}table{width:100%;border-collapse:collapse;margin:12px 0}
td{padding:2px 0}.total{font-weight:bold;border-top:1px dashed #000;padding-top:8px}
.center{text-align:center}.muted{color:#666;font-size:10px}</style></head><body>
<h1>${branchName}</h1>
<p class="center muted">${branchCode} · ${new Date(sale.createdAt).toLocaleString()}</p>
<p><strong>Invoice:</strong> ${sale.invoiceNumber}</p>
${sale.customerName ? `<p><strong>Customer:</strong> ${sale.customerName}</p>` : ""}
<table>${lines}</table>
<p>Subtotal: ${formatPkr(sale.subtotal)}</p>
<p>Tax: ${formatPkr(sale.tax)}</p>
${sale.discount > 0 ? `<p>Discount: -${formatPkr(sale.discount)}</p>` : ""}
<p class="total">Total: ${formatPkr(sale.total)}</p>
<p>Payment: ${sale.paymentMethod}${sale.isCredit ? " (Credit)" : ""}</p>
<p class="center muted">Thank you for shopping!</p>
<script>window.print();</script></body></html>`);
  win.document.close();
}
