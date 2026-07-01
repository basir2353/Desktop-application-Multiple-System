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
  if (value.includes("delivery")) return "delivery";
  if (value.includes("takeaway") || value.includes("counter")) return "takeaway";
  return "dine-in";
}

export function tableNumberFromStation(stationLabel: string): string | null {
  const match = stationLabel.match(/^Table\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function parseDeliveryFieldsFromNotes(notes: string | null | undefined): {
  customer: string;
  phone: string;
  address: string;
} {
  if (!notes) return { customer: "", phone: "", address: "" };
  const trimmed = notes.trim();
  if (!trimmed.toLowerCase().startsWith("delivery")) {
    return { customer: "", phone: "", address: "" };
  }
  const body = trimmed.replace(/^Delivery\s*·\s*/i, "");
  const parts = body.split(" · ").map((p) => p.trim());

  if (parts.length >= 3) {
    return {
      customer: parts[0] ?? "",
      phone: parts[1] ?? "",
      address: parts.slice(2).join(" · "),
    };
  }
  if (parts.length === 2) {
    const second = parts[1] ?? "";
    const looksLikePhone = /^[\d+\s()-]{7,}$/.test(second);
    if (looksLikePhone) {
      return { customer: parts[0] ?? "", phone: second, address: "" };
    }
    return { customer: parts[0] ?? "", phone: "", address: second };
  }
  return {
    customer: parts[0] ?? "",
    phone: "",
    address: "",
  };
}

function matchMenuItem(menuItems: ApiMenuItem[], line: StoredOrderLine): ApiMenuItem | undefined {
  if (line.menuItemId) {
    const byId = menuItems.find((item) => item.id === line.menuItemId);
    if (byId) return byId;
  }
  const normalized = line.label.toLowerCase();
  return menuItems.find((item) => {
    const full = formatMenuItemLabel(item).toLowerCase();
    if (full === normalized) return true;
    if (item.name.toLowerCase() === normalized) return true;
    return normalized.startsWith(item.name.toLowerCase());
  });
}

function matchVariant(item: ApiMenuItem, lineLabel: string): MenuItemVariant | null {
  const variants = resolvePosSellableVariants(item);
  if (variants.length === 0) return null;
  const normalized = lineLabel.toLowerCase();
  const exact = variants.find((variant) => normalized.includes(variant.label.toLowerCase()));
  return exact ?? pickDefaultVariant(item);
}

export function cartFromStoredLines(
  menuItems: ApiMenuItem[],
  lines: StoredOrderLine[],
): PosCartLine[] {
  const cart: PosCartLine[] = [];
  for (const line of lines) {
    const item = matchMenuItem(menuItems, line);
    if (!item) continue;
    const variant = matchVariant(item, line.label);
    const cartLine = buildCartLine(item, variant, line.qty);
    if (line.unitPrice != null && line.unitPrice > 0) {
      cartLine.unitPrice = line.unitPrice;
    }
    cart.push(cartLine);
  }
  return cart;
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
