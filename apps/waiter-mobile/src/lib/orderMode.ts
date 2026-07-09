export type MobileOrderMode = "dine-in" | "takeaway" | "delivery";

export const MOBILE_ORDER_MODES: { id: MobileOrderMode; label: string }[] = [
  { id: "dine-in", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
];

export function stationLabelForMode(mode: MobileOrderMode, tableNumber?: string | null): string {
  if (mode === "dine-in") return tableNumber ? `Table ${tableNumber}` : "Dine-in";
  if (mode === "takeaway") return "Takeaway counter";
  return "Delivery";
}

export function deliveryNotes(
  customerName: string,
  phone: string,
  address: string,
): string | undefined {
  const name = customerName.trim();
  const ph = phone.trim();
  const addr = address.trim();
  if (!name && !ph && !addr) return undefined;
  if (name && ph && addr) return `Delivery · ${name} · ${ph} · ${addr}`;
  if (name && ph) return `Delivery · ${name} · ${ph}`;
  if (name && addr) return `Delivery · ${name} · ${addr}`;
  if (ph && addr) return `Delivery · ${ph} · ${addr}`;
  if (name) return `Delivery · ${name}`;
  if (ph) return `Delivery · ${ph}`;
  return `Delivery · ${addr}`;
}

export function inferOrderModeFromStation(stationLabel: string): MobileOrderMode {
  const label = stationLabel.trim().toLowerCase();
  if (label.includes("delivery")) return "delivery";
  if (label.includes("takeaway")) return "takeaway";
  return "dine-in";
}
