import type { Bill, PraFiscalInvoice, PraInvoiceMode } from "@platform/contracts";
import { fetchPraFiscalForSource, fetchTaxFeaturesNormalized } from "../api/pra";
import {
  autoIssuePraForCompletedBill,
  canEmbedPraOnSlip,
  resolveAutoPraMode,
} from "./praIssueFlow";
import { preparePraReceiptFooter, type PraReceiptFooter } from "./praQr";

function footerFromFiscal(
  fiscal: PraFiscalInvoice,
  orderRef: string,
): PraReceiptFooter {
  return preparePraReceiptFooter({
    mode: fiscal.mode,
    invoiceNumber: fiscal.invoiceNumber,
    orderRef,
    qrPayload: fiscal.qrPayload?.trim() || fiscal.invoiceNumber,
  });
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

  // Prefer Real fiscal already on the bill.
  if (bill.praInvoiceNumber?.trim() && bill.praMode === "real") {
    return footerFromBillFields(bill, "real");
  }
  if (bill.praInvoiceNumber?.trim() && bill.praMode === "fake") {
    return footerFromBillFields(bill, "fake");
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
      return footerFromFiscal(existing, orderRef);
    }
  } catch {
    /* try issue below */
  }

  // Only auto-issue for completed (paid) bills — held slips stay without PRA footer.
  if (bill.status !== "completed") {
    return null;
  }

  const features = await fetchTaxFeaturesNormalized().catch(() => ({
    fbrEnabled: false,
    praEnabled: false,
    praFakeEnabled: false,
    praRealEnabled: false,
  }));

  const mode = resolveAutoPraMode(features);
  if (!mode) return null;

  const auto = await autoIssuePraForCompletedBill({
    branchCode: input.branchCode,
    billId: bill.id,
  });
  if (auto.fiscal && canEmbedPraOnSlip(auto.fiscal)) {
    return footerFromFiscal(auto.fiscal, orderRef);
  }
  return null;
}
