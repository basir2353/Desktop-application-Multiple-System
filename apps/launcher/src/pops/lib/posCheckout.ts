import type { BillLine, BillPayment, PaymentMethod } from "@platform/contracts";
import { computeTicketTotals } from "./posDiscount";
import type { PosCartLine } from "./posCart";

export type CheckoutTotals = ReturnType<typeof computeTicketTotals> & {
  servicePct: number;
  taxPct: number;
};

export function cartToBillLines(cart: PosCartLine[]): BillLine[] {
  return cart.map((line) => ({
    label: line.lineLabel,
    qty: line.qty,
    unitPrice: line.unitPrice,
    menuItemId: line.item.id,
  }));
}

export function computeCheckoutTotals(
  lines: Pick<BillLine, "qty" | "unitPrice">[],
  discountAmount: number,
  servicePct: number,
  taxPct: number,
): CheckoutTotals {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const totals = computeTicketTotals(subtotal, discountAmount, servicePct, taxPct);
  return { ...totals, servicePct, taxPct };
}

export function allocateDiscountAcrossSplits(
  totalDiscount: number,
  splitSubtotals: number[],
): number[] {
  const grand = splitSubtotals.reduce((s, n) => s + n, 0);
  if (grand <= 0 || totalDiscount <= 0) return splitSubtotals.map(() => 0);
  let allocated = 0;
  return splitSubtotals.map((sub, index) => {
    if (index === splitSubtotals.length - 1) {
      return Math.max(0, totalDiscount - allocated);
    }
    const share = Math.round((sub / grand) * totalDiscount);
    allocated += share;
    return share;
  });
}

export function paymentSummary(payments: BillPayment[]): string {
  return payments
    .filter((p) => p.amount > 0)
    .map((p) => `${p.method} Rs ${p.amount.toLocaleString()}`)
    .join(" + ");
}

export function defaultPaymentRow(method: PaymentMethod = "cash"): BillPayment {
  return { method, amount: 0 };
}

export function paymentsCoverTotal(payments: BillPayment[], total: number): boolean {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return paid >= total;
}
