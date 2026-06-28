import {
  popsNavItems,
  type PopsNavGroup,
  type PopsNavItem,
  type PopsNavLink,
} from "../pops/spec/modules";
import { pharmacyNavItems } from "../pharmacy/spec/nav";
import { storeNavItems } from "../store/spec/nav";

export type BusinessSystemId = "restaurant" | "pharmacy" | "general-store";

export type BusinessSystem = {
  id: BusinessSystemId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  accentClass: string;
  iconLetter: string;
  gradientClass: string;
  /** Route prefix for the ERP shell (shared across systems for now). */
  routePrefix: string;
  hiddenNavPaths: Set<string>;
};

const restaurantHidden = new Set<string>();
const pharmacyHidden = new Set([
  "menu",
  "staff-food",
  "tables",
  "kitchen",
  "waiter",
  "delivery",
  "inventory/recipes",
  "manufacturing",
]);
const generalStoreHidden = new Set([
  "menu",
  "staff-food",
  "tables",
  "kitchen",
  "waiter",
  "delivery",
  "inventory/recipes",
  "inventory/ingredients",
  "manufacturing",
]);

export const businessSystems: Record<BusinessSystemId, BusinessSystem> = {
  restaurant: {
    id: "restaurant",
    name: "Restaurant ERP",
    shortName: "POPS",
    tagline: "Full-service restaurant operations",
    description: "POS, kitchen, tables, menu, inventory, HR, and compliance for restaurants.",
    accentClass: "text-amber-400",
    iconLetter: "P",
    gradientClass: "from-amber-400 to-amber-600",
    routePrefix: "/pops",
    hiddenNavPaths: restaurantHidden,
  },
  pharmacy: {
    id: "pharmacy",
    name: "Pharmacy ERP",
    shortName: "Pharmacy",
    tagline: "Dispensing, stock, and retail billing",
    description: "Counter POS, drug inventory, purchases, accounting, and regulatory workflows.",
    accentClass: "text-emerald-400",
    iconLetter: "Rx",
    gradientClass: "from-emerald-400 to-teal-600",
    routePrefix: "/pops",
    hiddenNavPaths: pharmacyHidden,
  },
  "general-store": {
    id: "general-store",
    name: "General Store ERP",
    shortName: "Store",
    tagline: "Retail POS and stock management",
    description: "Checkout, categories, suppliers, purchases, and store accounting.",
    accentClass: "text-sky-400",
    iconLetter: "G",
    gradientClass: "from-sky-400 to-indigo-600",
    routePrefix: "/pops",
    hiddenNavPaths: generalStoreHidden,
  },
};

export const businessSystemList: BusinessSystem[] = [
  businessSystems.restaurant,
  businessSystems.pharmacy,
  businessSystems["general-store"],
];

export function isBusinessSystemId(value: string): value is BusinessSystemId {
  return value === "restaurant" || value === "pharmacy" || value === "general-store";
}

export function getBusinessSystem(id: BusinessSystemId): BusinessSystem {
  return businessSystems[id];
}

export function getSystemHomePath(_id: BusinessSystemId): string {
  return "/pops";
}

/** First ERP screen after auth — skips redirect-only `/pops` hop. */
export function getErpEntryPath(systemId: BusinessSystemId, hasBranch: boolean): string {
  if (systemId === "pharmacy") {
    return hasBranch ? "/pops/pharmacy/dashboard" : "/pops/branches";
  }
  if (systemId === "general-store") {
    return hasBranch ? "/pops/store/dashboard" : "/pops/branches";
  }
  return hasBranch ? "/pops/dashboard" : "/pops/branches";
}

const SHARED_ERP_PATHS = new Set(["auth", "notifications", "settings"]);

/** Infer business system from the current `/pops` route, when unambiguous. */
export function resolveBusinessSystemFromPath(pathname: string): BusinessSystemId | null {
  if (pathname.startsWith("/pops/pharmacy/") || pathname === "/pops/pharmacy") {
    return "pharmacy";
  }
  if (pathname.startsWith("/pops/store/") || pathname === "/pops/store") {
    return "general-store";
  }
  return null;
}

/** True for restaurant-only screens (not pharmacy, store, or shared settings/auth). */
export function isRestaurantExclusivePath(pathname: string): boolean {
  const sub = pathname.replace(/^\/pops\/?/, "").replace(/\/$/, "");
  if (!sub || sub === "branches") return false;
  if (sub.startsWith("pharmacy/") || sub === "pharmacy") return false;
  if (sub.startsWith("store/") || sub === "store") return false;
  if (SHARED_ERP_PATHS.has(sub)) return false;
  if (sub.startsWith("notifications/")) return false;
  return true;
}

function filterNavItem(item: PopsNavItem, hidden: Set<string>): PopsNavItem | null {
  if (item.type === "link") {
    return hidden.has(item.path) ? null : item;
  }
  const children = item.children.filter((c) => !hidden.has(c.path));
  if (children.length === 0) return null;
  if (children.length === 1) {
    const only = children[0]!;
    const link: PopsNavLink = { type: "link", path: only.path, label: only.label };
    return link;
  }
  const group: PopsNavGroup = { type: "group", label: item.label, children };
  return group;
}

export function getNavItemsForSystem(id: BusinessSystemId): PopsNavItem[] {
  if (id === "pharmacy") {
    return pharmacyNavItems;
  }
  if (id === "general-store") {
    return storeNavItems;
  }
  const hidden = businessSystems[id].hiddenNavPaths;
  const out: PopsNavItem[] = [];
  for (const item of popsNavItems) {
    const filtered = filterNavItem(item, hidden);
    if (filtered) out.push(filtered);
  }
  return out;
}
