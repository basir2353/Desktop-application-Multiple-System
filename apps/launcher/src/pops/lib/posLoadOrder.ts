import {
  formatMenuItemLabel,
  type Bill,
  type BillLine,
  type KitchenTicket,
  type MenuItem as ApiMenuItem,
  type MenuItemVariant,
} from "@platform/contracts";
import {
  buildCartLine,
  pickDefaultVariant,
  resolvePosSellableVariants,
  type PosCartLine,
} from "./posCart";
import type { PosOrderMode } from "./posOrderMode";

export type StoredOrderLine = {
  label: string;
  qty: number;
  unitPrice?: number;
  menuItemId?: string;
};

export function inferPosModeFromStation(stationLabel: string): PosOrderMode {
  const value = stationLabel.toLowerCase();
  if (value.includes("foodpanda") || value.startsWith("fp-")) return "foodpanda";
  if (value.includes("online") || value.startsWith("ol-")) return "online";
  if (value.includes("staff food") || value.includes("staff-food") || value.startsWith("sf-")) {
    return "staff-food";
  }
  if (value.includes("delivery")) return "delivery";
  if (value.includes("takeaway") || value.includes("counter")) return "takeaway";
  return "dine-in";
}

export function tableNumberFromStation(stationLabel: string): string | null {
  const match = stationLabel.match(/^Table\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
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

  // Notes may be embedded after item lines: "Burger x1 · Takeaway · name · phone"
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

  // POS packs bill discount into notes as DiscPct:10 / DiscRs:500 — not customer fields.
  // Kitchen free-text is packed as Note: … — also not a customer field.
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

/** Prefer ticket.notes; fall back to full channel block inside itemsSummary. */
export function resolveTicketDeliveryNotes(
  ticket: { notes?: string | null; itemsSummary?: string | null },
): string | undefined {
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

/** Hide the packed channel note when the same fields print as labeled meta rows. */
export function receiptNotesWithoutPackedDeliveryContact(
  notes: string | null | undefined,
  hasStructuredDelivery: boolean,
): string | undefined {
  let trimmed = notes?.trim();
  if (!trimmed) return undefined;
  // Never print internal DiscPct / CashRecv markers as a customer note.
  trimmed = stripCashReceivedFromNotes(stripTicketDiscountFromNotes(trimmed))?.trim();
  if (!trimmed) return undefined;
  if (hasStructuredDelivery && CUSTOMER_NOTES_CHANNEL_RE.test(trimmed)) return undefined;
  return trimmed;
}

/** Manual ticket discount packed into kitchen notes so Edit restores Disc % / Disc Rs. */
export type TicketDiscountState = {
  editedAs: "pct" | "amount";
  pct: number;
  amount: number;
};

export function parseTicketDiscountFromNotes(
  notes: string | null | undefined,
): TicketDiscountState | null {
  if (!notes?.trim()) return null;
  const parts = notes.split(" · ").map((p) => p.trim()).filter(Boolean);
  let pct: number | null = null;
  let amount: number | null = null;
  let editedAs: "pct" | "amount" | null = null;
  for (const part of parts) {
    const pctMatch = part.match(/^DiscPct:(\d+)$/i);
    if (pctMatch) {
      pct = Number(pctMatch[1]);
      editedAs = "pct";
      continue;
    }
    const rsMatch = part.match(/^DiscRs:(\d+)$/i);
    if (rsMatch) {
      amount = Number(rsMatch[1]);
      editedAs = "amount";
    }
  }
  if (editedAs == null) return null;
  return {
    editedAs,
    pct: pct ?? 0,
    amount: amount ?? 0,
  };
}

/** Strip DiscPct/DiscRs markers from notes used for display / customer parse. */
export function stripTicketDiscountFromNotes(
  notes: string | null | undefined,
): string | undefined {
  if (!notes?.trim()) return undefined;
  const cleaned = notes
    .split(" · ")
    .map((p) => p.trim())
    .filter((p) => p && !/^Disc(?:Pct|Rs):\d+$/i.test(p))
    .join(" · ")
    .trim();
  return cleaned || undefined;
}

/** Cash tendered above bill total — packed so reprint can show Change Due. */
export function parseCashReceivedFromNotes(
  notes: string | null | undefined,
): number {
  if (!notes?.trim()) return 0;
  for (const part of notes.split(" · ").map((p) => p.trim()).filter(Boolean)) {
    const match = part.match(/^CashRecv:(\d+)$/i);
    if (match) return Math.max(0, Number(match[1]) || 0);
  }
  return 0;
}

export function stripCashReceivedFromNotes(
  notes: string | null | undefined,
): string | undefined {
  if (!notes?.trim()) return undefined;
  const cleaned = notes
    .split(" · ")
    .map((p) => p.trim())
    .filter((p) => p && !/^CashRecv:\d+$/i.test(p))
    .join(" · ")
    .trim();
  return cleaned || undefined;
}

export function packOrderNotesWithCashReceived(
  baseNotes: string | undefined,
  cashReceived: number | null | undefined,
  billTotal: number,
): string | undefined {
  const base = stripCashReceivedFromNotes(baseNotes);
  const recv = Math.max(0, Math.round(cashReceived ?? 0));
  if (recv <= billTotal) return base;
  const marker = `CashRecv:${recv}`;
  return base ? `${base} · ${marker}` : marker;
}

/** PKR discount amount implied by DiscPct/DiscRs markers on a ticket. */
export function discountAmountFromTicketNotes(
  notes: string | null | undefined,
  subtotal: number,
): number {
  const state = parseTicketDiscountFromNotes(notes);
  if (!state || subtotal <= 0) return 0;
  if (state.editedAs === "amount" && state.amount > 0) {
    return Math.min(Math.round(state.amount), subtotal);
  }
  if (state.pct > 0) {
    return Math.min(Math.round(subtotal * (state.pct / 100)), subtotal);
  }
  return 0;
}

/** Append discount markers to order notes for kitchen ticket persistence. */
export function packOrderNotesWithDiscount(
  baseNotes: string | undefined,
  discount: TicketDiscountState | null,
): string | undefined {
  const base = stripTicketDiscountFromNotes(baseNotes);
  if (!discount || (discount.pct <= 0 && discount.amount <= 0)) return base;
  const marker =
    discount.editedAs === "amount"
      ? `DiscRs:${Math.max(0, Math.round(discount.amount))}`
      : `DiscPct:${Math.max(0, Math.round(discount.pct))}`;
  return base ? `${base} · ${marker}` : marker;
}

/** Free-text kitchen instruction packed as `Note: …` in ticket notes. */
export function parseKitchenFreeNoteFromNotes(
  notes: string | null | undefined,
): string {
  if (!notes?.trim()) return "";
  for (const part of notes.split(" · ").map((p) => p.trim()).filter(Boolean)) {
    const match = part.match(/^Note:\s*(.+)$/i);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

export function stripKitchenFreeNoteFromNotes(
  notes: string | null | undefined,
): string | undefined {
  if (!notes?.trim()) return undefined;
  const cleaned = notes
    .split(" · ")
    .map((p) => p.trim())
    .filter((p) => p && !/^Note:\s*/i.test(p))
    .join(" · ")
    .trim();
  return cleaned || undefined;
}

export function packOrderNotesWithKitchenNote(
  baseNotes: string | undefined,
  kitchenNote: string,
): string | undefined {
  const base = stripKitchenFreeNoteFromNotes(baseNotes);
  const cleaned = kitchenNote.trim().replace(/\s+/g, " ").replace(/\s*·\s*/g, " - ");
  if (!cleaned) return base;
  const marker = `Note: ${cleaned.slice(0, 200)}`;
  return base ? `${base} · ${marker}` : marker;
}

function matchMenuItem(menuItems: ApiMenuItem[], line: StoredOrderLine): ApiMenuItem | undefined {
  if (line.menuItemId) {
    const byId = menuItems.find((item) => item.id === line.menuItemId);
    if (byId) return byId;
  }
  const normalized = line.label.toLowerCase().trim();
  if (!normalized) return undefined;

  const exact = menuItems.find((item) => {
    const full = formatMenuItemLabel(item).toLowerCase();
    if (full === normalized) return true;
    if (item.name.toLowerCase() === normalized) return true;
    return false;
  });
  if (exact) return exact;

  return menuItems.find((item) => {
    const name = item.name.toLowerCase();
    if (!name) return false;
    if (normalized.startsWith(name)) return true;
    if (normalized.includes(name)) return true;
    const secondary = (item.secondaryName ?? "").toLowerCase().trim();
    return Boolean(secondary) && (normalized === secondary || normalized.includes(secondary));
  });
}

function matchVariant(item: ApiMenuItem, lineLabel: string): MenuItemVariant | null {
  const variants = resolvePosSellableVariants(item);
  if (variants.length === 0) return null;
  const normalized = lineLabel.toLowerCase();
  const exact = variants.find((variant) => normalized.includes(variant.label.toLowerCase()));
  return exact ?? pickDefaultVariant(item);
}

/** Keep unmatched ticket/bill lines editable when menu catalog cannot resolve them. */
function buildOrphanMenuItem(label: string, unitPrice: number, index: number): ApiMenuItem {
  const safeLabel = label.trim() || "Item";
  return {
    // Non-UUID so bill/KOT save omits menuItemId (see cartToBillLines / kitchenLines).
    id: `orphan:${index}:${safeLabel}`,
    categoryId: "00000000-0000-4000-8000-000000000000",
    name: safeLabel,
    secondaryName: null,
    imageUrl: null,
    portion: null,
    price: Math.max(0, Math.round(unitPrice)),
    barcode: null,
    happyHour: false,
    featured: false,
    isActive: true,
    sortOrder: 0,
    variants: [],
    discountable: true,
    nonDiscountable: false,
    nonTaxable: false,
    askForPrice: false,
    askForQty: false,
    allowManualDiscount: false,
    defaultDiscountPct: 0,
    simplePrice: false,
  };
}

export function cartFromStoredLines(
  menuItems: ApiMenuItem[],
  lines: StoredOrderLine[],
): PosCartLine[] {
  const cart: PosCartLine[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const { baseLabel, lineNote } = splitLineLabelNote(line.label);
    const item = matchMenuItem(menuItems, { ...line, label: baseLabel });
    if (!item) {
      const unitPrice = line.unitPrice ?? 0;
      const orphan = buildOrphanMenuItem(baseLabel, unitPrice, index);
      const orphanLine = buildCartLine(orphan, null, line.qty, index, unitPrice, lineNote);
      orphanLine.lineLabel = baseLabel.trim() || orphan.name;
      orphanLine.key = lineNote ? `${orphan.id}::note:${lineNote}` : orphan.id;
      cart.push(orphanLine);
      continue;
    }
    const variant = matchVariant(item, baseLabel);
    const cartLine = buildCartLine(item, variant, line.qty, index, undefined, lineNote);
    if (line.unitPrice != null && line.unitPrice > 0) {
      cartLine.unitPrice = line.unitPrice;
    }
    // Preserve printed base label (without note) when it differs from catalog formatting.
    if (baseLabel.trim()) {
      cartLine.lineLabel = baseLabel.trim();
    }
    cart.push(cartLine);
  }
  return cart;
}

/** Split `Burger (بدون مرچ)` → base + note for cart restore. */
function splitLineLabelNote(label: string): { baseLabel: string; lineNote?: string } {
  const trimmed = label.trim();
  const match = trimmed.match(/^(.*)\s*\(([^)]+)\)\s*$/);
  if (!match) return { baseLabel: trimmed };
  const base = match[1]!.trim();
  const note = match[2]!.trim();
  if (!base || !note) return { baseLabel: trimmed };
  return { baseLabel: base, lineNote: note };
}

export function cartFromKitchenTicket(
  menuItems: ApiMenuItem[],
  ticket: KitchenTicket,
): PosCartLine[] {
  const lines: StoredOrderLine[] =
    ticket.lines && ticket.lines.length > 0
      ? ticket.lines
      : ticket.itemsSummary
          .split(" · ")[0]
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .map((part) => {
            const match = part.match(/^(.+?)\s+x(\d+)$/i);
            return match
              ? { label: match[1].trim(), qty: Number(match[2]) }
              : { label: part, qty: 1 };
          });
  return cartFromStoredLines(menuItems, lines);
}

export function cartFromBill(menuItems: ApiMenuItem[], bill: Bill): PosCartLine[] {
  const lines: StoredOrderLine[] = bill.lines.map((line: BillLine) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: line.unitPrice,
    menuItemId: line.menuItemId,
  }));
  return cartFromStoredLines(menuItems, lines);
}

export function storedLinesFromCart(cart: PosCartLine[]): StoredOrderLine[] {
  return cart.map((line) => ({
    label: line.lineLabel,
    qty: line.qty,
    unitPrice: line.unitPrice,
    menuItemId: line.item.id,
  }));
}
