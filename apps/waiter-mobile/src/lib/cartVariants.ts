import {
  activeMenuVariants,
  formatMenuItemLabel,
  type MenuItem,
  type MenuItemVariant,
} from "@platform/contracts";
import type { CartLine } from "./orderDrafts";

export function resolveSellableVariants(item: MenuItem): MenuItemVariant[] {
  return activeMenuVariants(item);
}

export function pickDefaultVariant(item: MenuItem): MenuItemVariant | null {
  const variants = resolveSellableVariants(item);
  return variants.length === 1 ? variants[0] : null;
}

export function shouldOpenVariantPicker(item: MenuItem): boolean {
  return resolveSellableVariants(item).length > 1;
}

export function cartLineKey(itemId: string, variantId?: string | null): string {
  return variantId ? `${itemId}:${variantId}` : itemId;
}

export function buildCartLine(
  item: MenuItem,
  variant: MenuItemVariant | null,
  qty = 1,
  printedQty = 0,
): CartLine {
  const unitPrice = variant?.price ?? item.price;
  const lineLabel = formatMenuItemLabel({
    name: item.name,
    portion: item.portion,
    variantLabel: variant?.label ?? null,
  });
  return {
    key: cartLineKey(item.id, variant?.id),
    item,
    variant,
    qty: Math.max(1, Math.round(qty)),
    unitPrice,
    lineLabel,
    printedQty: Math.max(0, printedQty),
  };
}

export function matchVariantFromLabel(
  item: MenuItem,
  label: string,
  unitPrice?: number,
): MenuItemVariant | null {
  const variants = resolveSellableVariants(item);
  if (variants.length === 0) return null;
  const normalized = label.toLowerCase();
  const byLabel = variants.find((v) => {
    const full = formatMenuItemLabel({
      name: item.name,
      portion: item.portion,
      variantLabel: v.label,
    }).toLowerCase();
    return full === normalized || normalized.includes(`(${v.label.toLowerCase()})`);
  });
  if (byLabel) return byLabel;
  if (unitPrice != null) {
    const byPrice = variants.find((v) => v.price === unitPrice);
    if (byPrice) return byPrice;
  }
  return variants.length === 1 ? variants[0] : null;
}
