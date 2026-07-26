import type { PrintTicketInput } from "./printTicket";
import { billChannelLabel } from "./orderSales";
import { effectiveTaxPct, loadPosSettings } from "./posSettings";
import { computeTicketTotals } from "./posDiscount";

/** Sample receipt data for bill customization preview and test prints. */
export function sampleBillPrintInput(
  branchName: string,
  branchCode: string,
): Omit<PrintTicketInput, "kind"> {
  const settings = loadPosSettings(branchCode);
  const subtotal = 8060;
  const taxPct = effectiveTaxPct(settings);
  const totals = computeTicketTotals(subtotal, 0, settings.servicePct, taxPct);

  return {
    branchName,
    branchCode,
    orderRef: "ORD-SAMPLE",
    billRef: "BILL-TEST",
    modeLabel: billChannelLabel("Takeaway"),
    tableLabel: "Takeaway",
    waiterName: "Ali (cashier)",
    notes: undefined,
    lines: [
      { label: "Soft drink", qty: 3, unitPrice: 120 },
      { label: "Chicken Karahi (Full)", qty: 1, unitPrice: 2850 },
      { label: "Family Combo 4", qty: 1, unitPrice: 4850 },
    ],
    subtotal: totals.subtotal,
    discount: totals.discount,
    service: totals.service,
    tax: totals.tax,
    deliveryCharge: undefined,
    total: totals.total,
    servicePct: settings.servicePct,
    taxPct,
    discountPct: totals.discountPct,
  };
}
