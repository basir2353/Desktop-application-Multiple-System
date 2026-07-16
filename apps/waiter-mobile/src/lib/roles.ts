import type { AccessTokenClaims } from "./jwt";

export type StaffRole = "waiter" | "rider" | "cashier";

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

export function homeRouteForRole(role: StaffRole | null): "/home" | "/rider-home" {
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
