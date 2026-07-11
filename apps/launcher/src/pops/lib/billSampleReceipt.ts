import type { PrintTicketInput } from "./printTicket";
import { billChannelLabel } from "./orderSales";

/** Sample receipt data for bill customization preview. */
export function sampleBillPrintInput(
  branchName: string,
  branchCode: string,
): Omit<PrintTicketInput, "kind"> {
  return {
    branchName,
    branchCode,
    orderRef: "ORD-SAMPLE",
    billRef: "BILL-PREVIEW",
    modeLabel: billChannelLabel("T5"),
    tableLabel: "T5",
    waiterName: "Ahmed Khan",
    notes: "Extra spicy · no onions",
    lines: [
      { label: "Chicken Biryani (Full)", qty: 2, unitPrice: 850 },
      { label: "Mint Raita", qty: 2, unitPrice: 120 },
      { label: "Service charge (manual)", qty: 1, unitPrice: 150 },
    ],
    subtotal: 2090,
    discount: 100,
    service: 199,
    tax: 358,
    deliveryCharge: 200,
    total: 2747,
    servicePct: 10,
    taxPct: 18,
    discountPct: 5,
  };
}
