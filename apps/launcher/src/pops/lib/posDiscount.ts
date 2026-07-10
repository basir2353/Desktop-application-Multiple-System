export function clampDiscountPkr(amount: number, subtotal: number): number {
  return Math.max(0, Math.min(Math.round(amount), subtotal));
}

export function discountPctFromAmount(amount: number, subtotal: number): number {
  if (subtotal <= 0) return 0;
  return Math.min(50, Math.round((amount / subtotal) * 100));
}

export function discountAmountFromPct(pct: number, subtotal: number): number {
  const clamped = Math.max(0, Math.min(50, pct));
  return Math.round(subtotal * (clamped / 100));
}

export type TicketTotals = {
  subtotal: number;
  discount: number;
  discountPct: number;
  service: number;
  tax: number;
  deliveryCharge: number;
  total: number;
};

export function computeTicketTotals(
  subtotal: number,
  discountAmount: number,
  servicePct: number,
  taxPct = 15,
  deliveryCharge = 0,
): TicketTotals {
  const discount = clampDiscountPkr(discountAmount, subtotal);
  const afterDisc = subtotal - discount;
  const service = Math.round(afterDisc * (servicePct / 100));
  const effectiveTaxPct = taxPct > 0 ? taxPct : 0;
  const tax = Math.round((afterDisc + service) * (effectiveTaxPct / 100));
  const charge = Math.max(0, Math.round(deliveryCharge));
  const total = afterDisc + service + tax + charge;
  return {
    subtotal,
    discount,
    discountPct: discountPctFromAmount(discount, subtotal),
    service,
    tax,
    deliveryCharge: charge,
    total,
  };
}
