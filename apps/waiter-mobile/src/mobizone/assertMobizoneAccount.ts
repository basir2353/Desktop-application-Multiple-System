import type { AccessTokenClaims } from "../lib/jwt";

/** Canonical MobiZone demo owner (seeded on live + local). */
export const MOBIZONE_DEMO_EMAIL = "admin.mobizone@pops.demo";
export const MOBIZONE_DEMO_PASSWORD = "Owner@12345";

/**
 * MobiZone APK / web must reject restaurant, pharmacy, MaterialFlow, etc.
 * JWT `systemType` is set from the user's organization on the live API.
 */
export function assertMobizoneAccount(claims: AccessTokenClaims): void {
  const systemType = (claims.systemType ?? "").trim().toLowerCase();
  if (systemType === "mobizone") return;

  const label = systemType
    ? systemType.replace(/_/g, " ")
    : "another business system";
  throw new Error(
    `This login belongs to ${label}. Only MobiZone ERP accounts can sign in to this app.`,
  );
}
