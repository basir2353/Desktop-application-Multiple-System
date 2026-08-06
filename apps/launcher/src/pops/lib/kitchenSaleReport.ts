/**
 * Kitchen Sale Report groups — linked to Print sections.
 * Assign menu categories to Pakistani / Fast Food / Outside sections
 * (Printer page → Print To), then this report totals sales per group.
 */

export const KITCHEN_SALE_GROUP_IDS = ["pakistani", "fast-food", "outside"] as const;
export type KitchenSaleGroupId = (typeof KITCHEN_SALE_GROUP_IDS)[number];

export type KitchenSaleGroupDef = {
  id: KitchenSaleGroupId;
  /** Report row label */
  label: string;
  /** Matching print-section ids (system) */
  sectionIds: string[];
  /** Name heuristics (section name or menu category name) */
  nameMatchers: RegExp[];
};

export const KITCHEN_SALE_GROUPS: KitchenSaleGroupDef[] = [
  {
    id: "pakistani",
    label: "Pakistani Dishes Sales",
    sectionIds: ["pakistani"],
    nameMatchers: [/pakistani/i, /desi/i, /\bkarahi\b/i, /\bbiryani\b/i],
  },
  {
    id: "fast-food",
    label: "Fast Food Sales",
    sectionIds: ["fast-food"],
    nameMatchers: [/fast\s*food/i, /fastfood/i, /\bburger\b/i, /\bpizza\b/i, /\bshawarma\b/i],
  },
  {
    id: "outside",
    label: "Outside Sales",
    sectionIds: ["outside"],
    nameMatchers: [/outside/i, /\bchinese\b/i, /\bbbq\b/i, /\bgrill\b/i],
  },
];

/** System print sections used for Kitchen Sale Report (Printer → Print To). */
export const KITCHEN_SALE_PRINT_SECTIONS = [
  {
    id: "pakistani",
    name: "Pakistani",
    icon: "🍛",
    color: "#f59e0b",
    enabled: true,
    isSystem: true as const,
    sortOrder: 0,
  },
  {
    id: "fast-food",
    name: "Fast Food",
    icon: "🍔",
    color: "#ef4444",
    enabled: true,
    isSystem: true as const,
    sortOrder: 1,
  },
  {
    id: "outside",
    name: "Outside",
    icon: "🥡",
    color: "#38bdf8",
    enabled: true,
    isSystem: true as const,
    sortOrder: 2,
  },
];

export function resolveKitchenSaleGroup(input: {
  sectionIds?: string[];
  sectionNames?: string[];
  categoryName?: string | null;
}): KitchenSaleGroupId {
  const sectionIds = (input.sectionIds ?? []).map((s) => s.trim().toLowerCase());
  for (const group of KITCHEN_SALE_GROUPS) {
    if (group.sectionIds.some((id) => sectionIds.includes(id))) return group.id;
  }

  const haystack = [...(input.sectionNames ?? []), input.categoryName ?? ""]
    .join(" ")
    .trim();
  if (haystack) {
    for (const group of KITCHEN_SALE_GROUPS) {
      // Outside matchers last among named groups — Pakistani/Fast Food checked first
      if (group.id === "outside") continue;
      if (group.nameMatchers.some((re) => re.test(haystack))) return group.id;
    }
    for (const group of KITCHEN_SALE_GROUPS) {
      if (group.id !== "outside") continue;
      if (group.nameMatchers.some((re) => re.test(haystack))) return group.id;
    }
  }

  // Chinese / BBQ / unassigned categories → Outside (per business rule)
  return "outside";
}

export type KitchenSaleBucket = { qty: number; amount: number };

export function emptyKitchenSaleBuckets(): Record<KitchenSaleGroupId, KitchenSaleBucket> {
  return {
    pakistani: { qty: 0, amount: 0 },
    "fast-food": { qty: 0, amount: 0 },
    outside: { qty: 0, amount: 0 },
  };
}

export function kitchenSaleRowsFromBuckets(
  buckets: Record<KitchenSaleGroupId, KitchenSaleBucket>,
): { label: string; qty: number; amount: number; meta?: string }[] {
  return KITCHEN_SALE_GROUPS.map((g) => ({
    label: g.label,
    qty: buckets[g.id].qty,
    amount: buckets[g.id].amount,
    meta: g.id,
  }));
}
