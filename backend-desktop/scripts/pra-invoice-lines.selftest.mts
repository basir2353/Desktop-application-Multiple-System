/**
 * Self-test for Real PRA line mapping.
 * Run: npx tsx scripts/pra-invoice-lines.selftest.mts
 */
import {
  allocateLineTaxes,
  buildBillPraSourceLines,
  parsePraSourceLines,
} from "../api/src/tax-authority/pra-invoice-lines.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const parsed = parsePraSourceLines(
  JSON.stringify([
    { label: "Chicken Karahi", qty: 1, unitPrice: 280 },
    { label: "Soft drink", qty: 2, unitPrice: 120 },
  ]),
);
assert(parsed[0]!.description === "Chicken Karahi", `got ${parsed[0]?.description}`);
assert(parsed[0]!.amount === 280, `amount ${parsed[0]?.amount}`);

const built = buildBillPraSourceLines({
  linesJson: JSON.stringify([{ label: "Chicken Karahi", qty: 1, unitPrice: 280 }]),
  subtotalPkr: 280,
  discountPkr: 0,
  servicePkr: 22,
  deliveryChargePkr: 0,
  taxPkr: 45,
});
assert(built.taxableAmountPkr === 302, `taxable ${built.taxableAmountPkr}`);
assert(built.lines[0]!.description === "Chicken Karahi", "item name");
assert(built.lines.some((l) => l.description === "Service charges"), "service line");
assert(built.lines.reduce((s, l) => s + l.tax, 0) === 45, "tax sum");
assert(built.taxableAmountPkr + 45 === 347, "Gross+ST=Net");

const allocated = allocateLineTaxes(
  [
    { description: "A", qty: 1, amount: 100, tax: 0 },
    { description: "B", qty: 1, amount: 100, tax: 0 },
  ],
  7,
);
assert(allocated.reduce((s, l) => s + l.tax, 0) === 7, "alloc");

console.log("OK", {
  ItemName: built.lines[0]!.description,
  TaxCharged: built.lines[0]!.tax,
  Gross: built.taxableAmountPkr,
  ST: 45,
  Net: 347,
});
