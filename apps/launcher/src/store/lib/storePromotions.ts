import type { StoreProduct, StorePromotion } from "@platform/contracts";
import type { CartLine } from "./storePosSync";
import { cartLineTotal } from "./storePosSync";

export function estimatePromotionDiscount(cart: CartLine[], promotions: StorePromotion[]): number {
  const pricedLines = cart.map((line) => ({
    productId: line.product.id,
    qtyUnits: line.product.isWeighed ? (line.qtyGrams ?? Math.round(line.qty * 1000)) : line.qty,
    isWeighed: line.product.isWeighed,
    unitPrice: line.product.sellingPrice,
    lineSubtotal: cartLineTotal(line),
  }));

  let discount = 0;
  for (const promo of promotions.filter((p) => p.isActive)) {
    const productSet = new Set(promo.productIds);
    const matching = pricedLines.filter((l) => productSet.size === 0 || productSet.has(l.productId));
    if (matching.length === 0) continue;

    const cfg = promo.config as Record<string, number>;
    switch (promo.type) {
      case "percent_off":
        discount += matching.reduce((s, l) => s + Math.round((l.lineSubtotal * (cfg.percent ?? 0)) / 100), 0);
        break;
      case "buy_x_get_y": {
        const buyQty = cfg.buyQty ?? 2;
        const getQty = cfg.getQty ?? 1;
        for (const line of matching) {
          if (line.isWeighed) continue;
          discount += Math.floor(line.qtyUnits / (buyQty + getQty)) * getQty * line.unitPrice;
        }
        break;
      }
      case "mix_match": {
        const anyQty = cfg.anyQty ?? 3;
        const fixedPrice = cfg.fixedPrice ?? 0;
        const units = matching.filter((l) => !l.isWeighed).reduce((s, l) => s + l.qtyUnits, 0);
        const sets = Math.floor(units / anyQty);
        if (sets > 0) {
          const prices = matching.flatMap((l) => (!l.isWeighed ? Array.from({ length: l.qtyUnits }, () => l.unitPrice) : [])).sort((a, b) => b - a).slice(0, sets * anyQty);
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
