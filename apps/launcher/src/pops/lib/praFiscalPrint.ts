import type { PraFiscalInvoice } from "@platform/contracts";
import { loadBillPrintSettings } from "./billPrintSettings";
import type { PraReceiptFooter } from "./praReceiptFooter";
import { formatPraInvoiceNumberForSlip } from "./praReceiptFooter";
import { resolvePraLogoSrc } from "./praLogo";
import { praQrDataUrl, sanitizePraQrPayload } from "./praQr";
import { buildTicketHtml, type PrintTicketInput } from "./printTicket";

export { praQrDataUrl, sanitizePraQrPayload } from "./praQr";

/**
 * Map a PRA fiscal into the same PrintTicketInput shape used by POS order slips.
 * Line items are dynamic (empty / 1 / N) — same add/remove behavior as POS.
 */
export function fiscalToReceiptPrintInput(
  fiscal: PraFiscalInvoice,
  options?: { branchName?: string; branchCode?: string },
): Omit<PrintTicketInput, "kind"> {
  const lines = (fiscal.lines ?? [])
    .filter((l) => l && String(l.label ?? "").trim())
    .map((l) => ({
      label: String(l.label).trim(),
      qty: Math.max(1, Math.round(Number(l.qty) || 1)),
      unitPrice: Math.max(0, Math.round(Number(l.unitPrice) || 0)),
    }));

  const taxable = Math.max(0, Math.round(fiscal.taxableAmountPkr || 0));
  const tax = Math.max(0, Math.round(fiscal.taxAmountPkr || 0));
  const total = Math.max(0, Math.round(fiscal.totalAmountPkr || taxable + tax));
  const taxPct = taxable > 0 ? Math.round((tax / taxable) * 100) : 0;

  return {
    branchName:
      (fiscal.sellerName || "").trim() ||
      options?.branchName?.trim() ||
      "Main System",
    branchCode: options?.branchCode || fiscal.branchCode || "",
    orderRef: fiscal.sourceRef || fiscal.invoiceNumber,
    billRef: fiscal.sourceRef || undefined,
    modeLabel: "Invoice",
    waiterName: undefined,
    notes: undefined,
    lines:
      lines.length > 0
        ? lines
        : taxable > 0
          ? [{ label: "Sale", qty: 1, unitPrice: taxable }]
          : [],
    subtotal: taxable,
    discount: 0,
    service: 0,
    tax,
    total,
    servicePct: 0,
    taxPct,
    discountPct: 0,
  };
}

/**
 * Same HTML as POS order / print-invoice slip (bill print settings + PRA footer).
 * Do not use a separate e-IMS layout.
 */
export async function buildPraFiscalHtml(
  fiscal: PraFiscalInvoice,
  options?: { branchName?: string; branchCode?: string },
): Promise<string> {
  const mode = fiscal.mode === "real" ? "real" : "fake";
  const cleanQr = sanitizePraQrPayload(fiscal.qrPayload || fiscal.invoiceNumber, mode);
  const branchCode = options?.branchCode || fiscal.branchCode || "";
  const [qrDataUrl, logoDataUrl] = await Promise.all([
    praQrDataUrl(cleanQr, 160, mode),
    resolvePraLogoSrc(branchCode || undefined),
  ]);
  const displayInvoice = formatPraInvoiceNumberForSlip(fiscal.invoiceNumber, mode);
  const praFiscal: PraReceiptFooter = {
    mode,
    invoiceNumber: displayInvoice,
    orderRef: fiscal.sourceRef || fiscal.invoiceNumber,
    qrPayload: cleanQr,
    qrDataUrl,
    logoDataUrl,
  };
  const input: PrintTicketInput = {
    kind: "receipt",
    ...fiscalToReceiptPrintInput(fiscal, options),
    billPrintSettings: loadBillPrintSettings(branchCode || undefined),
    praFiscal,
  };
  return buildTicketHtml(input);
}
