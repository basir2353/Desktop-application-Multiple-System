import type { PharmacySale } from "@platform/contracts";

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

export function printPharmacyInvoice(
  branchName: string,
  branchCode: string,
  sale: PharmacySale,
): boolean {
  const printedAt = new Date().toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
  const lineRows = sale.lines
    .map(
      (line) => `<tr>
        <td>${escapeHtml(line.medicineName)}</td>
        <td class="qty">${line.qty}</td>
        <td class="amt">${formatMoney(line.unitPrice)}</td>
        <td class="amt">${formatMoney(line.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><title>Invoice ${escapeHtml(sale.invoiceNumber)}</title>
    <style>
      body { font-family: system-ui, sans-serif; font-size: 12px; max-width: 320px; margin: 0 auto; padding: 12px; }
      h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
      .meta { text-align: center; color: #444; margin-bottom: 12px; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 4px 2px; text-align: left; border-bottom: 1px dashed #ccc; }
      .qty { text-align: center; width: 32px; }
      .amt { text-align: right; }
      .totals { margin-top: 10px; }
      .row { display: flex; justify-content: space-between; padding: 2px 0; }
      .grand { font-weight: bold; font-size: 14px; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
    </style></head><body>
    <h1>Pharmacy Tax Invoice</h1>
    <div class="meta">${escapeHtml(branchName)} (${escapeHtml(branchCode)})<br/>
    Invoice: ${escapeHtml(sale.invoiceNumber)}<br/>
    ${sale.patientName ? `Customer: ${escapeHtml(sale.patientName)}<br/>` : ""}
    Payment: ${escapeHtml(sale.paymentMethod)}<br/>
    ${printedAt}</div>
    <table><thead><tr><th>Item</th><th class="qty">Qty</th><th class="amt">Rate</th><th class="amt">Total</th></tr></thead>
    <tbody>${lineRows}</tbody></table>
    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${formatMoney(sale.subtotal)}</span></div>
      ${sale.tax > 0 ? `<div class="row"><span>Tax</span><span>${formatMoney(sale.tax)}</span></div>` : ""}
      ${sale.discount > 0 ? `<div class="row"><span>Discount</span><span>− ${formatMoney(sale.discount)}</span></div>` : ""}
      <div class="row grand"><span>Total</span><span>${formatMoney(sale.total)}</span></div>
    </div>
    <p style="text-align:center;margin-top:16px;font-size:10px;">Thank you — get well soon!</p>
    </body></html>`;

  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
