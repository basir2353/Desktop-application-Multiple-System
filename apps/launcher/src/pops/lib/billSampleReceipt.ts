import type { PrintTicketInput } from "./printTicket";
import { billChannelLabel } from "./orderSales";

/** Sample receipt data for bill customization preview and test prints. */
export function sampleBillPrintInput(
  branchName: string,
  branchCode: string,
): Omit<PrintTicketInput, "kind"> {
  return {
    branchName,
    branchCode,
    orderRef: "ORD-SAMPLE",
    billRef: "BILL-TEST",
    modeLabel: billChannelLabel("Takeaway"),
    tableLabel: "Takeaway",
    waiterName: "POS Counter",
    notes: undefined,
    lines: [
      { label: "Soft drink", qty: 3, unitPrice: 120 },
      { label: "Chicken Karahi (Full)", qty: 1, unitPrice: 2850 },
      { label: "Family Combo 4", qty: 1, unitPrice: 4850 },
    ],
    subtotal: 8060,
    discount: 0,
    service: 806,
    tax: 1329,
    deliveryCharge: undefined,
    total: 10195,
    servicePct: 10,
    taxPct: 15,
    discountPct: 0,
  };
}
