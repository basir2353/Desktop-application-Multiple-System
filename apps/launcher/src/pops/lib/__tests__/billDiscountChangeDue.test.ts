import { describe, expect, it } from "vitest";
import {
  discountAmountFromTicketNotes,
  packOrderNotesWithCashReceived,
  parseCashReceivedFromNotes,
  receiptNotesWithoutPackedDeliveryContact,
} from "../posLoadOrder";
import { computeTicketTotals } from "../posDiscount";

describe("Option 16: discount in cash/card net", () => {
  it("parses DiscPct from notes into PKR discount", () => {
    expect(discountAmountFromTicketNotes("DiscPct:20", 2613)).toBe(523);
  });

  it("net total after 20% discount matches receipt math", () => {
    const discount = discountAmountFromTicketNotes("DiscPct:20", 2613);
    const totals = computeTicketTotals(2613, discount, 8, 16, 0);
    expect(totals.discount).toBe(523);
    expect(totals.service).toBe(167);
    expect(totals.tax).toBe(334);
    expect(totals.total).toBe(2591);
  });
});

describe("Option 15: cash received / change due", () => {
  it("packs and parses CashRecv above bill total", () => {
    const notes = packOrderNotesWithCashReceived("Table H7", 5000, 2591);
    expect(notes).toContain("CashRecv:5000");
    expect(parseCashReceivedFromNotes(notes)).toBe(5000);
    expect(receiptNotesWithoutPackedDeliveryContact(notes, false)).toBe("Table H7");
  });

  it("does not pack when tendered equals total", () => {
    expect(packOrderNotesWithCashReceived(undefined, 2591, 2591)).toBeUndefined();
  });
});
