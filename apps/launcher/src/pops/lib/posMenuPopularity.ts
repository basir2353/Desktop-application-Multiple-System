import type { Bill, MenuItem } from "@platform/contracts";

/** Sum line qty per menu item from completed bills. */
export function buildMenuItemOrderCounts(orders: Bill[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "completed") continue;
    for (const line of order.lines) {
      if (!line.menuItemId) continue;
      counts.set(line.menuItemId, (counts.get(line.menuItemId) ?? 0) + line.qty);
    }
  }
  return counts;
}

export function sortMenuByPopularity(items: MenuItem[], orderCounts: Map<string, number>): MenuItem[] {
  return [...items].sort((a, b) => {
    const diff = (orderCounts.get(b.id) ?? 0) - (orderCounts.get(a.id) ?? 0);
    if (diff !== 0) return diff;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}
