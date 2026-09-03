import type { TaxSettings } from "@platform/contracts";
import type { PosOrderMode } from "./posOrderMode";

export type PosSettings = {
  servicePct: number;
  taxPct: number;
  /** When enabled, tax rates vary by primary payment method at checkout. */
  taxByPaymentMethod: boolean;
  /** Tax % applied when payment is cash (default 16%). */
  cashTaxPct: number;
  /** Tax % applied when payment is card (default 8%). */
  cardTaxPct: number;
  /** Tax % for online / wallet / bank payments (default 8%). */
  onlineTaxPct: number;
  /** Master toggle — when off, no tax is added to tickets. */
  taxEnabled: boolean;
  /**
   * When enabled, apply `autoDiscountPct` on every sale automatically
   * (only to discountable / taxable-eligible lines). Original prices stay visible.
   */
  autoDiscountEnabled: boolean;
  /** Automatic bill discount percent (default 10). */
  autoDiscountPct: number;
  /** Apply service charge on dine-in (default on). */
  serviceOnDineIn: boolean;
  /** Apply service charge on takeaway orders (default off). */
  serviceOnTakeaway: boolean;
  /** Apply service charge on delivery orders (default off). */
  serviceOnDelivery: boolean;
  /** Apply service charge on online orders (default off). */
  serviceOnOnline: boolean;
  /** Apply service charge on Foodpanda orders (default off). */
  serviceOnFoodpanda: boolean;
  /** Apply service charge on staff-food orders (default on). */
  serviceOnStaffFood: boolean;
  /** Apply tax on dine-in (default on). */
  taxOnDineIn: boolean;
  /** Apply tax on takeaway (default on). */
  taxOnTakeaway: boolean;
  /** Apply tax on delivery (default on). */
  taxOnDelivery: boolean;
  /** Apply tax on online (default on). */
  taxOnOnline: boolean;
  /** Apply tax on Foodpanda (default on). */
  taxOnFoodpanda: boolean;
  /** Apply tax on staff-food (default on). */
  taxOnStaffFood: boolean;
  /**
   * When on, POS ticket shows bill note / item note fields.
   * Local UI preference (not synced to mobile tax API).
   */
  showBillNotes: boolean;
  /**
   * When on, POS menu shows a Full Screen button after order type is selected.
   * Local UI preference (not synced to mobile tax API).
   */
  fullScreenMenuEnabled: boolean;
  /**
   * Default full-screen / menu browse mode: categories first, or all items flat.
   * Local UI preference (not synced to mobile tax API).
   */
  menuViewMode: "category" | "all";
  autoPrintOrderDineIn: boolean;
  autoPrintOrderTakeaway: boolean;
  autoPrintOrderDelivery: boolean;
  autoPrintFinalDineIn: boolean;
  autoPrintFinalTakeaway: boolean;
  autoPrintFinalDelivery: boolean;
};

export const DEFAULT_POS_SETTINGS: PosSettings = {
  servicePct: 10,
  taxPct: 15,
  taxByPaymentMethod: true,
  cashTaxPct: 16,
  cardTaxPct: 8,
  onlineTaxPct: 8,
  taxEnabled: true,
  autoDiscountEnabled: false,
  autoDiscountPct: 10,
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
  showBillNotes: true,
  fullScreenMenuEnabled: true,
  menuViewMode: "category",
  autoPrintOrderDineIn: false,
  autoPrintOrderTakeaway: false,
  autoPrintOrderDelivery: false,
  autoPrintFinalDineIn: true,
  autoPrintFinalTakeaway: true,
  autoPrintFinalDelivery: true,
};

export const POS_SETTINGS_CHANGED_EVENT = "pops-pos-settings-changed";

const STORAGE_KEY = "pops-pos-settings-v1";

function clampPct(value: number, max = 30): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function normalizePosSettings(input: Partial<PosSettings>): PosSettings {
  return {
    servicePct: clampPct(input.servicePct ?? DEFAULT_POS_SETTINGS.servicePct),
    taxPct: clampPct(input.taxPct ?? DEFAULT_POS_SETTINGS.taxPct),
    taxByPaymentMethod: input.taxByPaymentMethod ?? DEFAULT_POS_SETTINGS.taxByPaymentMethod,
    cashTaxPct: clampPct(input.cashTaxPct ?? DEFAULT_POS_SETTINGS.cashTaxPct),
    cardTaxPct: clampPct(input.cardTaxPct ?? DEFAULT_POS_SETTINGS.cardTaxPct),
    onlineTaxPct: clampPct(input.onlineTaxPct ?? DEFAULT_POS_SETTINGS.onlineTaxPct),
    taxEnabled: input.taxEnabled ?? DEFAULT_POS_SETTINGS.taxEnabled,
    autoDiscountEnabled: input.autoDiscountEnabled ?? DEFAULT_POS_SETTINGS.autoDiscountEnabled,
    autoDiscountPct: clampPct(input.autoDiscountPct ?? DEFAULT_POS_SETTINGS.autoDiscountPct, 50),
    serviceOnDineIn: input.serviceOnDineIn ?? DEFAULT_POS_SETTINGS.serviceOnDineIn,
    serviceOnTakeaway: input.serviceOnTakeaway ?? DEFAULT_POS_SETTINGS.serviceOnTakeaway,
    serviceOnDelivery: input.serviceOnDelivery ?? DEFAULT_POS_SETTINGS.serviceOnDelivery,
    serviceOnOnline: input.serviceOnOnline ?? DEFAULT_POS_SETTINGS.serviceOnOnline,
    serviceOnFoodpanda: input.serviceOnFoodpanda ?? DEFAULT_POS_SETTINGS.serviceOnFoodpanda,
    serviceOnStaffFood: input.serviceOnStaffFood ?? DEFAULT_POS_SETTINGS.serviceOnStaffFood,
    taxOnDineIn: input.taxOnDineIn ?? DEFAULT_POS_SETTINGS.taxOnDineIn,
    taxOnTakeaway: input.taxOnTakeaway ?? DEFAULT_POS_SETTINGS.taxOnTakeaway,
    taxOnDelivery: input.taxOnDelivery ?? DEFAULT_POS_SETTINGS.taxOnDelivery,
    taxOnOnline: input.taxOnOnline ?? DEFAULT_POS_SETTINGS.taxOnOnline,
    taxOnFoodpanda: input.taxOnFoodpanda ?? DEFAULT_POS_SETTINGS.taxOnFoodpanda,
    taxOnStaffFood: input.taxOnStaffFood ?? DEFAULT_POS_SETTINGS.taxOnStaffFood,
    showBillNotes: input.showBillNotes ?? DEFAULT_POS_SETTINGS.showBillNotes,
    fullScreenMenuEnabled: input.fullScreenMenuEnabled ?? DEFAULT_POS_SETTINGS.fullScreenMenuEnabled,
    menuViewMode: input.menuViewMode === "all" ? "all" : "category",
    autoPrintOrderDineIn: input.autoPrintOrderDineIn ?? DEFAULT_POS_SETTINGS.autoPrintOrderDineIn,
    autoPrintOrderTakeaway: input.autoPrintOrderTakeaway ?? DEFAULT_POS_SETTINGS.autoPrintOrderTakeaway,
    autoPrintOrderDelivery: input.autoPrintOrderDelivery ?? DEFAULT_POS_SETTINGS.autoPrintOrderDelivery,
    autoPrintFinalDineIn: input.autoPrintFinalDineIn ?? DEFAULT_POS_SETTINGS.autoPrintFinalDineIn,
    autoPrintFinalTakeaway: input.autoPrintFinalTakeaway ?? DEFAULT_POS_SETTINGS.autoPrintFinalTakeaway,
    autoPrintFinalDelivery: input.autoPrintFinalDelivery ?? DEFAULT_POS_SETTINGS.autoPrintFinalDelivery,
  };
}

export function autoPrintOrderForMode(settings: PosSettings, mode: PosOrderMode | string): boolean {
  if (mode === "takeaway") return settings.autoPrintOrderTakeaway;
  if (mode === "delivery") return settings.autoPrintOrderDelivery;
  if (mode === "dine-in") return settings.autoPrintOrderDineIn;
  return false;
}

export function autoPrintFinalForMode(settings: PosSettings, mode: PosOrderMode | string): boolean {
  if (mode === "takeaway") return settings.autoPrintFinalTakeaway;
  if (mode === "delivery") return settings.autoPrintFinalDelivery;
  if (mode === "dine-in") return settings.autoPrintFinalDineIn;
  return false;
}

function serviceEnabledForMode(
  settings: PosSettings,
  mode: PosOrderMode | string | null | undefined,
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
  settings: PosSettings,
  mode: PosOrderMode | string | null | undefined,
): boolean {
  if (!mode || mode === "dine-in") return settings.taxOnDineIn;
  if (mode === "takeaway") return settings.taxOnTakeaway;
  if (mode === "delivery") return settings.taxOnDelivery;
  if (mode === "online") return settings.taxOnOnline;
  if (mode === "foodpanda") return settings.taxOnFoodpanda;
  if (mode === "staff-food") return settings.taxOnStaffFood;
  return settings.taxOnDineIn;
}

/** Whether tax applies for this order type (ignores payment-method rates). */
export function isTaxEnabledForOrderMode(
  settings: PosSettings,
  mode: PosOrderMode | string | null | undefined,
): boolean {
  return settings.taxEnabled && taxEnabledForMode(settings, mode);
}

/**
 * Service % for a POS order mode. Uses the configured rate only when that
 * order type's service toggle is on.
 */
export function effectiveServicePctForMode(
  settings: PosSettings,
  mode: PosOrderMode | string | null | undefined,
): number {
  const pct = Math.max(0, settings.servicePct);
  return serviceEnabledForMode(settings, mode) ? pct : 0;
}

export function loadPosSettings(branchCode: string | undefined): PosSettings {
  if (!branchCode) return DEFAULT_POS_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POS_SETTINGS;
    const parsed = JSON.parse(raw) as Record<string, Partial<PosSettings>>;
    let next = normalizePosSettings(parsed[branchCode] ?? DEFAULT_POS_SETTINGS);
    // One-time: Takeaway / Delivery tax off — only Dine-in taxed (business rule).
    const migKey = `pops-pos-tax-dinein-only-v1:${branchCode}`;
    if (!localStorage.getItem(migKey)) {
      next = normalizePosSettings({
        ...next,
        taxOnTakeaway: false,
        taxOnDelivery: false,
        taxOnDineIn: true,
      });
      parsed[branchCode] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(migKey, "1");
    }
    return next;
  } catch {
    return DEFAULT_POS_SETTINGS;
  }
}

export function savePosSettings(branchCode: string, settings: PosSettings): void {
  const next = normalizePosSettings(settings);
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? (JSON.parse(raw) as Record<string, PosSettings>) : {};
  parsed[branchCode] = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  window.dispatchEvent(
    new CustomEvent(POS_SETTINGS_CHANGED_EVENT, { detail: { branchCode, settings: next } }),
  );
}

/** Map API tax settings → POS charges (cloud is source of truth when present). */
export function posSettingsFromTaxApi(
  tax: TaxSettings,
  /** Preserve local-only UI flags across cloud sync. */
  localUi?: Partial<Pick<PosSettings, "showBillNotes" | "fullScreenMenuEnabled" | "menuViewMode" |
    "autoPrintOrderDineIn" | "autoPrintOrderTakeaway" | "autoPrintOrderDelivery" |
    "autoPrintFinalDineIn" | "autoPrintFinalTakeaway" | "autoPrintFinalDelivery">>,
): PosSettings {
  const charges = tax.posCharges;
  if (charges) {
    return normalizePosSettings({
      ...charges,
      servicePct: Number.isFinite(charges.servicePct) ? charges.servicePct : tax.serviceTaxPct,
      taxPct: Number.isFinite(charges.taxPct) ? charges.taxPct : tax.salesTaxPct,
      showBillNotes: localUi?.showBillNotes,
      fullScreenMenuEnabled: localUi?.fullScreenMenuEnabled,
      menuViewMode: localUi?.menuViewMode,
      autoPrintOrderDineIn: localUi?.autoPrintOrderDineIn,
      autoPrintOrderTakeaway: localUi?.autoPrintOrderTakeaway,
      autoPrintOrderDelivery: localUi?.autoPrintOrderDelivery,
      autoPrintFinalDineIn: localUi?.autoPrintFinalDineIn,
      autoPrintFinalTakeaway: localUi?.autoPrintFinalTakeaway,
      autoPrintFinalDelivery: localUi?.autoPrintFinalDelivery,
    });
  }
  return normalizePosSettings({
    servicePct: tax.serviceTaxPct,
    taxPct: tax.salesTaxPct,
    cashTaxPct: tax.salesTaxPct >= 15 ? 16 : tax.salesTaxPct,
    cardTaxPct: DEFAULT_POS_SETTINGS.cardTaxPct,
    onlineTaxPct: DEFAULT_POS_SETTINGS.onlineTaxPct,
    showBillNotes: localUi?.showBillNotes,
    fullScreenMenuEnabled: localUi?.fullScreenMenuEnabled,
    menuViewMode: localUi?.menuViewMode,
    autoPrintOrderDineIn: localUi?.autoPrintOrderDineIn,
    autoPrintOrderTakeaway: localUi?.autoPrintOrderTakeaway,
    autoPrintOrderDelivery: localUi?.autoPrintOrderDelivery,
    autoPrintFinalDineIn: localUi?.autoPrintFinalDineIn,
    autoPrintFinalTakeaway: localUi?.autoPrintFinalTakeaway,
    autoPrintFinalDelivery: localUi?.autoPrintFinalDelivery,
  });
}

/** Persist to localStorage and push to Railway so mobile uses the same rates. */
export async function savePosSettingsSynced(
  branchCode: string,
  settings: PosSettings,
): Promise<PosSettings> {
  const next = normalizePosSettings(settings);
  savePosSettings(branchCode, next);
  const { updateTaxSettings } = await import("../api/accounting");
  await updateTaxSettings({
    branchCode,
    serviceTaxPct: next.servicePct,
    salesTaxPct: next.taxByPaymentMethod ? next.cashTaxPct : next.taxPct,
    posCharges: {
      servicePct: next.servicePct,
      taxPct: next.taxPct,
      taxByPaymentMethod: next.taxByPaymentMethod,
      cashTaxPct: next.cashTaxPct,
      cardTaxPct: next.cardTaxPct,
      onlineTaxPct: next.onlineTaxPct,
      taxEnabled: next.taxEnabled,
      autoDiscountEnabled: next.autoDiscountEnabled,
      autoDiscountPct: next.autoDiscountPct,
      serviceOnDineIn: next.serviceOnDineIn,
      serviceOnTakeaway: next.serviceOnTakeaway,
      serviceOnDelivery: next.serviceOnDelivery,
      serviceOnOnline: next.serviceOnOnline,
      serviceOnFoodpanda: next.serviceOnFoodpanda,
      serviceOnStaffFood: next.serviceOnStaffFood,
      taxOnDineIn: next.taxOnDineIn,
      taxOnTakeaway: next.taxOnTakeaway,
      taxOnDelivery: next.taxOnDelivery,
      taxOnOnline: next.taxOnOnline,
      taxOnFoodpanda: next.taxOnFoodpanda,
      taxOnStaffFood: next.taxOnStaffFood,
      autoPrintOrderDineIn: next.autoPrintOrderDineIn,
      autoPrintOrderTakeaway: next.autoPrintOrderTakeaway,
      autoPrintOrderDelivery: next.autoPrintOrderDelivery,
      autoPrintFinalDineIn: next.autoPrintFinalDineIn,
      autoPrintFinalTakeaway: next.autoPrintFinalTakeaway,
      autoPrintFinalDelivery: next.autoPrintFinalDelivery,
    },
  });
  return next;
}

/** Effective tax % for a ticket given POS settings and optional payment method. */
export function effectiveTaxPct(
  settings: PosSettings,
  paymentMethod?: "cash" | "card" | "wallet" | "bank",
): number {
  if (!settings.taxEnabled) return 0;
  if (settings.taxByPaymentMethod && paymentMethod) {
    if (paymentMethod === "cash") return settings.cashTaxPct;
    if (paymentMethod === "card") return settings.cardTaxPct;
    // wallet + bank = online
    return settings.onlineTaxPct;
  }
  return settings.taxPct;
}

/** Tax % for a specific order type (0 when that mode's tax toggle is off). */
export function effectiveTaxPctForMode(
  settings: PosSettings,
  mode: PosOrderMode | string | null | undefined,
  paymentMethod?: "cash" | "card" | "wallet" | "bank",
): number {
  if (!settings.taxEnabled) return 0;
  if (!taxEnabledForMode(settings, mode)) return 0;
  return effectiveTaxPct(settings, paymentMethod);
}
