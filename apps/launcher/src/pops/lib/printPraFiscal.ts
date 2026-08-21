import type { PraFiscalInvoice } from "@platform/contracts";
import {
  printHtmlDocumentAndWait,
  renderTicketHtmlToPngBytes,
} from "./printTicket";
import { buildPraFiscalHtml } from "./praFiscalPrint";
import { trackPrintJob } from "./printQueueMonitor";
import { asPrinterName } from "./asPrinterName";
import { isDesktopAppRuntime, isVirtualSystemPrinter, printImageToSystemPrinter } from "./systemPrinters";

/**
 * Print using the same POS order-slip HTML (bill print settings + PRA footer).
 */
export async function printPraFiscalSlip(
  fiscal: PraFiscalInvoice,
  options?: {
    systemPrinterName?: string | null;
    paperWidthMm?: number;
    branchName?: string;
    branchCode?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const tracker = trackPrintJob({
    branchCode: options?.branchCode || fiscal.branchCode,
    kind: "pra",
    orderRef: fiscal.sourceRef || fiscal.invoiceNumber,
    printerName: options?.systemPrinterName ?? undefined,
    source: "pc",
    deviceLabel: "desktop-launcher",
  });

  try {
    const html = await buildPraFiscalHtml(fiscal, {
      branchName: options?.branchName,
      branchCode: options?.branchCode,
    });
    const printer = asPrinterName(options?.systemPrinterName);
    if (printer && !isVirtualSystemPrinter(printer) && isDesktopAppRuntime()) {
      const png = await renderTicketHtmlToPngBytes(html, "80mm");
      if (png?.length) {
        const img = await printImageToSystemPrinter({
          printerName: printer,
          pngBytes: png,
          jobName: `Invoice ${fiscal.invoiceNumber}`,
          copies: 1,
          paperWidthMm: options?.paperWidthMm ?? 80,
        });
        if (img.ok) {
          tracker.finish(true);
          return { ok: true };
        }
        if (!img.unsupported) {
          const err = img.error ?? `Printer "${printer}" failed.`;
          tracker.finish(false, err);
          return { ok: false, error: err };
        }
      }
    }
    const opened = await printHtmlDocumentAndWait(html, `Invoice ${fiscal.invoiceNumber}`);
    if (opened) {
      tracker.finish(true);
      return { ok: true };
    }
    tracker.finish(false, "Could not open print dialog.");
    return { ok: false, error: "Could not open print dialog." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invoice print failed.";
    tracker.finish(false, msg);
    return { ok: false, error: msg };
  }
}

export async function printPraFiscalWithReceipt(params: {
  fiscal: PraFiscalInvoice;
  systemPrinterName?: string | null;
  branchName?: string;
  branchCode?: string;
}): Promise<{ ok: boolean; error?: string }> {
  return printPraFiscalSlip(params.fiscal, {
    systemPrinterName: params.systemPrinterName,
    branchName: params.branchName,
    branchCode: params.branchCode,
  });
}
