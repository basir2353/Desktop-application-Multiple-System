export type PosOrderMode =
  | "dine-in"
  | "takeaway"
  | "delivery"
  | "online"
  | "foodpanda";

export type PosOrderModeLabel =
  | "Dine-in"
  | "Takeaway"
  | "Delivery"
  | "Online Orders"
  | "Foodpanda Orders";

export const POS_ORDER_MODES: { id: PosOrderMode; label: PosOrderModeLabel }[] = [
  { id: "dine-in", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
  { id: "online", label: "Online Orders" },
  { id: "foodpanda", label: "Foodpanda Orders" },
];

export function posOrderModeLabel(mode: PosOrderMode): PosOrderModeLabel {
  return POS_ORDER_MODES.find((m) => m.id === mode)?.label ?? "Dine-in";
}

/** Stored on kitchen tickets and bills for channel reporting. */
export function posStationLabel(mode: PosOrderMode, tableLabel?: string): string {
  if (mode === "dine-in") return tableLabel?.trim() || "Dine-in";
  if (mode === "takeaway") return "Takeaway counter";
  if (mode === "delivery") return "Delivery";
  if (mode === "online") return "Online order";
  return "Foodpanda order";
}

export function posBillTableLabel(mode: PosOrderMode, tableLabel?: string): string {
  return posStationLabel(mode, tableLabel);
}

export function posDeliveryNotes(
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

export function posPrintTableLabel(mode: PosOrderMode, tableLabel?: string): string {
  if (mode === "dine-in") return tableLabel?.trim() || "No table";
  if (mode === "takeaway") return "Takeaway counter";
  if (mode === "delivery") return "Delivery";
  if (mode === "online") return "Online order";
  return "Foodpanda order";
}

/** Infer POS mode from a stored station/table label. */
export function inferPosModeFromLabel(label: string): PosOrderMode {
  const lower = label.trim().toLowerCase();
  if (lower === "delivery" || lower.startsWith("dl-")) return "delivery";
  if (lower.includes("takeaway") || lower.startsWith("tw-")) return "takeaway";
  if (lower.includes("online")) return "online";
  if (lower.includes("foodpanda") || lower.startsWith("fp-")) return "foodpanda";
  return "dine-in";
}
