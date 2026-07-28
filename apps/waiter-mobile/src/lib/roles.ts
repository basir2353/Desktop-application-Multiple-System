import type { AccessTokenClaims } from "./jwt";

export type StaffRole = "waiter" | "rider" | "cashier";
export type AppKind = "staff" | "admin" | "staff-locked";

export function resolveStaffRole(claims: AccessTokenClaims | null): StaffRole | null {
  if (!claims) return null;
  if (claims.role === "rider") return "rider";
  if (claims.role === "cashier") return "cashier";
  if (claims.role === "waiter") return "waiter";
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  if (permissions.includes("pops.delivery.manage") && claims.riderId) return "rider";
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

export function canCloseOrders(claims: AccessTokenClaims | null): boolean {
  if (!claims) return false;
  return claims.role === "cashier" || claims.role === "manager" || claims.role === "admin";
}
