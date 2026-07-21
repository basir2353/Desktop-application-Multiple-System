import type { MenuItem, MenuItemVariant } from "@platform/contracts";
import { activeMenuVariants, formatMenuItemLabel } from "@platform/contracts";

export type LineDiscountMode = "percent" | "amount";

export type PosCartLine = {
  key: string;
  item: MenuItem;
  variant: MenuItemVariant | null;
  qty: number;
  unitPrice: number;
  lineLabel: string;
  /** Higher values appear first in the ticket list. */
  sortOrder: number;
  /** Auto-added happy hour gift — not editable from the menu grid. */
  isComplimentary?: boolean;
  /** Manual line discount mode when item.allowManualDiscount is true. */
  lineDiscountMode?: LineDiscountMode | null;
  /** Percent (0–100) or PKR amount depending on lineDiscountMode. */
  lineDiscountValue?: number;
};

/** Newest items first. Quantity changes must not bump sortOrder (see PosPage setQty). */
export function sortCartLinesNewestFirst(lines: PosCartLine[]): PosCartLine[] {
  return [...lines].sort((a, b) => b.sortOrder - a.sortOrder || a.key.localeCompare(b.key));
}

/** Oldest first — last-added item prints at the bottom of KOT / receipts. */
export function sortCartLinesOldestFirst(lines: PosCartLine[]): PosCartLine[] {
  return [...lines].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

export function nextCartSortOrder(lines: PosCartLine[]): number {
  return lines.reduce((max, line) => Math.max(max, line.sortOrder), 0) + 1;
}

export function cartLineKey(itemId: string, variantId?: string | null): string {
  return variantId ? `${itemId}:${variantId}` : itemId;
}

export function buildCartLine(
  item: MenuItem,
  variant: MenuItemVariant | null,
  qty = 1,
  sortOrder = 0,
  unitPriceOverride?: number,
): PosCartLine {
  const lineLabel = formatMenuItemLabel({
    name: item.name,
    portion: item.portion,
    variantLabel: variant?.label ?? null,
  });
  const unitPrice =
    unitPriceOverride != null && unitPriceOverride >= 0
      ? Math.round(unitPriceOverride)
      : (variant?.price ?? item.price);
  const defaultPct =
    item.allowManualDiscount && !item.nonTaxable && isMenuItemDiscountable(item)
      ? Math.max(0, Math.min(100, Math.round(item.defaultDiscountPct ?? 0)))
      : 0;
  return {
    key: cartLineKey(item.id, variant?.id),
    item,
    variant,
    qty: Math.max(1, Math.round(qty)),
    unitPrice,
    lineLabel,
    sortOrder,
    lineDiscountMode: defaultPct > 0 ? "percent" : null,
    lineDiscountValue: defaultPct > 0 ? defaultPct : 0,
  };
}

export function cartLineGross(line: Pick<PosCartLine, "unitPrice" | "qty">): number {
  return line.unitPrice * line.qty;
}

export function isMenuItemDiscountable(item: Pick<MenuItem, "discountable" | "nonDiscountable">): boolean {
  return Boolean(item.discountable) && !Boolean(item.nonDiscountable);
}

/** Bill Disc % / Disc Rs should be hidden while this cart line is selected. */
export function lineBlocksBillDiscount(line: PosCartLine): boolean {
  if (line.isComplimentary) return true;
  return Boolean(line.item.nonTaxable) || !isMenuItemDiscountable(line.item);
}

export function cartLineManualDiscountPkr(line: PosCartLine): number {
  if (
    line.isComplimentary ||
    !line.item.allowManualDiscount ||
    line.item.nonTaxable ||
    !isMenuItemDiscountable(line.item)
  ) {
    return 0;
  }
  const gross = cartLineGross(line);
  if (gross <= 0) return 0;
  const value = Math.max(0, line.lineDiscountValue ?? 0);
  if (line.lineDiscountMode === "percent") {
    return Math.min(gross, Math.round(gross * (Math.min(100, value) / 100)));
  }
  if (line.lineDiscountMode === "amount") {
    return Math.min(gross, Math.round(value));
  }
  return 0;
}

/** Whether POS may show per-line Disc % / Disc Rs controls for this line. */
export function canEditLineDiscount(line: PosCartLine): boolean {
  return (
    !line.isComplimentary &&
    Boolean(line.item.allowManualDiscount) &&
    !line.item.nonTaxable &&
    isMenuItemDiscountable(line.item)
  );
}

/** Refresh cart line menu flags from the latest menu catalog (avoids stale Non-discountable state). */
export function withLiveMenuItem(line: PosCartLine, menuById: Map<string, MenuItem>): PosCartLine {
  const fresh = menuById.get(line.item.id);
  if (!fresh) return line;
  return { ...line, item: fresh };
}

export function cartLineNet(line: PosCartLine): number {
  return Math.max(0, cartLineGross(line) - cartLineManualDiscountPkr(line));
}

export function resolvePosSellableVariants(item: MenuItem): MenuItemVariant[] {
  const variants = activeMenuVariants(item);
  return variants;
}

export function pickDefaultVariant(item: MenuItem): MenuItemVariant | null {
  const variants = resolvePosSellableVariants(item);
  return variants.length === 1 ? variants[0] : null;
}

export function shouldOpenVariantPicker(item: MenuItem): boolean {
  return resolvePosSellableVariants(item).length > 1;
}

export function itemNeedsPosPrompt(item: Pick<MenuItem, "askForPrice" | "askForQty">): boolean {
  return Boolean(item.askForPrice || item.askForQty);
}
