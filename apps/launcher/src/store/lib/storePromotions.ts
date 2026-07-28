import type { StoreProduct, StorePromotion } from "@platform/contracts";
import type { CartLine } from "./storePosSync";
import { cartLineTotal, cartLineUnitPrice } from "./storePosSync";

type PromoConfig = {
  percent?: number;
  amount?: number;
  buyQty?: number;
  getQty?: number;
  anyQty?: number;
  fixedPrice?: number;
  bundlePrice?: number;
  scope?: string;
  categoryId?: string;
  supplierId?: string;
  nameContains?: string;
  priceLevels?: string[];
};

function normalizePriceLevel(level?: string | null): string {
  const v = (level || "regular").toLowerCase();
  if (v === "market_sale" || v === "market") return "employee";
  return v;
}

function promoMatchesCartLine(line: CartLine, promo: StorePromotion): boolean {
  const cfg = (promo.config ?? {}) as PromoConfig;
  const scope = cfg.scope ?? (promo.productIds.length === 0 ? "all" : "custom");
  const levels = cfg.priceLevels?.length ? cfg.priceLevels.map(normalizePriceLevel) : null;
  if (levels && !levels.includes(normalizePriceLevel(line.priceLevel))) return false;

  switch (scope) {
    case "all":
      return true;
    case "department":
      return Boolean(cfg.categoryId) && line.product.categoryId === cfg.categoryId;
    case "vendor":
      return Boolean(cfg.supplierId) && line.product.supplierId === cfg.supplierId;
    case "named": {
      const q = (cfg.nameContains ?? "").trim().toLowerCase();
      if (!q) return false;
      const name = (line.displayName || line.product.name).toLowerCase();
      return name.includes(q);
    }
    case "custom":
    default: {
      if (promo.productIds.length === 0) return true;
      return promo.productIds.includes(line.product.id);
    }
  }
}

function isPromoInSchedule(promo: StorePromotion, now = Date.now()): boolean {
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now) return false;
  if (promo.endsAt && new Date(promo.endsAt).getTime() < now) return false;
  return true;
}

export function estimatePromotionDiscount(cart: CartLine[], promotions: StorePromotion[]): number {
  let discount = 0;
  for (const promo of promotions.filter((p) => p.isActive && isPromoInSchedule(p))) {
    const matching = cart.filter((l) => promoMatchesCartLine(l, promo));
    if (matching.length === 0) continue;
    const cfg = (promo.config ?? {}) as PromoConfig;
    const type = String(promo.type);

    switch (type) {
      case "percent_off":
        discount += matching.reduce(
          (s, l) => s + Math.round((cartLineTotal(l) * (cfg.percent ?? 0)) / 100),
          0,
        );
        break;
      case "amount_off": {
        const amount = cfg.amount ?? 0;
        for (const line of matching) {
          const units = line.product.isWeighed ? 1 : line.qty;
          discount += Math.min(cartLineTotal(line), amount * units);
        }
        break;
      }
      case "buy_x_get_y": {
        const buyQty = cfg.buyQty ?? 2;
        const getQty = cfg.getQty ?? 1;
        for (const line of matching) {
          if (line.product.isWeighed) continue;
          discount += Math.floor(line.qty / (buyQty + getQty)) * getQty * cartLineUnitPrice(line);
        }
        break;
      }
      case "buy_x_percent_off": {
        const buyQty = cfg.buyQty ?? 12;
        const pct = cfg.percent ?? 0;
        for (const line of matching) {
          if (line.product.isWeighed || buyQty <= 0 || pct <= 0) continue;
          const sets = Math.floor(line.qty / buyQty);
          if (sets <= 0) continue;
          discount += Math.round((sets * buyQty * cartLineUnitPrice(line) * pct) / 100);
        }
        break;
      }
      case "mix_match": {
        const anyQty = cfg.anyQty ?? cfg.buyQty ?? 3;
        const fixedPrice = cfg.fixedPrice ?? 0;
        const units = matching.filter((l) => !l.product.isWeighed).reduce((s, l) => s + l.qty, 0);
        const sets = Math.floor(units / anyQty);
        if (sets > 0) {
          const prices = matching
            .flatMap((l) => (!l.product.isWeighed ? Array.from({ length: l.qty }, () => cartLineUnitPrice(l)) : []))
            .sort((a, b) => b - a)
            .slice(0, sets * anyQty);
          const regular = prices.reduce((s, p) => s + p, 0);
          if (regular > sets * fixedPrice) discount += regular - sets * fixedPrice;
        }
        break;
      }
      default:
        break;
    }
  }
  return discount;
}

export function touchButtonEmoji(label: string, product?: StoreProduct): string {
  const n = label.toLowerCase();
  if (n.includes("bread")) return "🥖";
  if (n.includes("milk")) return "🥛";
  if (n.includes("egg")) return "🥚";
  if (n.includes("coriander") || n.includes("mint") || n.includes("herb")) return "🌿";
  if (n.includes("cake") || n.includes("bakery")) return "🎂";
  if (product?.isWeighed) return "⚖️";
  return "🛒";
}

export function describePromotionRule(promo: StorePromotion): string {
  const cfg = (promo.config ?? {}) as PromoConfig;
  const type = String(promo.type);
  switch (type) {
    case "percent_off":
      return `${cfg.percent ?? 0}% off`;
    case "amount_off":
      return `Rs ${cfg.amount ?? 0} off`;
    case "mix_match":
      return `Buy ${cfg.anyQty ?? cfg.buyQty ?? "?"} for Rs ${cfg.fixedPrice ?? "?"}`;
    case "buy_x_percent_off":
      return `Buy ${cfg.buyQty ?? "?"} get ${cfg.percent ?? "?"}% off`;
    case "buy_x_get_y":
      return `Buy ${cfg.buyQty ?? "?"} get ${cfg.getQty ?? "?"}`;
    default:
      return type;
  }
}
