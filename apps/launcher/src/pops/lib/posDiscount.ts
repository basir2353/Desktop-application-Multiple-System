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

/** Per-item discountable/taxable eligibility, in PKR, out of the ticket's full subtotal. */
export type TicketItemEligibility = {
  /** Sum of lines where the menu item is discountable and not marked non-discountable. */
  discountableSubtotal: number;
  /** Sum of lines where the menu item is not marked non-taxable. */
  taxableSubtotal: number;
};

export function computeTicketTotals(
  subtotal: number,
  discountAmount: number,
  servicePct: number,
  taxPct = 15,
  deliveryCharge = 0,
  eligibility?: TicketItemEligibility,
): TicketTotals {
  const discountableBase = eligibility?.discountableSubtotal ?? subtotal;
  const taxableBase = eligibility?.taxableSubtotal ?? subtotal;

  // Discount can never exceed the value of items actually eligible for it.
  const discount = Math.min(clampDiscountPkr(discountAmount, subtotal), discountableBase);
  const afterDisc = subtotal - discount;
  const service = Math.round(afterDisc * (servicePct / 100));
  const effectiveTaxPct = taxPct > 0 ? taxPct : 0;

  // Tax base: taxable items' value net of the discount they absorbed, plus their fair
  // share of the service charge. With no eligibility info, taxableBase === subtotal and
  // this reduces to the original (afterDisc + service) * taxPct formula.
  const taxableAfterDiscount = Math.max(0, taxableBase - Math.min(discount, taxableBase));
  const taxableShareOfService = afterDisc > 0 ? service * (taxableAfterDiscount / afterDisc) : 0;
  const tax = Math.round((taxableAfterDiscount + taxableShareOfService) * (effectiveTaxPct / 100));

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
