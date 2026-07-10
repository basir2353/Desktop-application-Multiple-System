import type { MenuItem } from "@platform/contracts";
import { pickDefaultVariant, type PosCartLine, buildCartLine, nextCartSortOrder } from "./posCart";
import type { HappyHourSettings, HappyHourTimeSlot } from "./happyHourSettings";

function isHourInWindow(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export function getActiveHappyHourSlot(
  settings: HappyHourSettings,
  now = new Date(),
): HappyHourTimeSlot | null {
  if (!settings.enabled || settings.slots.length === 0) return null;
  const hour = now.getHours();
  return settings.slots.find((slot) => isHourInWindow(hour, slot.startHour, slot.endHour)) ?? null;
}

export function isHappyHourActive(settings: HappyHourSettings, now = new Date()): boolean {
  return getActiveHappyHourSlot(settings, now) != null;
}

export function applyHappyHourDiscountPrice(basePrice: number, percentOff: number): number {
  if (percentOff <= 0) return basePrice;
  const pct = Math.min(100, Math.max(0, percentOff));
  return Math.round(basePrice * (1 - pct / 100));
}

export function resolveHappyHourBonusItem(
  menuItems: MenuItem[],
  settings: HappyHourSettings,
  now = new Date(),
): { item: MenuItem; variant: ReturnType<typeof pickDefaultVariant>; slot: HappyHourTimeSlot } | null {
  const slot = getActiveHappyHourSlot(settings, now);
  if (!slot?.bonusMenuItemId) return null;
  const item = menuItems.find((m) => m.id === slot.bonusMenuItemId && m.isActive);
  if (!item) return null;
  const variant =
    slot.bonusVariantId != null
      ? item.variants.find((v) => v.id === slot.bonusVariantId && v.isActive) ??
        pickDefaultVariant(item)
      : pickDefaultVariant(item);
  return { item, variant, slot };
}

export function buildHappyHourBonusLine(
  item: MenuItem,
  variant: ReturnType<typeof pickDefaultVariant>,
): PosCartLine {
  const base = buildCartLine(item, variant, 1);
  return {
    ...base,
    key: `hh-bonus:${base.key}`,
    unitPrice: 0,
    lineLabel: `${base.lineLabel} (Happy hour gift)`,
    sortOrder: 0,
    isComplimentary: true,
  };
}

/** Apply time-slot discount pricing to paid cart lines. */
export function applyHappyHourCartPricing(
  paidCart: PosCartLine[],
  settings: HappyHourSettings,
  now = new Date(),
): PosCartLine[] {
  const slot = getActiveHappyHourSlot(settings, now);
  if (!slot || slot.percentOff <= 0) return paidCart;
  return paidCart.map((line) => {
    if (line.isComplimentary || line.key.startsWith("hh-bonus:")) return line;
    return {
      ...line,
      unitPrice: applyHappyHourDiscountPrice(line.unitPrice, slot.percentOff),
    };
  });
}

/** Adds a free bonus line when the active slot includes a gift and the cart has paid items. */
export function applyHappyHourBonus(
  paidCart: PosCartLine[],
  menuItems: MenuItem[],
  settings: HappyHourSettings,
  now = new Date(),
): PosCartLine[] {
  const pricedCart = applyHappyHourCartPricing(paidCart, settings, now);
  const bonus = resolveHappyHourBonusItem(menuItems, settings, now);
  if (!bonus || pricedCart.length === 0) return pricedCart;

  const bonusLine = buildHappyHourBonusLine(bonus.item, bonus.variant);
  const alreadyHasBonus = pricedCart.some((l) => l.key === bonusLine.key);
  if (alreadyHasBonus) return pricedCart;

  const sortOrder = nextCartSortOrder(pricedCart);
  return [{ ...bonusLine, sortOrder }, ...pricedCart];
}

export function stripComplimentaryLines(cart: PosCartLine[]): PosCartLine[] {
  return cart.filter((l) => !l.isComplimentary && !l.key.startsWith("hh-bonus:"));
}
