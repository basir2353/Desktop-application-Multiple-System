import type { MenuItem, MenuItemVariant } from "@platform/contracts";
import { activeMenuVariants, formatMenuItemLabel } from "@platform/contracts";

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
};

export function sortCartLinesNewestFirst(lines: PosCartLine[]): PosCartLine[] {
  return [...lines].sort((a, b) => b.sortOrder - a.sortOrder);
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
): PosCartLine {
  const lineLabel = formatMenuItemLabel({
    name: item.name,
    portion: item.portion,
    variantLabel: variant?.label ?? null,
  });
  const unitPrice = variant?.price ?? item.price;
  return {
    key: cartLineKey(item.id, variant?.id),
    item,
    variant,
    qty,
    unitPrice,
    lineLabel,
    sortOrder,
  };
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
