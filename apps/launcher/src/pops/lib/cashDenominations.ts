export type CashDenomination = {
  label: string;
  value: number;
};

/** Standard PKR notes/coins for cashier in/out counting. */
export const PKR_CASH_DENOMINATIONS: CashDenomination[] = [
  { label: "5000", value: 5000 },
  { label: "1000", value: 1000 },
  { label: "500", value: 500 },
  { label: "100", value: 100 },
  { label: "50", value: 50 },
  { label: "Rs.20", value: 20 },
  { label: "10", value: 10 },
];

export function emptyDenominationQty(): Record<number, string> {
  return Object.fromEntries(PKR_CASH_DENOMINATIONS.map((d) => [d.value, ""]));
}

export function parseDenominationQty(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function rowTotalForDenomination(value: number, qtyRaw: string): number {
  return value * parseDenominationQty(qtyRaw);
}

export function sumDenominationCash(qtyByValue: Record<number, string>): number {
  return PKR_CASH_DENOMINATIONS.reduce(
    (sum, d) => sum + rowTotalForDenomination(d.value, qtyByValue[d.value] ?? ""),
    0,
  );
}

export function formatCashAmount(amount: number): string {
  return amount.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
