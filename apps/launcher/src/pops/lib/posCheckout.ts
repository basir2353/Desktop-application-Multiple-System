import type { BillLine, BillPayment, PaymentMethod } from "@platform/contracts";
import { computeTicketTotals } from "./posDiscount";
import type { PosCartLine } from "./posCart";
import { effectiveTaxPct, type PosSettings } from "./posSettings";

export type CheckoutTotals = ReturnType<typeof computeTicketTotals> & {
  servicePct: number;
  taxPct: number;
};

export type CheckoutMode = "full" | "partial" | "hold";

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
  deliveryCharge = 0,
): CheckoutTotals {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const totals = computeTicketTotals(subtotal, discountAmount, servicePct, taxPct, deliveryCharge);
  return { ...totals, servicePct, taxPct };
}

/** Tax % based on dominant payment method when tax-by-payment is enabled. */
export function taxPctForPayments(settings: PosSettings, payments: BillPayment[]): number {
  if (!settings.taxEnabled) return 0;
  if (!settings.taxByPaymentMethod || payments.length === 0) {
    return effectiveTaxPct(settings);
  }
  const dominant = payments.reduce(
    (best, p) => (p.amount > best.amount ? p : best),
    payments[0] ?? { method: "cash" as PaymentMethod, amount: 0 },
  );
  return effectiveTaxPct(settings, dominant.method);
}

export function balanceDue(total: number, payments: BillPayment[]): number {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return Math.max(0, total - paid);
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

export function paymentsShortfallMessage(
  payments: BillPayment[],
  total: number,
  mode: CheckoutMode = "full",
): string | null {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (mode === "hold") return null;
  if (mode === "partial") {
    if (paid <= 0) return "Enter at least one partial payment amount.";
    if (paid >= total) return null;
    return null;
  }
  if (paid >= total) return null;
  return `Payments (Rs ${paid.toLocaleString()}) do not cover bill total (Rs ${total.toLocaleString()})`;
}

export function isPartialPayment(payments: BillPayment[], total: number): boolean {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return paid > 0 && paid < total;
}
