import type { StoreSale } from "@platform/contracts";
import {
  buildTicketHtml,
  printReceiptDetailed,
  withPrinterProfile,
  type PrintTicketInput,
} from "../../pops/lib/printTicket";
import { asPrinterName } from "../../pops/lib/asPrinterName";
import { resolvePraFooterForSource } from "../../pops/lib/praPaidPrint";
import { praIssuedNotice } from "../../pops/lib/praIssueFlow";
import {
  loadKotPrintSettings,
  loadStoreBillPrintSettings,
  storeSlipToBillPrintSettings,
  type KotPrintSettings,
} from "../../pops/lib/kotPrintSettings";
import type { BillPrintSettings } from "../../pops/lib/billPrintSettings";
import {
  addPrinterProfile,
  resolveReceiptPrinter,
  setReceiptPrinter,
  updatePrinterProfile,
  type PrinterProfile,
} from "../../pops/lib/printerRouting";
import { logPrintEvent } from "../../pops/lib/printHistory";
import { listSystemPrintersDetailed } from "../../pops/lib/systemPrinters";
import { useSessionStore } from "../../stores/sessionStore";
import {
  cartLineDisplayName,
  cartLineUnitPrice,
  type CartLine,
} from "./storePosSync";

export type StoreCartReceiptInput = {
  branchName: string;
  branchCode: string;
  kind: "order" | "invoice";
  cart: CartLine[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerName?: string;
  terminalId?: string;
  cashierName?: string;
};

/** If no printer is assigned, link the Windows default (or first) printer as POS Receipt. */
export async function ensureStorePosPrinter(
  branchCode: string,
  userId?: string | null,
): Promise<PrinterProfile | null> {
  const existing = resolveReceiptPrinter(branchCode, userId);
  if (asPrinterName(existing?.systemPrinterName)) return existing;

  try {
    const listed = await listSystemPrintersDetailed();
    const pick =
      listed.usable.find((p) => p.isDefault && !p.isVirtual) ??
      listed.usable.find((p) => !p.isVirtual) ??
      listed.usable.find((p) => p.isDefault) ??
      listed.usable[0] ??
      listed.printers.find((p) => !p.isVirtual) ??
      listed.printers[0];
    if (!pick?.name) return existing;

    if (existing) {
      updatePrinterProfile(branchCode, existing.id, {
        systemPrinterName: pick.name,
        printerType:
          existing.printerType === "kitchen" || existing.printerType === "bar"
            ? "receipt"
            : existing.printerType,
      });
      setReceiptPrinter(branchCode, existing.id);
    } else {
      const created = addPrinterProfile(branchCode, "POS Receipt", {
        printerType: "receipt",
        systemPrinterName: pick.name,
      });
      setReceiptPrinter(branchCode, created.id);
    }
    return resolveReceiptPrinter(branchCode, userId);
  } catch {
    return existing;
  }
}

function resolveCashierName(fallback?: string): string | undefined {
  const fromArg = fallback?.trim();
  if (fromArg) return fromArg;
  const role = useSessionStore.getState().claims?.role?.trim();
  return role || "Cashier";
}

function billSettingsForKind(
  branchCode: string,
  kind: "order" | "invoice",
  slip?: KotPrintSettings,
): BillPrintSettings {
  const settings = slip
    ? storeSlipToBillPrintSettings(slip)
    : loadStoreBillPrintSettings(branchCode);
  if (kind === "order") {
    return {
      ...settings,
      documentTitle: settings.documentTitle || "Order Slip",
      fields: {
        ...settings.fields,
        documentTitle: true,
      },
      footerText: settings.footerText || "Order slip — not paid",
    };
  }
  return {
    ...settings,
    documentTitle: settings.documentTitle || "Sales Receipt",
    fields: {
      ...settings.fields,
      documentTitle: settings.fields.documentTitle || true,
    },
  };
}

function cartToTicketInput(input: StoreCartReceiptInput): Omit<PrintTicketInput, "kind"> {
  const discountPct =
    input.subtotal > 0 ? Math.round((input.discount / input.subtotal) * 100) : 0;
  return {
    branchName: input.branchName,
    branchCode: input.branchCode,
    orderRef: input.kind === "order" ? `ORD-${Date.now().toString().slice(-6)}` : "PREVIEW",
    modeLabel: input.kind === "order" ? "Order (unpaid)" : "Invoice preview",
    tableLabel: input.terminalId || "Counter",
    waiterName: resolveCashierName(input.cashierName),
    notes: input.customerName ? `Customer: ${input.customerName}` : "Customer: Walk-in",
    lines: input.cart.map((line) => ({
      label: cartLineDisplayName(line),
      qty: line.qty > 0 ? line.qty : 1,
      unitPrice: cartLineUnitPrice(line),
    })),
    subtotal: input.subtotal,
    discount: input.discount,
    service: 0,
    tax: input.tax,
    total: input.total,
    servicePct: 0,
    discountPct,
  };
}

function saleToTicketInput(
  branchName: string,
  branchCode: string,
  sale: StoreSale,
): Omit<PrintTicketInput, "kind"> {
  const discountPct = sale.subtotal > 0 ? Math.round((sale.discount / sale.subtotal) * 100) : 0;
  return {
    branchName,
    branchCode,
    orderRef: sale.invoiceNumber,
    billRef: sale.invoiceNumber,
    modeLabel: sale.isCredit ? "Credit sale" : sale.paymentMethod || "Paid",
    tableLabel: "Counter",
    waiterName: resolveCashierName(),
    notes: sale.customerName ? `Customer: ${sale.customerName}` : undefined,
    lines: sale.lines.map((line) => ({
      label: line.productName,
      qty: line.qty > 0 ? line.qty : 1,
      unitPrice: line.unitPrice,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    service: 0,
    tax: sale.tax,
    total: sale.total,
    servicePct: 0,
    discountPct,
  };
}

async function printStoreTicket(
  base: Omit<PrintTicketInput, "kind">,
  kind: "order" | "invoice",
): Promise<boolean> {
  const userId = useSessionStore.getState().claims?.sub ?? null;
  const profile = await ensureStorePosPrinter(base.branchCode, userId);
  const billPrintSettings = billSettingsForKind(base.branchCode, kind);
  const payload = withPrinterProfile(
    {
      ...base,
      billPrintSettings,
    },
    profile,
  );

  const result = await printReceiptDetailed(payload);
  if (base.branchCode) {
    logPrintEvent(base.branchCode, {
      kind: "receipt",
      printerName: payload.systemPrinterName ?? profile?.name ?? "dialog",
      ok: result.ok,
    });
  }
  return result.ok;
}

/** Full HTML document — matches live POS print (saved store slip template). */
export function buildStoreCartReceiptHtml(input: StoreCartReceiptInput): string {
  const slip = loadKotPrintSettings(input.branchCode, "general-store");
  return buildTicketHtml({
    ...cartToTicketInput(input),
    kind: "receipt",
    billPrintSettings: billSettingsForKind(input.branchCode, input.kind, slip),
  });
}

export function buildStoreSaleInvoiceHtml(
  branchName: string,
  branchCode: string,
  sale: StoreSale,
): string {
  const slip = loadKotPrintSettings(branchCode, "general-store");
  return buildTicketHtml({
    ...saleToTicketInput(branchName, branchCode, sale),
    kind: "receipt",
    billPrintSettings: billSettingsForKind(branchCode, "invoice", slip),
  });
}

/** @deprecated Preview uses full ticket HTML via iframe. */
export const STORE_RECEIPT_PREVIEW_CSS = `
.store-receipt-preview{background:#fff;color:#111}
.store-receipt-preview iframe{width:100%;min-height:420px;border:0;background:#fff}
`;

export type StoreInvoicePrintResult = {
  ok: boolean;
  praNotice?: string;
  praFailed?: boolean;
  blockedReal?: boolean;
};

/**
 * Restaurant-style finalize: issue Fake/Real PRA (when enabled), embed Invoice # + QR, then print.
 */
export async function printStoreInvoiceAsync(
  branchName: string,
  branchCode: string,
  sale: StoreSale,
): Promise<StoreInvoicePrintResult> {
  const base = saleToTicketInput(branchName, branchCode, sale);
  if (sale.status !== "Completed") {
    const ok = await printStoreTicket(base, "invoice");
    return { ok };
  }

  const resolved = await resolvePraFooterForSource({
    branchCode,
    sourceType: "store_sale",
    sourceId: sale.id,
    orderRef: sale.invoiceNumber,
    issueIfMissing: true,
  });

  if (resolved.blockedReal && resolved.notice) {
    window.alert(resolved.notice);
  }

  const ok = await printStoreTicket(
    {
      ...base,
      praFiscal: resolved.footer,
    },
    "invoice",
  );

  const praFailed = Boolean(
    resolved.blockedReal || (resolved.notice && !resolved.footer),
  );
  let praNotice = resolved.notice;
  if (!praFailed && resolved.fiscal) {
    praNotice = praIssuedNotice(resolved.fiscal.mode, resolved.fiscal.invoiceNumber);
  }
  return {
    ok,
    praNotice,
    praFailed,
    blockedReal: resolved.blockedReal,
  };
}

export function printStoreInvoice(branchName: string, branchCode: string, sale: StoreSale): boolean {
  void printStoreInvoiceAsync(branchName, branchCode, sale);
  return true;
}

/** Print current ticket as Order slip or Invoice preview. Uses saved store slip template. */
export function printStoreCartReceipt(input: StoreCartReceiptInput): boolean {
  void printStoreTicket(cartToTicketInput(input), input.kind);
  return true;
}
