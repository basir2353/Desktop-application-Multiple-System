import type { AccessTokenClaims } from "../../lib/jwt";

/**
 * Back-dated bill date is admin-only.
 * Cashiers / counter staff always save with today's date.
 */
export function canEditMobizoneBillDate(claims: AccessTokenClaims | null | undefined): boolean {
  if (!claims) return false;
  const perms = claims.permissions ?? [];
  if (perms.includes("*") || perms.includes("pops.users.manage")) return true;
  const role = String(claims.role ?? "").toLowerCase();
  return role === "admin" || role === "owner" || role === "super_admin";
}
