import type { PraFiscalInvoice } from "@platform/contracts";
import {
  printHtmlDocumentAndWait,
  renderTicketHtmlToPngBytes,
} from "./printTicket";
import { buildPraFiscalHtml } from "./praFiscalPrint";
import { asPrinterName } from "./asPrinterName";
import { isVirtualSystemPrinter, printImageToSystemPrinter } from "./systemPrinters";

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
  try {
    const html = await buildPraFiscalHtml(fiscal, {
      branchName: options?.branchName,
      branchCode: options?.branchCode,
    });
    const printer = asPrinterName(options?.systemPrinterName);
    if (printer && !isVirtualSystemPrinter(printer)) {
      const png = await renderTicketHtmlToPngBytes(html, "80mm");
      if (png?.length) {
        const img = await printImageToSystemPrinter({
          printerName: printer,
          pngBytes: png,
          jobName: `Invoice ${fiscal.invoiceNumber}`,
          copies: 1,
          paperWidthMm: options?.paperWidthMm ?? 80,
        });
        if (img.ok) return { ok: true };
      }
    }
    const opened = await printHtmlDocumentAndWait(html, `Invoice ${fiscal.invoiceNumber}`);
    return opened ? { ok: true } : { ok: false, error: "Could not open print dialog." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invoice print failed." };
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
