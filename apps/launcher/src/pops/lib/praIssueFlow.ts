import type { PraFiscalInvoice, PraInvoiceMode } from "@platform/contracts";
import { issuePraInvoice } from "../../lib/praApi";
import { fetchTaxAuthorityStatus } from "../../lib/taxAuthorityApi";
import { printPraFiscalSlip } from "./printPraFiscal";

export const REAL_PRA_NOT_CONNECTED_MSG =
  "Real PRA is not connected. Please connect your PRA account before uploading invoices.";

/** Issue Fake/Real PRA for a completed bill (does not print). */
export async function issuePraForBill(input: {
  branchCode: string;
  billId: string;
  mode: PraInvoiceMode;
}): Promise<{ fiscal: PraFiscalInvoice; message: string }> {
  return issuePraForSource({
    branchCode: input.branchCode,
    sourceType: "bill",
    sourceId: input.billId,
    mode: input.mode,
  });
}

/** Issue Fake/Real PRA for bill / store sale / pharmacy sale. */
export async function issuePraForSource(input: {
  branchCode: string;
  sourceType: "bill" | "store_sale" | "pharmacy_sale";
  sourceId: string;
  mode: PraInvoiceMode;
}): Promise<{ fiscal: PraFiscalInvoice; message: string }> {
  const result = await issuePraInvoice({
    branchCode: input.branchCode,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    mode: input.mode,
    force: false,
  });
  return { fiscal: result.fiscal, message: result.message };
}

export async function printIssuedPraSlip(
  fiscal: PraFiscalInvoice,
  options?:
    | string
    | null
    | {
        systemPrinterName?: string | null;
        paperWidthMm?: number;
        branchName?: string;
        branchCode?: string;
      },
): Promise<{ ok: boolean; error?: string }> {
  // Back-compat: older callers passed a printer name string as the 2nd arg.
  if (typeof options === "string" || options == null) {
    return printPraFiscalSlip(fiscal, {
      systemPrinterName: typeof options === "string" ? options : null,
    });
  }
  const systemPrinterName =
    typeof options.systemPrinterName === "string" ? options.systemPrinterName : null;
  return printPraFiscalSlip(fiscal, {
    systemPrinterName,
    paperWidthMm: options.paperWidthMm,
    branchName: options.branchName,
    branchCode: options.branchCode,
  });
}

export function praIssuedNotice(_mode: PraInvoiceMode, invoiceNumber: string): string {
  return `PRA invoice issued — ${invoiceNumber}`;
}

/** Resolve which PRA mode to run automatically (null = skip). Prefer real if both somehow true. */
export function resolveAutoPraMode(features: {
  praFakeEnabled?: boolean;
  praRealEnabled?: boolean;
}): PraInvoiceMode | null {
  const fake = Boolean(features.praFakeEnabled);
  const real = Boolean(features.praRealEnabled);
  if (real) return "real";
  if (fake) return "fake";
  return null;
}

/** Real PRA is ready to upload when status is connected (or token expired but profile exists). */
export function isRealPraConnectedStatus(status: string | null | undefined): boolean {
  return status === "connected" || status === "expired";
}

/**
 * Check Tax Integration Real PRA connection for this branch.
 * Fake PRA does not need credentials — only Real does.
 */
export async function checkRealPraConnected(branchCode: string): Promise<{
  connected: boolean;
  status: string;
}> {
  const status = await fetchTaxAuthorityStatus(branchCode);
  const praStatus = status.pra.status;
  return {
    connected: isRealPraConnectedStatus(praStatus),
    status: praStatus,
  };
}

/** Only embed Invoice # + QR when fiscal has a real number (after successful issue). */
export function canEmbedPraOnSlip(fiscal: PraFiscalInvoice | null | undefined): boolean {
  if (!fiscal) return false;
  const num = String(fiscal.invoiceNumber ?? "").trim();
  const qr = String(fiscal.qrPayload ?? "").trim();
  return Boolean(num) && Boolean(qr || num);
}
