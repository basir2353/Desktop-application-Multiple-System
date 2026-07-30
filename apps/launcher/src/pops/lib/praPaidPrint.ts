import type { Bill, PraFiscalInvoice, PraInvoiceMode } from "@platform/contracts";
import { fetchPraFiscalForSource, fetchTaxFeaturesNormalized } from "../../lib/praApi";
import { preparePraReceiptFooter, type PraReceiptFooter } from "./praReceiptFooter";
import {
  canEmbedPraOnSlip,
  checkRealPraConnected,
  issuePraForSource,
  REAL_PRA_NOT_CONNECTED_MSG,
  resolveAutoPraMode,
} from "./praIssueFlow";

type PraSourceType = "bill" | "store_sale" | "pharmacy_sale";

/**
 * Resolve PRA footer for a paid sale reprint / POS print.
 * Works for restaurant bills, general-store sales, and pharmacy sales.
 */
export async function resolvePraFooterForSource(input: {
  branchCode: string;
  sourceType: PraSourceType;
  sourceId: string;
  orderRef: string;
  /** When true, attempt issue if no fiscal yet. */
  issueIfMissing?: boolean;
}): Promise<{
  footer: PraReceiptFooter | null;
  fiscal: PraFiscalInvoice | null;
  notice?: string;
  blockedReal?: boolean;
}> {
  try {
    const existing = await fetchPraFiscalForSource({
      branchCode: input.branchCode,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    });
    if (existing && canEmbedPraOnSlip(existing)) {
      const footer = await preparePraReceiptFooter({
        mode: existing.mode,
        invoiceNumber: existing.invoiceNumber,
        orderRef: input.orderRef,
        qrPayload: existing.qrPayload?.trim() || existing.invoiceNumber,
      });
      return { footer, fiscal: existing };
    }
  } catch {
    /* issue below */
  }

  if (input.issueIfMissing === false) {
    return { footer: null, fiscal: null };
  }

  const features = await fetchTaxFeaturesNormalized().catch(() => ({
    fbrEnabled: false,
    praEnabled: false,
    praFakeEnabled: false,
    praRealEnabled: false,
  }));
  const mode = resolveAutoPraMode(features);
  if (!mode) return { footer: null, fiscal: null };

  if (mode === "real") {
    try {
      const gate = await checkRealPraConnected(input.branchCode);
      if (!gate.connected) {
        return {
          footer: null,
          fiscal: null,
          notice: REAL_PRA_NOT_CONNECTED_MSG,
          blockedReal: true,
        };
      }
    } catch {
      return {
        footer: null,
        fiscal: null,
        notice: REAL_PRA_NOT_CONNECTED_MSG,
        blockedReal: true,
      };
    }
  }

  try {
    const issued = await issuePraForSource({
      branchCode: input.branchCode,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      mode: mode as PraInvoiceMode,
    });
    if (!canEmbedPraOnSlip(issued.fiscal)) {
      return { footer: null, fiscal: null, notice: "PRA did not return invoice number/QR." };
    }
    const footer = await preparePraReceiptFooter({
      mode: issued.fiscal.mode,
      invoiceNumber: issued.fiscal.invoiceNumber,
      orderRef: input.orderRef,
      qrPayload: issued.fiscal.qrPayload?.trim() || issued.fiscal.invoiceNumber,
    });
    return { footer, fiscal: issued.fiscal };
  } catch (err) {
    return {
      footer: null,
      fiscal: null,
      notice: err instanceof Error ? err.message : "PRA issue failed.",
    };
  }
}

/**
 * Resolve PRA footer for a paid restaurant bill reprint / Latest-orders Print.
 */
export async function resolvePraFooterForPaidBill(input: {
  branchCode: string;
  bill: Bill;
  issueIfMissing?: boolean;
}): Promise<{
  footer: PraReceiptFooter | null;
  fiscal: PraFiscalInvoice | null;
  notice?: string;
  blockedReal?: boolean;
}> {
  const bill = input.bill;
  const orderRef = bill.orderRef ?? bill.billRef;

  if (bill.praInvoiceNumber && (bill.praMode === "fake" || bill.praMode === "real")) {
    const footer = await preparePraReceiptFooter({
      mode: bill.praMode,
      invoiceNumber: bill.praInvoiceNumber,
      orderRef,
      qrPayload: bill.praQrPayload?.trim() || bill.praInvoiceNumber,
    });
    return {
      footer,
      fiscal: {
        mode: bill.praMode,
        invoiceNumber: bill.praInvoiceNumber,
        invoiceId: bill.praInvoiceId ?? bill.praInvoiceNumber,
        qrPayload: bill.praQrPayload?.trim() || bill.praInvoiceNumber,
        usin: bill.praInvoiceId ?? bill.praInvoiceNumber,
        issuedAt: bill.praIssuedAt ?? bill.createdAt,
        sellerName: "",
        ntn: "",
        strn: "",
        branchCode: input.branchCode,
        sourceRef: bill.billRef,
        taxableAmountPkr: Math.max(0, bill.subtotal - bill.discount),
        taxAmountPkr: bill.tax,
        totalAmountPkr: bill.total,
        lines: bill.lines.map((l) => ({
          label: l.label,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      },
    };
  }

  // Invoice # present but mode missing (older rows) — still reprint same slip.
  if (bill.praInvoiceNumber?.trim()) {
    const mode: PraInvoiceMode = "fake";
    const footer = await preparePraReceiptFooter({
      mode,
      invoiceNumber: bill.praInvoiceNumber,
      orderRef,
      qrPayload: bill.praQrPayload?.trim() || bill.praInvoiceNumber,
    });
    return {
      footer,
      fiscal: {
        mode,
        invoiceNumber: bill.praInvoiceNumber,
        invoiceId: bill.praInvoiceId ?? bill.praInvoiceNumber,
        qrPayload: bill.praQrPayload?.trim() || bill.praInvoiceNumber,
        usin: bill.praInvoiceId ?? bill.praInvoiceNumber,
        issuedAt: bill.praIssuedAt ?? bill.createdAt,
        sellerName: "",
        ntn: "",
        strn: "",
        branchCode: input.branchCode,
        sourceRef: bill.billRef,
        taxableAmountPkr: Math.max(0, bill.subtotal - bill.discount),
        taxAmountPkr: bill.tax,
        totalAmountPkr: bill.total,
        lines: bill.lines.map((l) => ({
          label: l.label,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      },
    };
  }

  return resolvePraFooterForSource({
    branchCode: input.branchCode,
    sourceType: "bill",
    sourceId: bill.id,
    orderRef,
    issueIfMissing: input.issueIfMissing,
  });
}
