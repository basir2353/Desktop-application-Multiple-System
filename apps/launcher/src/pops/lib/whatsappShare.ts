import type { Bill } from "@platform/contracts";
import { billChannelLabel } from "./orderSales";

function formatMoney(pkr: number): string {
  return `Rs ${pkr.toLocaleString("en-PK")}`;
}

/** Build a WhatsApp-friendly invoice text and open wa.me share link. */
export function shareBillViaWhatsApp(bill: Bill, branchName: string, phone?: string): boolean {
  const lines = [
    `*${branchName}*`,
    `Invoice: ${bill.billRef}`,
    `Order: ${bill.orderRef ?? bill.billRef}`,
    `Type: ${billChannelLabel(bill.tableLabel)}`,
    bill.tableLabel ? `Table: ${bill.tableLabel}` : null,
    "",
    "*Items*",
    ...bill.lines.map((l) => `• ${l.label} × ${l.qty} — ${formatMoney(l.unitPrice * l.qty)}`),
    "",
    `Subtotal: ${formatMoney(bill.subtotal)}`,
    bill.discount > 0 ? `Discount: −${formatMoney(bill.discount)}` : null,
    `Service: ${formatMoney(bill.service)}`,
    bill.tax > 0 ? `Tax: ${formatMoney(bill.tax)}` : null,
    `*Total: ${formatMoney(bill.total)}*`,
    "",
    "Thank you for dining with us!",
  ].filter((line): line is string => line != null);

  const text = encodeURIComponent(lines.join("\n"));
  const digits = phone?.replace(/\D/g, "") ?? "";
  const url = digits
    ? `https://wa.me/${digits}?text=${text}`
    : `https://wa.me/?text=${text}`;

  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}

/** Extract phone from delivery notes on a bill. */
export function phoneFromBillNotes(notes: string | null | undefined): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(/(?:\+?92|0)?3\d{9}/);
  return match?.[0];
}
