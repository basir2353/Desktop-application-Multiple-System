import type { Bill } from "@platform/contracts";
import QRCode from "qrcode";
import { billChannelLabel } from "./orderSales";

function formatMoney(pkr: number): string {
  return `Rs ${pkr.toLocaleString("en-PK")}`;
}

/** Build a WhatsApp-friendly invoice text and open wa.me share link. */
export function shareBillViaWhatsApp(
  bill: Bill,
  branchName: string,
  phone?: string,
  settings: WhatsAppShareSettings = DEFAULT_WHATSAPP_SHARE_SETTINGS,
): boolean {
  if (!settings.enabled) return false;
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
    settings.invoiceFooter.trim() || DEFAULT_WHATSAPP_SHARE_SETTINGS.invoiceFooter,
  ].filter((line): line is string => line != null);

  const text = encodeURIComponent(lines.join("\n"));
  const digits = normalizePakistaniPhone(phone || settings.branchPhone);
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

export type WhatsAppShareSettings = {
  enabled: boolean;
  branchPhone: string;
  invoiceFooter: string;
};

export const DEFAULT_WHATSAPP_SHARE_SETTINGS: WhatsAppShareSettings = {
  enabled: true,
  branchPhone: "",
  invoiceFooter: "Thank you for dining with us!",
};

const WHATSAPP_SETTINGS_KEY = "pops-whatsapp-share-settings-v1";

export function normalizePakistaniPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("0092")) return digits.slice(2);
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.startsWith("3") && digits.length === 10) return `92${digits}`;
  return digits;
}

export function loadWhatsAppShareSettings(branchCode?: string): WhatsAppShareSettings {
  if (!branchCode) return DEFAULT_WHATSAPP_SHARE_SETTINGS;
  try {
    const parsed = JSON.parse(localStorage.getItem(WHATSAPP_SETTINGS_KEY) ?? "{}") as Record<string, Partial<WhatsAppShareSettings>>;
    return { ...DEFAULT_WHATSAPP_SHARE_SETTINGS, ...(parsed[branchCode] ?? {}) };
  } catch {
    return DEFAULT_WHATSAPP_SHARE_SETTINGS;
  }
}

export function saveWhatsAppShareSettings(branchCode: string, settings: WhatsAppShareSettings): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(WHATSAPP_SETTINGS_KEY) ?? "{}") as Record<string, WhatsAppShareSettings>;
    parsed[branchCode] = settings;
    localStorage.setItem(WHATSAPP_SETTINGS_KEY, JSON.stringify(parsed));
  } catch {
    // Local storage can be unavailable in hardened/private browser contexts.
  }
}

export function buildTableWhatsAppUrl(branchCode: string, tableNumber: string, phone?: string): string {
  const message = `Hello, I am at table ${tableNumber} (${branchCode}). Please help me place an order or share my invoice here.`;
  const digits = normalizePakistaniPhone(phone);
  return `https://wa.me/${digits || ""}?text=${encodeURIComponent(message)}`;
}

export async function createTableQrDataUrl(branchCode: string, tableNumber: string, phone?: string): Promise<string> {
  return QRCode.toDataURL(buildTableWhatsAppUrl(branchCode, tableNumber, phone), {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 320,
  });
}

export function printQrImage(dataUrl: string, title: string): void {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=520,height=680");
  if (!popup) return;
  popup.document.write(`<html><head><title>${title}</title></head><body style="font-family:sans-serif;text-align:center;padding:24px"><h2>${title}</h2><img src="${dataUrl}" alt="WhatsApp QR" style="width:320px;height:320px"><p>Scan to open WhatsApp</p><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

/** Extract phone from delivery notes on a bill. */
export function phoneFromBillNotes(notes: string | null | undefined): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(/(?:\+?92|0)?3\d{9}/);
  return match?.[0] ? normalizePakistaniPhone(match[0]) : undefined;
}
