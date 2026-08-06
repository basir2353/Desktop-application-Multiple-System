import { describe, expect, it } from "vitest";
import { taxSettingsSchema } from "@platform/contracts";
import {
  calcServiceTaxTotals,
  DEFAULT_POS_TAX_SETTINGS,
  effectiveServicePctForMode,
  effectiveTaxPctForMode,
  normalizePosTaxSettings,
  posTaxSettingsFromApi,
} from "../posTaxSettings";

describe("posTaxSettingsFromApi (waiter APK)", () => {
  it("prefers posCharges over legacy columns", () => {
    const tax = taxSettingsSchema.parse({
      taxName: "GST",
      salesTaxPct: 15,
      serviceTaxPct: 10,
      taxRegistrationNo: null,
      taxCollected: 0,
      taxPaid: 0,
      posCharges: {
        servicePct: 6,
        taxPct: 11,
        taxByPaymentMethod: true,
        cashTaxPct: 16,
        cardTaxPct: 8,
        onlineTaxPct: 8,
        taxEnabled: true,
        serviceOnTakeaway: false,
        serviceOnDelivery: false,
        taxOnDineIn: true,
        taxOnTakeaway: false,
        taxOnDelivery: false,
      },
    });

    const settings = posTaxSettingsFromApi(tax);
    expect(settings.servicePct).toBe(6);
    expect(settings.taxPct).toBe(11);
    expect(settings.cashTaxPct).toBe(16);
    expect(settings.taxOnTakeaway).toBe(false);
  });

  it("uses legacy columns when posCharges absent (never stuck on hardcoded defaults only)", () => {
    const tax = taxSettingsSchema.parse({
      taxName: "GST",
      salesTaxPct: 18,
      serviceTaxPct: 7,
      taxRegistrationNo: null,
      taxCollected: 0,
      taxPaid: 0,
    });

    const settings = posTaxSettingsFromApi(tax);
    expect(settings.servicePct).toBe(7);
    expect(settings.taxPct).toBe(18);
    expect(settings.cashTaxPct).toBe(16);
  });
});

describe("calcServiceTaxTotals mode + payment (waiter APK)", () => {
  const settings = normalizePosTaxSettings({
    ...DEFAULT_POS_TAX_SETTINGS,
    servicePct: 10,
    cashTaxPct: 16,
    cardTaxPct: 8,
    taxByPaymentMethod: true,
    taxOnDineIn: true,
    taxOnTakeaway: false,
    taxOnDelivery: false,
    serviceOnDineIn: true,
    serviceOnTakeaway: false,
    serviceOnDelivery: false,
  });

  it("dine-in cash: service + cash GST on (subtotal + service)", () => {
    const t = calcServiceTaxTotals(1000, settings, "cash", "dine-in");
    expect(t.servicePct).toBe(10);
    expect(t.service).toBe(100);
    expect(t.taxPct).toBe(16);
    expect(t.tax).toBe(Math.round(1100 * 0.16));
    expect(t.total).toBe(1000 + 100 + t.tax);
  });

  it("takeaway: no service / no tax when toggles off", () => {
    const t = calcServiceTaxTotals(1000, settings, "cash", "takeaway");
    expect(t.service).toBe(0);
    expect(t.tax).toBe(0);
    expect(t.total).toBe(1000);
    expect(effectiveTaxPctForMode(settings, "takeaway", "cash")).toBe(0);
    expect(effectiveServicePctForMode(settings, "takeaway")).toBe(0);
  });

  it("card rate differs from cash on dine-in", () => {
    const cash = calcServiceTaxTotals(1000, settings, "cash", "dine-in");
    const card = calcServiceTaxTotals(1000, settings, "card", "dine-in");
    expect(cash.taxPct).toBe(16);
    expect(card.taxPct).toBe(8);
    expect(card.tax).toBeLessThan(cash.tax);
  });

  it("Settings change (20% cash) applies immediately in calc", () => {
    const custom = normalizePosTaxSettings({ ...settings, cashTaxPct: 20 });
    const t = calcServiceTaxTotals(1000, custom, "cash", "dine-in");
    expect(t.taxPct).toBe(20);
    expect(t.tax).toBe(Math.round(1100 * 0.2));
  });
});
