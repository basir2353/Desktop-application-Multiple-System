import type { AccessTokenClaims } from "./jwt";

export type StaffRole = "waiter" | "rider";

export function resolveStaffRole(claims: AccessTokenClaims | null): StaffRole | null {
  if (!claims) return null;
  if (claims.role === "rider") return "rider";
  if (claims.role === "waiter") return "waiter";
  if (claims.permissions.includes("pops.delivery.manage") && claims.riderId) return "rider";
  if (claims.permissions.includes("pops.kitchen.bump")) return "waiter";
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
