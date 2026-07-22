import { canManageOrgUsers, permissionsForPopsRole } from "@platform/contracts";
import type { AccessTokenClaims } from "../../lib/jwt";
import type { BusinessSystemId } from "../../lib/businessSystems";
import type { PopsNavGroup, PopsNavItem, PopsNavLink } from "../spec/modules";
import type { PopsRole } from "../../stores/popsStore";

const POPS_ROLES: readonly PopsRole[] = [
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "accountant",
  "hr",
  "rider",
];

export function isPopsRole(value: string | undefined | null): value is PopsRole {
  return Boolean(value && (POPS_ROLES as readonly string[]).includes(value));
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  required: readonly string[],
): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes("*")) return true;
  if (required.length === 0) return true;
  return required.some((p) => permissions.includes(p));
}

export function sessionCanManageUsers(claims: AccessTokenClaims | null | undefined): boolean {
  return canManageOrgUsers(claims?.permissions ?? []);
}

/** Floor / ops actions managers and admins share (not user provisioning). */
export function sessionCanManageFloor(claims: AccessTokenClaims | null | undefined): boolean {
  return hasAnyPermission(claims?.permissions, [
    "pops.menu.manage",
    "pops.inventory.manage",
    "pops.multi_branch.manage",
    "pops.users.manage",
  ]);
}

/**
 * Path → any-of permissions. Paths with no entry only need `pops.read`.
 * Admin `*` always passes.
 */
const NAV_PATH_ANY_OF: Record<string, readonly string[]> = {
  /** Main ERP dashboard — admin only. */
  dashboard: ["pops.users.manage"],
  "pharmacy/dashboard": ["pops.users.manage"],
  "store/dashboard": ["pops.users.manage"],
  auth: ["pops.users.manage"],
  menu: ["pops.menu.manage"],
  purchase: ["pops.inventory.manage"],
  inventory: ["pops.inventory.manage"],
  tax: ["pops.accounting.manage"],
  accounting: ["pops.accounting.manage"],
  hr: ["pops.hr.manage"],
  "multi-branch": ["pops.multi_branch.manage"],
  "notifications/templates": ["pops.notifications.manage"],
  closing: ["pops.closing.report"],
  kitchen: ["pops.kitchen.bump", "pops.read"],
  delivery: ["pops.delivery.manage", "pops.menu.manage", "pops.multi_branch.manage"],
  manufacturing: ["pops.inventory.manage", "pops.menu.manage"],
  content: ["pops.menu.manage"],
  "pharmacy/admin-panel": ["pops.users.manage", "pops.inventory.manage"],
  "store/admin": ["pops.users.manage", "pops.inventory.manage"],
};

function requiredForPath(path: string): readonly string[] {
  if (NAV_PATH_ANY_OF[path]) return NAV_PATH_ANY_OF[path]!;
  const segments = path.split("/");
  const top = segments[0] ?? path;
  if (top === "inventory") return NAV_PATH_ANY_OF.inventory!;
  if (top === "accounting") return NAV_PATH_ANY_OF.accounting!;
  if (top === "hr") return NAV_PATH_ANY_OF.hr!;
  if (top === "multi-branch") return NAV_PATH_ANY_OF["multi-branch"]!;
  if (top === "notifications" && segments.length > 1 && segments[1] !== "") {
    return NAV_PATH_ANY_OF["notifications/templates"]!;
  }
  return ["pops.read"];
}

export function canAccessNavPath(path: string, permissions: readonly string[]): boolean {
  return hasAnyPermission(permissions, requiredForPath(path));
}

/** Primary permission to grant when enabling a nav path from the admin UI. */
export function primaryPermissionForNavPath(path: string): string {
  const required = requiredForPath(path);
  return required[0] ?? "pops.read";
}

export function allRestaurantNavPaths(items: readonly PopsNavItem[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (item.type === "link") out.push(item.path);
    else out.push(...item.children.map((c) => c.path));
  }
  return out;
}

function filterNavItem(
  item: PopsNavItem,
  permissions: readonly string[],
  allow: Set<string> | null,
): PopsNavItem | null {
  if (item.type === "link") {
    if (!canAccessNavPath(item.path, permissions)) return null;
    if (allow && !allow.has(item.path)) return null;
    return item;
  }
  const children = item.children.filter((c) => {
    if (!canAccessNavPath(c.path, permissions)) return false;
    if (allow && !allow.has(c.path)) return false;
    return true;
  });
  if (children.length === 0) return null;
  if (children.length === 1) {
    const only = children[0]!;
    const link: PopsNavLink = { type: "link", path: only.path, label: only.label };
    return link;
  }
  const group: PopsNavGroup = { type: "group", label: item.label, children };
  return group;
}

export function filterNavItemsByPermissions(
  items: readonly PopsNavItem[],
  permissions: readonly string[],
  navAllowlist?: string[] | null,
): PopsNavItem[] {
  const allow = navAllowlist == null ? null : new Set(navAllowlist);
  const out: PopsNavItem[] = [];
  for (const item of items) {
    const filtered = filterNavItem(item, permissions, allow);
    if (filtered) out.push(filtered);
  }
  return out;
}

export function erpEntryPathForRole(
  systemId: BusinessSystemId,
  role: PopsRole | string | undefined,
): string {
  if (systemId === "pharmacy") {
    return role === "admin" ? "/pops/pharmacy/dashboard" : "/pops/pharmacy/pos";
  }
  if (systemId === "general-store") {
    return role === "admin" ? "/pops/store/dashboard" : "/pops/store/pos";
  }

  switch (role) {
    case "cashier":
      return "/pops/pos";
    case "waiter":
      return "/pops/waiter";
    case "kitchen":
      return "/pops/kitchen";
    case "accountant":
      return "/pops/accounting";
    case "hr":
      return "/pops/hr";
    case "rider":
      return "/pops/delivery";
    case "manager":
      return "/pops/multi-branch";
    case "admin":
      return "/pops/dashboard";
    default:
      return "/pops/pos";
  }
}

/** Whether JWT permissions cover (are a superset of) a role template — used for safe workspace preview. */
export function roleIsWithinPermissions(
  role: PopsRole,
  permissions: readonly string[],
): boolean {
  if (permissions.includes("*")) return true;
  const needed = permissionsForPopsRole(role).filter((p) => p !== "*");
  const set = new Set(permissions);
  return needed.every((p) => set.has(p));
}

export function filterBranchesByScope<T extends { code: string }>(
  branches: readonly T[],
  branchScope: string | undefined,
): T[] {
  if (!branchScope || branchScope === "all") return [...branches];
  const code = branchScope.toUpperCase();
  return branches.filter((b) => b.code.toUpperCase() === code);
}
