/** POS tax rates used by the ordering app (aligned with desktop defaults). */

export type PosTaxSettings = {
  servicePct: number;
  taxPct: number;
  taxByPaymentMethod: boolean;
  cashTaxPct: number;
  cardTaxPct: number;
  onlineTaxPct: number;
  taxEnabled: boolean;
};

export const DEFAULT_POS_TAX_SETTINGS: PosTaxSettings = {
  servicePct: 10,
  taxPct: 16,
  taxByPaymentMethod: true,
  cashTaxPct: 16,
  cardTaxPct: 8,
  onlineTaxPct: 8,
  taxEnabled: true,
};

export type PaymentMethod = "cash" | "card" | "wallet" | "bank";

export function effectiveTaxPct(
  settings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS,
  paymentMethod?: PaymentMethod,
): number {
  if (!settings.taxEnabled) return 0;
  if (settings.taxByPaymentMethod && paymentMethod) {
    if (paymentMethod === "cash") return settings.cashTaxPct;
    if (paymentMethod === "card") return settings.cardTaxPct;
    return settings.onlineTaxPct;
  }
  return settings.taxPct;
}

/** Preview / unpaid bill uses cash GST (16%) as the primary estimate. */
export function previewTaxPct(settings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS): number {
  return effectiveTaxPct(settings, settings.taxByPaymentMethod ? "cash" : undefined);
}

export function calcServiceTaxTotals(
  subtotal: number,
  settings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS,
  paymentMethod?: PaymentMethod,
): {
  servicePct: number;
  service: number;
  taxPct: number;
  tax: number;
  total: number;
  cashTaxPct: number;
  cardTaxPct: number;
  cashTax: number;
  cardTax: number;
  cashTotal: number;
  cardTotal: number;
} {
  const servicePct = Math.max(0, settings.servicePct);
  const service = Math.round(subtotal * (servicePct / 100));
  const taxable = Math.max(0, subtotal);
  const cashTaxPct = effectiveTaxPct(settings, "cash");
  const cardTaxPct = effectiveTaxPct(settings, "card");
  const cashTax = Math.round((taxable + service) * (cashTaxPct / 100));
  const cardTax = Math.round((taxable + service) * (cardTaxPct / 100));
  const taxPct = effectiveTaxPct(settings, paymentMethod ?? "cash");
  const tax = paymentMethod === "card" || paymentMethod === "wallet" || paymentMethod === "bank"
    ? cardTax
    : cashTax;
  return {
    servicePct,
    service,
    taxPct,
    tax,
    total: subtotal + service + tax,
    cashTaxPct,
    cardTaxPct,
    cashTax,
    cardTax,
    cashTotal: subtotal + service + cashTax,
    cardTotal: subtotal + service + cardTax,
  };
}
