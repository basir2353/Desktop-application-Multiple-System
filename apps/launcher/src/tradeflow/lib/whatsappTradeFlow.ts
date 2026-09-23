import { toPng } from "html-to-image";
import type { TradeFlowInvoice, TradeFlowPurchase } from "@platform/contracts";
import { buildTradeFlowInvoiceHtml, buildTradeFlowPurchaseHtml } from "./printTradeFlowInvoice";

function downloadPng(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export class TradeFlowWhatsappError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TradeFlowWhatsappError";
  }
}

async function exportHtmlJpg(html: string, fileName: string): Promise<void> {
  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.left = "-12000px";
  wrap.style.top = "0";
  wrap.style.width = "520px";
  wrap.style.background = "#ffffff";
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
  try {
    const node = (wrap.querySelector("body") as HTMLElement | null) ?? wrap;
    const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
    downloadPng(dataUrl, fileName.endsWith(".jpg") ? fileName : `${fileName}.jpg`);
  } finally {
    wrap.remove();
  }
}

export async function sendTradeFlowWhatsapp(opts: {
  waUrl: string | null;
  phone?: string | null;
  invoice?: TradeFlowInvoice;
  purchase?: TradeFlowPurchase;
}): Promise<void> {
  if (!opts.waUrl) {
    throw new TradeFlowWhatsappError(
      opts.phone
        ? "Could not open WhatsApp for this number. Check the phone format."
        : "WhatsApp number is missing. Add a phone number on the party first.",
    );
  }

  try {
    if (opts.invoice) await exportHtmlJpg(buildTradeFlowInvoiceHtml(opts.invoice, "a5"), `${opts.invoice.invoiceNo}.jpg`);
    if (opts.purchase) await exportHtmlJpg(buildTradeFlowPurchaseHtml(opts.purchase, "a5"), `${opts.purchase.invoiceNo}.jpg`);
  } catch {
    // Message still goes on WhatsApp if the image export fails.
  }

  const opened = window.open(opts.waUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    throw new TradeFlowWhatsappError("Popup was blocked. Allow popups, then send again.");
  }
}
