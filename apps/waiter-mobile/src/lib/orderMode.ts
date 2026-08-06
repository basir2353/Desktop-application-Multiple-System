export type MobileOrderMode = "dine-in" | "takeaway" | "delivery";

export const MOBILE_ORDER_MODES: { id: MobileOrderMode; label: string }[] = [
  { id: "dine-in", label: "Dine-in" },
  { id: "takeaway", label: "Takeaway" },
  { id: "delivery", label: "Delivery" },
];

export function stationLabelForMode(mode: MobileOrderMode, tableNumber?: string | null): string {
  if (mode === "dine-in") return tableNumber ? `Table ${tableNumber}` : "Dine-in";
  if (mode === "takeaway") return "Takeaway";
  return "Delivery";
}

export function deliveryNotes(
  customerName: string,
  phone: string,
  address: string,
  riderName?: string,
): string | undefined {
  const name = customerName.trim();
  const ph = phone.trim();
  const addr = address.trim();
  const rider = riderName?.trim();
  let base: string | undefined;
  if (!name && !ph && !addr) {
    base = undefined;
  } else if (name && ph && addr) {
    base = `Delivery · ${name} · ${ph} · ${addr}`;
  } else if (name && ph) {
    base = `Delivery · ${name} · ${ph}`;
  } else if (name && addr) {
    base = `Delivery · ${name} · ${addr}`;
  } else if (ph && addr) {
    base = `Delivery · ${ph} · ${addr}`;
  } else if (name) {
    base = `Delivery · ${name}`;
  } else if (ph) {
    base = `Delivery · ${ph}`;
  } else {
    base = `Delivery · ${addr}`;
  }
  if (!rider) return base;
  if (!base) return `Delivery · Rider: ${rider}`;
  return `${base} · Rider: ${rider}`;
}

const CUSTOMER_NOTES_CHANNEL_RE =
  /^(?:Delivery|Takeaway|Dine-in|Online|Foodpanda|Online order|Foodpanda order)\b/i;

export function parseDeliveryFieldsFromNotes(notes: string | null | undefined): {
  customer: string;
  phone: string;
  address: string;
  riderName: string;
} {
  if (!notes) return { customer: "", phone: "", address: "", riderName: "" };
  let trimmed = notes.trim();
  if (!trimmed) return { customer: "", phone: "", address: "", riderName: "" };
  if (!CUSTOMER_NOTES_CHANNEL_RE.test(trimmed)) {
    const embedded = trimmed.match(
      /(?:^|\s·\s*)((?:Delivery|Takeaway|Dine-in|Online|Foodpanda|Online order|Foodpanda order)\s*·[\s\S]*)$/i,
    );
    if (embedded?.[1]) trimmed = embedded[1].trim();
    else return { customer: "", phone: "", address: "", riderName: "" };
  }
  const body = trimmed.replace(
    /^(?:Delivery|Takeaway|Dine-in|Online|Foodpanda|Online order|Foodpanda order)\s*·\s*/i,
    "",
  );
  let parts = body.split(" · ").map((p) => p.trim()).filter(Boolean);

  let riderName = "";
  const riderIdx = parts.findIndex((p) => /^rider\s*:/i.test(p));
  if (riderIdx >= 0) {
    riderName = parts[riderIdx]!.replace(/^rider\s*:\s*/i, "").trim();
    parts = parts.filter((_, i) => i !== riderIdx);
  }

  parts = parts.filter(
    (p) => !/^Disc(?:Pct|Rs):\d+$/i.test(p) && !/^Note:\s*/i.test(p),
  );

  if (parts.length >= 3) {
    return {
      customer: parts[0] ?? "",
      phone: parts[1] ?? "",
      address: parts.slice(2).join(" · "),
      riderName,
    };
  }
  if (parts.length === 2) {
    const second = parts[1] ?? "";
    const looksLikePhone = /^[\d+\s()-]{7,}$/.test(second);
    if (looksLikePhone) {
      return { customer: parts[0] ?? "", phone: second, address: "", riderName };
    }
    return { customer: parts[0] ?? "", phone: "", address: second, riderName };
  }
  return {
    customer: parts[0] ?? "",
    phone: "",
    address: "",
    riderName,
  };
}

export function resolveTicketDeliveryNotes(ticket: {
  notes?: string | null;
  itemsSummary?: string | null;
}): string | undefined {
  const fromNotes = ticket.notes?.trim();
  if (fromNotes && CUSTOMER_NOTES_CHANNEL_RE.test(fromNotes) && fromNotes.includes("·")) {
    return fromNotes;
  }
  const summary = ticket.itemsSummary?.trim();
  if (!summary) return fromNotes || undefined;
  const embedded = summary.match(
    /\s·\s*((?:Delivery|Takeaway|Dine-in|Online|Foodpanda|Staff food)\b[\s\S]*)$/i,
  );
  if (embedded?.[1]?.trim()) return embedded[1].trim();
  return fromNotes || undefined;
}

export function inferOrderModeFromStation(stationLabel: string): MobileOrderMode {
  const label = stationLabel.trim().toLowerCase();
  if (label.includes("delivery")) return "delivery";
  if (label.includes("takeaway")) return "takeaway";
  return "dine-in";
}
