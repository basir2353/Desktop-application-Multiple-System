import { describe, expect, it } from "vitest";
import { taxSettingsSchema } from "@platform/contracts";
import {
  DEFAULT_POS_SETTINGS,
  effectiveServicePctForMode,
  effectiveTaxPct,
  effectiveTaxPctForMode,
  normalizePosSettings,
  posSettingsFromTaxApi,
} from "../posSettings";

describe("posSettingsFromTaxApi (desktop / EXE)", () => {
  it("maps cloud posCharges as source of truth", () => {
    const tax = taxSettingsSchema.parse({
      taxName: "GST",
      salesTaxPct: 15,
      serviceTaxPct: 10,
      taxRegistrationNo: null,
      taxCollected: 0,
      taxPaid: 0,
      posCharges: {
        servicePct: 5,
        taxPct: 12,
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

    const settings = posSettingsFromTaxApi(tax);
    expect(settings.servicePct).toBe(5);
    expect(settings.taxPct).toBe(12);
    expect(settings.cashTaxPct).toBe(16);
    expect(settings.cardTaxPct).toBe(8);
    expect(settings.taxOnTakeaway).toBe(false);
  });

  it("falls back to legacy sales/service columns when posCharges missing", () => {
    const tax = taxSettingsSchema.parse({
      taxName: "GST",
      salesTaxPct: 18,
      serviceTaxPct: 7,
      taxRegistrationNo: null,
      taxCollected: 0,
      taxPaid: 0,
    });

    const settings = posSettingsFromTaxApi(tax);
    expect(settings.servicePct).toBe(7);
    expect(settings.taxPct).toBe(18);
    expect(settings.cashTaxPct).toBe(16); // salesTaxPct >= 15 → default cash 16
  });

  it("preserves local-only showBillNotes across cloud sync", () => {
    const tax = taxSettingsSchema.parse({
      taxName: "GST",
      salesTaxPct: 15,
      serviceTaxPct: 10,
      taxRegistrationNo: null,
      taxCollected: 0,
      taxPaid: 0,
      posCharges: {
        servicePct: 10,
        taxPct: 15,
        taxByPaymentMethod: true,
        cashTaxPct: 16,
        cardTaxPct: 8,
        onlineTaxPct: 8,
        taxEnabled: true,
        serviceOnTakeaway: false,
        serviceOnDelivery: false,
      },
    });

    const settings = posSettingsFromTaxApi(tax, { showBillNotes: false });
    expect(settings.showBillNotes).toBe(false);
  });
});

describe("effective tax / service by mode + payment (desktop)", () => {
  const settings = normalizePosSettings({
    ...DEFAULT_POS_SETTINGS,
    taxByPaymentMethod: true,
    cashTaxPct: 16,
    cardTaxPct: 8,
    onlineTaxPct: 8,
    servicePct: 10,
    taxOnDineIn: true,
    taxOnTakeaway: false,
    taxOnDelivery: false,
    serviceOnDineIn: true,
    serviceOnTakeaway: false,
    serviceOnDelivery: false,
  });

  it("cash vs card rates", () => {
    expect(effectiveTaxPct(settings, "cash")).toBe(16);
    expect(effectiveTaxPct(settings, "card")).toBe(8);
    expect(effectiveTaxPct(settings, "wallet")).toBe(8);
  });

  it("dine-in gets tax+service; takeaway/delivery get 0 when toggles off", () => {
    expect(effectiveTaxPctForMode(settings, "dine-in", "cash")).toBe(16);
    expect(effectiveTaxPctForMode(settings, "takeaway", "cash")).toBe(0);
    expect(effectiveTaxPctForMode(settings, "delivery", "cash")).toBe(0);
    expect(effectiveServicePctForMode(settings, "dine-in")).toBe(10);
    expect(effectiveServicePctForMode(settings, "takeaway")).toBe(0);
    expect(effectiveServicePctForMode(settings, "delivery")).toBe(0);
  });

  it("taxEnabled false zeroes all tax", () => {
    const off = normalizePosSettings({ ...settings, taxEnabled: false });
    expect(effectiveTaxPctForMode(off, "dine-in", "cash")).toBe(0);
  });

  it("dynamic custom rates apply after Settings change", () => {
    const custom = normalizePosSettings({
      ...settings,
      cashTaxPct: 20,
      cardTaxPct: 5,
      servicePct: 12,
    });
    expect(effectiveTaxPctForMode(custom, "dine-in", "cash")).toBe(20);
    expect(effectiveTaxPctForMode(custom, "dine-in", "card")).toBe(5);
    expect(effectiveServicePctForMode(custom, "dine-in")).toBe(12);
  });
});
