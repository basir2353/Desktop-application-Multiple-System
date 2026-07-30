import type { Bill, PraFiscalInvoice, PraInvoiceMode } from "@platform/contracts";
import {
  fetchPraFiscalForSource,
  fetchTaxFeaturesNormalized,
  issuePraInvoice,
} from "../api/pra";
import {
  preparePraReceiptFooter,
  type PraReceiptFooter,
} from "./praQr";

function canEmbedPraOnSlip(fiscal: PraFiscalInvoice | null | undefined): boolean {
  if (!fiscal) return false;
  const num = String(fiscal.invoiceNumber ?? "").trim();
  const qr = String(fiscal.qrPayload ?? "").trim();
  return Boolean(num) && Boolean(qr || num);
}

function resolveAutoPraMode(features: {
  praFakeEnabled?: boolean;
  praRealEnabled?: boolean;
}): PraInvoiceMode | null {
  const fake = Boolean(features.praFakeEnabled);
  const real = Boolean(features.praRealEnabled);
  if (real) return "real";
  if (fake) return "fake";
  // Legacy: praEnabled alone is normalized to real in API helper; still allow fake via praEnabled.
  return null;
}

function footerFromBillFields(bill: Bill, mode: PraInvoiceMode): PraReceiptFooter {
  const orderRef = bill.orderRef ?? bill.billRef;
  return preparePraReceiptFooter({
    mode,
    invoiceNumber: bill.praInvoiceNumber!.trim(),
    orderRef,
    qrPayload: bill.praQrPayload?.trim() || bill.praInvoiceNumber!.trim(),
  });
}

/**
 * Resolve PRA invoice # + QR for a waiter/staff receipt print.
 * Uses existing bill PRA fields, else fetches/issues when Fake/Real PRA is on.
 */
export async function resolvePraFooterForBillPrint(input: {
  branchCode: string;
  bill: Bill;
  issueIfMissing?: boolean;
}): Promise<PraReceiptFooter | null> {
  const bill = input.bill;
  const orderRef = bill.orderRef ?? bill.billRef;

  if (bill.praInvoiceNumber?.trim() && (bill.praMode === "fake" || bill.praMode === "real")) {
    return footerFromBillFields(bill, bill.praMode);
  }

  if (bill.praInvoiceNumber?.trim()) {
    return footerFromBillFields(bill, "fake");
  }

  if (input.issueIfMissing === false) {
    return null;
  }

  try {
    const existing = await fetchPraFiscalForSource({
      branchCode: input.branchCode,
      sourceType: "bill",
      sourceId: bill.id,
    });
    if (existing && canEmbedPraOnSlip(existing)) {
      return preparePraReceiptFooter({
        mode: existing.mode,
        invoiceNumber: existing.invoiceNumber,
        orderRef,
        qrPayload: existing.qrPayload?.trim() || existing.invoiceNumber,
      });
    }
  } catch {
    /* try issue below */
  }

  const features = await fetchTaxFeaturesNormalized().catch(() => ({
    fbrEnabled: false,
    praEnabled: false,
    praFakeEnabled: false,
    praRealEnabled: false,
  }));

  // Prefer Fake when both somehow true for staff reprint (safer offline path).
  let mode = resolveAutoPraMode(features);
  if (features.praFakeEnabled) mode = "fake";
  else if (features.praRealEnabled) mode = "real";
  else if (features.praEnabled) mode = "fake";

  if (!mode) return null;

  // Real PRA needs credentials — skip quietly on mobile if not connected.
  if (mode === "real") {
    try {
      const statusRes = await fetchPraFiscalForSource({
        branchCode: input.branchCode,
        sourceType: "bill",
        sourceId: bill.id,
      });
      if (statusRes && canEmbedPraOnSlip(statusRes)) {
        return preparePraReceiptFooter({
          mode: statusRes.mode,
          invoiceNumber: statusRes.invoiceNumber,
          orderRef,
          qrPayload: statusRes.qrPayload?.trim() || statusRes.invoiceNumber,
        });
      }
    } catch {
      /* fall through to issue attempt */
    }
  }

  try {
    const issued = await issuePraInvoice({
      branchCode: input.branchCode,
      sourceType: "bill",
      sourceId: bill.id,
      mode,
      force: false,
    });
    if (!canEmbedPraOnSlip(issued.fiscal)) return null;
    return preparePraReceiptFooter({
      mode: issued.fiscal.mode,
      invoiceNumber: issued.fiscal.invoiceNumber,
      orderRef,
      qrPayload: issued.fiscal.qrPayload?.trim() || issued.fiscal.invoiceNumber,
    });
  } catch {
    return null;
  }
}
