/** Compact money hint for select / picker rows (supplier, employee, …). */
export function formatSelectBalance(amount: number | null | undefined, label = "Bal"): string {
  if (amount == null || Number.isNaN(Number(amount))) return `${label} —`;
  return `${label} Rs ${Number(amount).toLocaleString("en-PK")}`;
}

/** Compact stock hint for ingredient / product select rows. */
export function formatSelectQty(qty: number, unit?: string | null): string {
  const u = (unit ?? "").trim();
  return u ? `Qty ${qty} ${u}` : `Qty ${qty}`;
}
