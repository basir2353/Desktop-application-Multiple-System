import type { AccessTokenClaims } from "../../lib/jwt";
import type { PopsRole } from "../../stores/popsStore";

const POS_PRINT_STATION_KEY = "pops-pos-print-station-v1";

/** Roles that never drive the shop thermal (Option 19). */
const THERMAL_BLOCKED_ROLES = new Set<string>(["accountant", "hr"]);

/** Roles that are POS/floor by default (may Auto-print on this PC). */
const THERMAL_DEFAULT_ROLES = new Set<string>(["cashier", "waiter", "kitchen", "rider"]);

export function isPosPrintStationEnabled(): boolean {
  try {
    const raw = localStorage.getItem(POS_PRINT_STATION_KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    /* ignore */
  }
  return false;
}

/** Mark this Windows PC as the POS thermal station (bills + KOT Auto print). */
export function setPosPrintStationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(POS_PRINT_STATION_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * Option 19: only the POS print-station PC should hit physical thermals.
 * Accountant / Inventory / Owner laptops get Export PDF/Excel instead.
 */
export function canDirectThermalPrint(
  claims: AccessTokenClaims | null | undefined,
  displayRole?: PopsRole | string | null,
): boolean {
  const role = String(claims?.role ?? displayRole ?? "")
    .trim()
    .toLowerCase();
  if (!role) return isPosPrintStationEnabled();
  if (THERMAL_BLOCKED_ROLES.has(role)) return false;
  if (isPosPrintStationEnabled()) return true;
  // Cashier / waiter / kitchen default ON so existing POS PCs keep working
  // without a one-time Settings toggle. Admin/manager/owner stay OFF until
  // they enable “This PC is POS print station”.
  return THERMAL_DEFAULT_ROLES.has(role);
}

export function directThermalPrintBlockedMessage(): string {
  return "Direct thermal print is disabled on this PC (Option 19). Use Export PDF / Export Excel, or enable “This PC is POS print station” under Settings → Printers on the cashier POS only.";
}
