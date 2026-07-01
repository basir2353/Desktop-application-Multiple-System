import type { MenuItem } from "@platform/contracts";
import { pickDefaultVariant, type PosCartLine, buildCartLine } from "./posCart";
import type { HappyHourSettings } from "./happyHourSettings";

export function isHappyHourActive(settings: HappyHourSettings, now = new Date()): boolean {
  if (!settings.enabled || !settings.bonusMenuItemId) return false;
  const hour = now.getHours();
  const { startHour, endHour } = settings;
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export function resolveHappyHourBonusItem(
  menuItems: MenuItem[],
  settings: HappyHourSettings,
): { item: MenuItem; variant: ReturnType<typeof pickDefaultVariant> } | null {
  if (!settings.bonusMenuItemId) return null;
  const item = menuItems.find((m) => m.id === settings.bonusMenuItemId && m.isActive);
  if (!item) return null;
  const variant =
    settings.bonusVariantId != null
      ? item.variants.find((v) => v.id === settings.bonusVariantId && v.isActive) ??
        pickDefaultVariant(item)
      : pickDefaultVariant(item);
  return { item, variant };
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
    isComplimentary: true,
  };
}

/** Adds a free bonus line when happy hour is active and the cart has paid items. */
export function applyHappyHourBonus(
  paidCart: PosCartLine[],
  menuItems: MenuItem[],
  settings: HappyHourSettings,
  now = new Date(),
): PosCartLine[] {
  if (!isHappyHourActive(settings, now) || paidCart.length === 0) {
    return paidCart;
  }
  const bonus = resolveHappyHourBonusItem(menuItems, settings);
  if (!bonus) return paidCart;

  const bonusLine = buildHappyHourBonusLine(bonus.item, bonus.variant);
  const alreadyHasBonus = paidCart.some((l) => l.key === bonusLine.key);
  if (alreadyHasBonus) return paidCart;

  return [...paidCart, bonusLine];
}

export function stripComplimentaryLines(cart: PosCartLine[]): PosCartLine[] {
  return cart.filter((l) => !l.isComplimentary && !l.key.startsWith("hh-bonus:"));
}
