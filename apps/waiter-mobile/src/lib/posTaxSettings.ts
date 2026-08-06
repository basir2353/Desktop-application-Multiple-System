/** POS tax rates used by the ordering app (aligned with desktop defaults). */

export type PosTaxSettings = {
  servicePct: number;
  taxPct: number;
  taxByPaymentMethod: boolean;
  cashTaxPct: number;
  cardTaxPct: number;
  onlineTaxPct: number;
  taxEnabled: boolean;
  serviceOnDineIn: boolean;
  /** Apply service charge on takeaway (default off). */
  serviceOnTakeaway: boolean;
  /** Apply service charge on delivery (default off). */
  serviceOnDelivery: boolean;
  serviceOnOnline: boolean;
  serviceOnFoodpanda: boolean;
  serviceOnStaffFood: boolean;
  taxOnDineIn: boolean;
  taxOnTakeaway: boolean;
  taxOnDelivery: boolean;
  taxOnOnline: boolean;
  taxOnFoodpanda: boolean;
  taxOnStaffFood: boolean;
};

export const DEFAULT_POS_TAX_SETTINGS: PosTaxSettings = {
  servicePct: 10,
  taxPct: 15,
  taxByPaymentMethod: true,
  cashTaxPct: 16,
  cardTaxPct: 8,
  onlineTaxPct: 8,
  taxEnabled: true,
  serviceOnDineIn: true,
  serviceOnTakeaway: false,
  serviceOnDelivery: false,
  serviceOnOnline: false,
  serviceOnFoodpanda: false,
  serviceOnStaffFood: true,
  taxOnDineIn: true,
  taxOnTakeaway: false,
  taxOnDelivery: false,
  taxOnOnline: true,
  taxOnFoodpanda: true,
  taxOnStaffFood: true,
};

export function normalizePosTaxSettings(input: Partial<PosTaxSettings>): PosTaxSettings {
  return {
    servicePct: Number.isFinite(input.servicePct) ? Math.max(0, Number(input.servicePct)) : DEFAULT_POS_TAX_SETTINGS.servicePct,
    taxPct: Number.isFinite(input.taxPct) ? Math.max(0, Number(input.taxPct)) : DEFAULT_POS_TAX_SETTINGS.taxPct,
    taxByPaymentMethod: input.taxByPaymentMethod ?? DEFAULT_POS_TAX_SETTINGS.taxByPaymentMethod,
    cashTaxPct: Number.isFinite(input.cashTaxPct) ? Math.max(0, Number(input.cashTaxPct)) : DEFAULT_POS_TAX_SETTINGS.cashTaxPct,
    cardTaxPct: Number.isFinite(input.cardTaxPct) ? Math.max(0, Number(input.cardTaxPct)) : DEFAULT_POS_TAX_SETTINGS.cardTaxPct,
    onlineTaxPct: Number.isFinite(input.onlineTaxPct) ? Math.max(0, Number(input.onlineTaxPct)) : DEFAULT_POS_TAX_SETTINGS.onlineTaxPct,
    taxEnabled: input.taxEnabled ?? DEFAULT_POS_TAX_SETTINGS.taxEnabled,
    serviceOnDineIn: input.serviceOnDineIn ?? DEFAULT_POS_TAX_SETTINGS.serviceOnDineIn,
    serviceOnTakeaway: input.serviceOnTakeaway ?? DEFAULT_POS_TAX_SETTINGS.serviceOnTakeaway,
    serviceOnDelivery: input.serviceOnDelivery ?? DEFAULT_POS_TAX_SETTINGS.serviceOnDelivery,
    serviceOnOnline: input.serviceOnOnline ?? DEFAULT_POS_TAX_SETTINGS.serviceOnOnline,
    serviceOnFoodpanda: input.serviceOnFoodpanda ?? DEFAULT_POS_TAX_SETTINGS.serviceOnFoodpanda,
    serviceOnStaffFood: input.serviceOnStaffFood ?? DEFAULT_POS_TAX_SETTINGS.serviceOnStaffFood,
    taxOnDineIn: input.taxOnDineIn ?? DEFAULT_POS_TAX_SETTINGS.taxOnDineIn,
    taxOnTakeaway: input.taxOnTakeaway ?? DEFAULT_POS_TAX_SETTINGS.taxOnTakeaway,
    taxOnDelivery: input.taxOnDelivery ?? DEFAULT_POS_TAX_SETTINGS.taxOnDelivery,
    taxOnOnline: input.taxOnOnline ?? DEFAULT_POS_TAX_SETTINGS.taxOnOnline,
    taxOnFoodpanda: input.taxOnFoodpanda ?? DEFAULT_POS_TAX_SETTINGS.taxOnFoodpanda,
    taxOnStaffFood: input.taxOnStaffFood ?? DEFAULT_POS_TAX_SETTINGS.taxOnStaffFood,
  };
}

/** Map `/v1/accounting/tax` response into mobile POS rates. */
export function posTaxSettingsFromApi(tax: {
  serviceTaxPct: number;
  salesTaxPct: number;
  posCharges?: Partial<PosTaxSettings> | null;
}): PosTaxSettings {
  const charges = tax.posCharges ?? null;
  const serviceFromCharges =
    charges && Number.isFinite(Number(charges.servicePct)) ? Number(charges.servicePct) : null;
  const taxFromCharges =
    charges && Number.isFinite(Number(charges.taxPct)) ? Number(charges.taxPct) : null;
  return normalizePosTaxSettings({
    ...(charges ?? {}),
    // Prefer posCharges when present; otherwise legacy columns (never leave APK stuck on default 10).
    servicePct: serviceFromCharges ?? tax.serviceTaxPct,
    taxPct: taxFromCharges ?? tax.salesTaxPct,
    cashTaxPct:
      charges && Number.isFinite(Number(charges.cashTaxPct))
        ? Number(charges.cashTaxPct)
        : tax.salesTaxPct >= 15
          ? 16
          : tax.salesTaxPct,
  });
}

export type PaymentMethod = "cash" | "card" | "wallet" | "bank";

export type MobileOrderModeForService =
  | "dine-in"
  | "takeaway"
  | "delivery"
  | "online"
  | "foodpanda"
  | "staff-food";

function serviceEnabledForMode(
  settings: PosTaxSettings,
  mode?: MobileOrderModeForService | null,
): boolean {
  if (!mode || mode === "dine-in") return settings.serviceOnDineIn;
  if (mode === "takeaway") return settings.serviceOnTakeaway;
  if (mode === "delivery") return settings.serviceOnDelivery;
  if (mode === "online") return settings.serviceOnOnline;
  if (mode === "foodpanda") return settings.serviceOnFoodpanda;
  if (mode === "staff-food") return settings.serviceOnStaffFood;
  return settings.serviceOnDineIn;
}

function taxEnabledForMode(
  settings: PosTaxSettings,
  mode?: MobileOrderModeForService | null,
): boolean {
  if (!mode || mode === "dine-in") return settings.taxOnDineIn;
  if (mode === "takeaway") return settings.taxOnTakeaway;
  if (mode === "delivery") return settings.taxOnDelivery;
  if (mode === "online") return settings.taxOnOnline;
  if (mode === "foodpanda") return settings.taxOnFoodpanda;
  if (mode === "staff-food") return settings.taxOnStaffFood;
  return settings.taxOnDineIn;
}

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

export function effectiveTaxPctForMode(
  settings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS,
  mode?: MobileOrderModeForService | null,
  paymentMethod?: PaymentMethod,
): number {
  if (!settings.taxEnabled || !taxEnabledForMode(settings, mode)) return 0;
  return effectiveTaxPct(settings, paymentMethod);
}

/** Preview / unpaid bill uses cash GST as the primary estimate. */
export function previewTaxPct(settings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS): number {
  return effectiveTaxPct(settings, settings.taxByPaymentMethod ? "cash" : undefined);
}

export function effectiveServicePctForMode(
  settings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS,
  mode?: MobileOrderModeForService | null,
): number {
  const pct = Math.max(0, settings.servicePct);
  return serviceEnabledForMode(settings, mode) ? pct : 0;
}

export function calcServiceTaxTotals(
  subtotal: number,
  settings: PosTaxSettings = DEFAULT_POS_TAX_SETTINGS,
  paymentMethod?: PaymentMethod,
  orderMode?: MobileOrderModeForService | null,
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
  const servicePct = effectiveServicePctForMode(settings, orderMode);
  const service = Math.round(subtotal * (servicePct / 100));
  const taxable = Math.max(0, subtotal);
  const cashTaxPct = effectiveTaxPctForMode(settings, orderMode, "cash");
  const cardTaxPct = effectiveTaxPctForMode(settings, orderMode, "card");
  const cashTax = Math.round((taxable + service) * (cashTaxPct / 100));
  const cardTax = Math.round((taxable + service) * (cardTaxPct / 100));
  const taxPct = effectiveTaxPctForMode(settings, orderMode, paymentMethod ?? "cash");
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
