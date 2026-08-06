import type { AccessTokenClaims } from "./jwt";

export type StaffRole = "waiter" | "rider" | "cashier";
export type AppKind = "staff" | "admin" | "staff-locked";

export function resolveStaffRole(claims: AccessTokenClaims | null): StaffRole | null {
  if (!claims) return null;
  const role = (claims.role ?? "").toLowerCase();
  if (role === "rider") return "rider";
  // Manager / admin / owner use cashier privileges in the staff app (Close, RPRA, pay).
  if (role === "cashier" || role === "manager" || role === "admin" || role === "owner") {
    return "cashier";
  }
  if (role === "waiter") return "waiter";
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  if (permissions.includes("pops.delivery.manage") && claims.riderId) return "rider";
  if (permissions.includes("pops.billing.manage") || permissions.includes("pops.pos.manage")) {
    return "cashier";
  }
  if (permissions.includes("pops.kitchen.bump")) return "waiter";
  return "waiter";
}

export function isAdminOrIncharge(claims: AccessTokenClaims | null): boolean {
  if (!claims) return false;
  const role = (claims.role ?? "").toLowerCase();
  // owner = org owner (seeded admin); manager = Incharge
  if (role === "admin" || role === "owner" || role === "manager") return true;
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return permissions.includes("pops.users.manage") || permissions.includes("*");
}

/** Admin / Incharge (manager) may toggle PRA. Waiter/rider cannot. */
export function canTogglePra(claims: AccessTokenClaims | null): boolean {
  if (!claims) return false;
  const role = (claims.role ?? "").toLowerCase();
  if (role === "admin" || role === "owner" || role === "manager") return true;
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return permissions.includes("pops.users.manage") || permissions.includes("*");
}

export function homeRouteForRole(
  role: StaffRole | null,
  appKind: AppKind = "staff",
): "/home" | "/rider-home" | "/admin-home" {
  if (appKind === "admin") return "/admin-home";
  return role === "rider" ? "/rider-home" : "/home";
}

export function isWaiterRole(claims: AccessTokenClaims | null): boolean {
  return resolveStaffRole(claims) === "waiter";
}

export function isRiderRole(claims: AccessTokenClaims | null): boolean {
  return resolveStaffRole(claims) === "rider";
}

export function isCashierRole(claims: AccessTokenClaims | null): boolean {
  return resolveStaffRole(claims) === "cashier";
}

/** Cashier / manager / admin may close any order. Waiters close only tickets they own (UI gate). */
export function canCloseOrders(claims: AccessTokenClaims | null): boolean {
  if (!claims) return false;
  const role = (claims.role ?? "").toLowerCase();
  if (role === "cashier" || role === "manager" || role === "admin" || role === "owner") {
    return true;
  }
  // Prefer role resolution so manager/admin are not misclassified as waiters.
  return resolveStaffRole(claims) === "cashier";
}
