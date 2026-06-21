export type PosOrderMode = "dine-in" | "takeaway" | "delivery";

export type PosOrderModeLabel = "Dine-in" | "Takeaway" | "Delivery";

export const POS_ORDER_MODES: { id: PosOrderMode; label: PosOrderModeLabel }[] = [
  { id: "dine-in", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
];

export function posOrderModeLabel(mode: PosOrderMode): PosOrderModeLabel {
  return POS_ORDER_MODES.find((m) => m.id === mode)?.label ?? "Dine-in";
}

/** Stored on kitchen tickets and bills for channel reporting. */
export function posStationLabel(mode: PosOrderMode, tableLabel?: string): string {
  if (mode === "dine-in") return tableLabel?.trim() || "Dine-in";
  if (mode === "takeaway") return "Takeaway counter";
  return "Delivery";
}

export function posBillTableLabel(mode: PosOrderMode, tableLabel?: string): string {
  return posStationLabel(mode, tableLabel);
}

export function posDeliveryNotes(customerName: string, address: string): string | undefined {
  const name = customerName.trim();
  const addr = address.trim();
  if (!name && !addr) return undefined;
  if (name && addr) return `Delivery · ${name} · ${addr}`;
  return name ? `Delivery · ${name}` : `Delivery · ${addr}`;
}

export function posPrintTableLabel(mode: PosOrderMode, tableLabel?: string): string {
  if (mode === "dine-in") return tableLabel?.trim() || "No table";
  if (mode === "takeaway") return "Takeaway counter";
  return "Delivery";
}
