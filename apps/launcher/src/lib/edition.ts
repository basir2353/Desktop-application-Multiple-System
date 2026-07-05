import {
  businessSystems,
  businessSystemList,
  isBusinessSystemId,
  type BusinessSystem,
  type BusinessSystemId,
} from "./businessSystems";

/**
 * Edition = the business module baked into this build/installer.
 *
 * - A specific id (`restaurant` | `pharmacy` | `general-store`) produces a
 *   single-system installer that boots straight into that system and hides all
 *   others (the modular per-.exe installation).
 * - `"suite"` keeps every system available behind the picker (dev + admin build).
 *
 * The value is injected at build time via Vite `define` from `PLATFORM_EDITION`
 * (see vite.config.ts). Defaults to `"suite"` when unset.
 */
export type PlatformEdition = BusinessSystemId | "suite";

// Vite `define` replaces `__PLATFORM_EDITION__` with a string literal at build
// time (see vite.config.ts). Referencing it directly in the comparisons below
// lets Rollup fold each `HAS_*` to a literal boolean and tree-shake the route
// chunks of systems not shipped in this edition.
declare const __PLATFORM_EDITION__: string;

/**
 * Compile-time edition flags. In a locked build only one of the three system
 * flags is `true`; the rest fold to `false` so their code is dropped from the
 * bundle. `suite` builds keep everything.
 */
export const IS_SUITE = __PLATFORM_EDITION__ === "suite";
export const HAS_RESTAURANT =
  __PLATFORM_EDITION__ === "suite" || __PLATFORM_EDITION__ === "restaurant";
export const HAS_PHARMACY =
  __PLATFORM_EDITION__ === "suite" || __PLATFORM_EDITION__ === "pharmacy";
export const HAS_GENERAL_STORE =
  __PLATFORM_EDITION__ === "suite" || __PLATFORM_EDITION__ === "general-store";

function normalizeEdition(raw: string): PlatformEdition {
  if (!raw || raw === "suite" || raw === "all") return "suite";
  return isBusinessSystemId(raw) ? raw : "suite";
}

export const PLATFORM_EDITION: PlatformEdition = normalizeEdition(__PLATFORM_EDITION__);

/** True when this build ships a single locked business system. */
export function isSingleSystemEdition(): boolean {
  return !IS_SUITE;
}

/** The locked system id for single-system editions, else null. */
export function getLockedSystemId(): BusinessSystemId | null {
  if (IS_SUITE) return null;
  return isBusinessSystemId(PLATFORM_EDITION) ? PLATFORM_EDITION : null;
}

/** Business systems visible in this edition (one for locked builds, all for suite). */
export function getAvailableSystems(): BusinessSystem[] {
  const locked = getLockedSystemId();
  return locked ? [businessSystems[locked]] : businessSystemList;
}

/** True when `id` is installed/available in this edition. */
export function isSystemAvailable(id: BusinessSystemId): boolean {
  if (id === "restaurant") return HAS_RESTAURANT;
  if (id === "pharmacy") return HAS_PHARMACY;
  if (id === "general-store") return HAS_GENERAL_STORE;
  return false;
}
