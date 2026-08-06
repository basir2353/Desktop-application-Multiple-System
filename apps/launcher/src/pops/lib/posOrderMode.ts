export type PosOrderMode =
  | "dine-in"
  | "takeaway"
  | "delivery"
  | "online"
  | "foodpanda"
  | "staff-food";

export type PosOrderModeLabel =
  | "Dine-in"
  | "Takeaway"
  | "Delivery"
  | "Online Orders"
  | "Foodpanda Orders"
  | "Staff Food";

export const POS_ORDER_MODES: { id: PosOrderMode; label: PosOrderModeLabel }[] = [
  { id: "dine-in", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
  { id: "online", label: "Online Orders" },
  { id: "foodpanda", label: "Foodpanda Orders" },
  { id: "staff-food", label: "Staff Food" },
];

export function posOrderModeLabel(mode: PosOrderMode): PosOrderModeLabel {
  return POS_ORDER_MODES.find((m) => m.id === mode)?.label ?? "Dine-in";
}

export type StaffFoodConsumerType = "staff" | "guest";

/** Stored on kitchen tickets and bills for channel reporting. */
export function posStationLabel(
  mode: PosOrderMode,
  tableLabel?: string,
  staffPerson?: string,
  staffConsumerType: StaffFoodConsumerType = "staff",
): string {
  if (mode === "dine-in") return tableLabel?.trim() || "Dine-in";
  if (mode === "takeaway") return "Takeaway";
  if (mode === "delivery") return "Delivery";
  if (mode === "online") return "Online order";
  if (mode === "staff-food") {
    const name = staffPerson?.trim();
    if (!name) return "Staff food";
    return staffConsumerType === "guest" ? `Staff food · Guest: ${name}` : `Staff food · ${name}`;
  }
  return "Foodpanda order";
}

export function posBillTableLabel(
  mode: PosOrderMode,
  tableLabel?: string,
  staffPerson?: string,
  staffConsumerType: StaffFoodConsumerType = "staff",
): string {
  return posStationLabel(mode, tableLabel, staffPerson, staffConsumerType);
}

export function posDeliveryNotes(
  customerName: string,
  phone: string,
  address: string,
  riderName?: string,
): string | undefined {
  const base = posCustomerOrderNotes("Delivery", customerName, phone, address);
  const rider = riderName?.trim();
  if (!rider) return base;
  if (!base) return `Delivery · Rider: ${rider}`;
  return `${base} · Rider: ${rider}`;
}

/** Customer / phone / address notes for takeaway, delivery, online, etc. */
export function posCustomerOrderNotes(
  channelLabel: string,
  customerName: string,
  phone: string,
  address?: string,
): string | undefined {
  const prefix = channelLabel.trim() || "Order";
  const name = customerName.trim();
  const ph = phone.trim();
  const addr = (address ?? "").trim();
  if (!name && !ph && !addr) return undefined;
  if (name && ph && addr) return `${prefix} · ${name} · ${ph} · ${addr}`;
  if (name && ph) return `${prefix} · ${name} · ${ph}`;
  if (name && addr) return `${prefix} · ${name} · ${addr}`;
  if (ph && addr) return `${prefix} · ${ph} · ${addr}`;
  if (name) return `${prefix} · ${name}`;
  if (ph) return `${prefix} · ${ph}`;
  return `${prefix} · ${addr}`;
}

/** Modes that show the Customer details panel on the ticket. */
export const POS_CUSTOMER_PANEL_MODES: readonly PosOrderMode[] = [
  "dine-in",
  "takeaway",
  "delivery",
  "online",
  "foodpanda",
];

/**
 * Modes where confirming customer details auto-prints the invoice/receipt
 * (counter pickup channels — not takeaway: takeaway only saves details).
 */
export const POS_CUSTOMER_AUTOPRINT_MODES: readonly PosOrderMode[] = [
  "online",
  "foodpanda",
];

export function posModeShowsCustomerPanel(mode: PosOrderMode): boolean {
  return POS_CUSTOMER_PANEL_MODES.includes(mode);
}

export function posModeAutoPrintsOnCustomer(mode: PosOrderMode): boolean {
  return POS_CUSTOMER_AUTOPRINT_MODES.includes(mode);
}

/** Notes stored on tickets/bills so print shows who took staff food and when. */
export function posStaffFoodNotes(
  consumerType: StaffFoodConsumerType,
  personName: string,
  extraNotes?: string,
): string | undefined {
  const name = personName.trim();
  if (!name) return undefined;
  const time = new Date().toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const typeLabel = consumerType === "guest" ? "Guest" : "Staff";
  const base = `Staff food · ${typeLabel} · ${name} · ${time}`;
  const extra = extraNotes?.trim();
  return extra ? `${base} · ${extra}` : base;
}

export function parseStaffFoodPersonFromStation(label: string): {
  consumerType: StaffFoodConsumerType;
  personName: string;
} | null {
  const trimmed = label.trim();
  if (!/staff food/i.test(trimmed)) return null;
  const guestMatch = trimmed.match(/^Staff food\s*·\s*Guest:\s*(.+)$/i);
  if (guestMatch?.[1]) {
    return { consumerType: "guest", personName: guestMatch[1].trim() };
  }
  const staffMatch = trimmed.match(/^Staff food\s*·\s*(.+)$/i);
  if (staffMatch?.[1]) {
    return { consumerType: "staff", personName: staffMatch[1].trim() };
  }
  return { consumerType: "staff", personName: "" };
}

export function posPrintTableLabel(
  mode: PosOrderMode,
  tableLabel?: string,
  staffPerson?: string,
  staffConsumerType: StaffFoodConsumerType = "staff",
): string {
  if (mode === "dine-in") return tableLabel?.trim() || "No table";
  // Takeaway/Delivery mode is already printed as modeLabel — avoid duplicate lines.
  if (mode === "takeaway") return "";
  if (mode === "delivery") {
    const extra = tableLabel?.trim() || "";
    if (!extra || extra.toLowerCase() === "delivery") return "";
    return extra;
  }
  if (mode === "online") return "Online order";
  if (mode === "staff-food") {
    return posStationLabel(mode, tableLabel, staffPerson, staffConsumerType);
  }
  return "Foodpanda order";
}

/** Short label for Latest orders cards (hides truncated "Takeaway counter"). */
export function formatPosStationDisplay(
  stationLabel: string,
  orderMode?: string,
): string {
  const raw = stationLabel.trim();
  const lower = raw.toLowerCase();
  if (orderMode === "Takeaway" || lower === "takeaway" || lower.startsWith("takeaway ")) {
    return "Takeaway";
  }
  if (orderMode === "Delivery" || lower === "delivery" || lower.startsWith("delivery ")) {
    return "Delivery";
  }
  return raw;
}

/** Infer POS mode from a stored station/table label. */
export function inferPosModeFromLabel(label: string): PosOrderMode {
  const lower = label.trim().toLowerCase();
  if (lower === "delivery" || lower.startsWith("dl-")) return "delivery";
  if (lower.includes("takeaway") || lower.startsWith("tw-")) return "takeaway";
  if (lower.includes("online")) return "online";
  if (lower.includes("foodpanda") || lower.startsWith("fp-")) return "foodpanda";
  if (lower.includes("staff food") || lower.includes("staff-food") || lower.startsWith("sf-")) {
    return "staff-food";
  }
  return "dine-in";
}
