import { describe, expect, it } from "vitest";
import { taxSettingsSchema, updateTaxSettingsSchema } from "@platform/contracts";

/** Contract tests for GET/PATCH /v1/accounting/tax — used by EXE + APK. */
describe("tax settings API contracts", () => {
  it("accepts GET-shaped payload with posCharges (dynamic Settings sync)", () => {
    const parsed = taxSettingsSchema.parse({
      taxName: "GST",
      salesTaxPct: 16,
      serviceTaxPct: 10,
      taxRegistrationNo: "123",
      taxCollected: 5000,
      taxPaid: 1000,
      posCharges: {
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
      },
    });
    expect(parsed.posCharges?.cashTaxPct).toBe(16);
    expect(parsed.posCharges?.taxOnTakeaway).toBe(false);
  });

  it("accepts legacy GET without posCharges", () => {
    const parsed = taxSettingsSchema.parse({
      taxName: "GST",
      salesTaxPct: 15,
      serviceTaxPct: 10,
      taxRegistrationNo: null,
      taxCollected: 0,
      taxPaid: 0,
    });
    expect(parsed.posCharges).toBeUndefined();
  });

  it("accepts PATCH body from desktop savePosSettingsSynced", () => {
    const body = updateTaxSettingsSchema.parse({
      branchCode: "MAIN",
      serviceTaxPct: 10,
      salesTaxPct: 16,
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
        taxOnDineIn: true,
        taxOnTakeaway: false,
        taxOnDelivery: false,
      },
    });
    expect(body.branchCode).toBe("MAIN");
    expect(body.posCharges?.cashTaxPct).toBe(16);
  });
});
