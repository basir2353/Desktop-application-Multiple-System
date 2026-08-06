/** Admin-configurable visibility for POS order-type tabs, per branch. */

import { POS_ORDER_MODES, type PosOrderMode } from "./posOrderMode";

export type PosOrderModeVisibility = {
  dineInEnabled: boolean;
  takeawayEnabled: boolean;
  deliveryEnabled: boolean;
  onlineEnabled: boolean;
  foodpandaEnabled: boolean;
  staffFoodEnabled: boolean;
};

export const DEFAULT_POS_ORDER_MODE_VISIBILITY: PosOrderModeVisibility = {
  dineInEnabled: true,
  takeawayEnabled: true,
  deliveryEnabled: true,
  onlineEnabled: true,
  foodpandaEnabled: true,
  staffFoodEnabled: true,
};

export const POS_ORDER_MODE_VISIBILITY_KEYS: Record<
  PosOrderMode,
  keyof PosOrderModeVisibility
> = {
  "dine-in": "dineInEnabled",
  takeaway: "takeawayEnabled",
  delivery: "deliveryEnabled",
  online: "onlineEnabled",
  foodpanda: "foodpandaEnabled",
  "staff-food": "staffFoodEnabled",
};

export const POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT = "pops-pos-order-mode-visibility-changed";

const STORAGE_KEY = "pops-pos-order-mode-visibility-v1";

export function normalizePosOrderModeVisibility(
  input: Partial<PosOrderModeVisibility>,
): PosOrderModeVisibility {
  const next: PosOrderModeVisibility = {
    dineInEnabled: input.dineInEnabled ?? DEFAULT_POS_ORDER_MODE_VISIBILITY.dineInEnabled,
    takeawayEnabled: input.takeawayEnabled ?? DEFAULT_POS_ORDER_MODE_VISIBILITY.takeawayEnabled,
    deliveryEnabled: input.deliveryEnabled ?? DEFAULT_POS_ORDER_MODE_VISIBILITY.deliveryEnabled,
    onlineEnabled: input.onlineEnabled ?? DEFAULT_POS_ORDER_MODE_VISIBILITY.onlineEnabled,
    foodpandaEnabled: input.foodpandaEnabled ?? DEFAULT_POS_ORDER_MODE_VISIBILITY.foodpandaEnabled,
    staffFoodEnabled: input.staffFoodEnabled ?? DEFAULT_POS_ORDER_MODE_VISIBILITY.staffFoodEnabled,
  };
  // Always keep at least one order type visible on POS.
  if (!Object.values(next).some(Boolean)) {
    next.dineInEnabled = true;
  }
  return next;
}

export function isPosOrderModeVisible(
  mode: PosOrderMode,
  visibility: PosOrderModeVisibility,
): boolean {
  return Boolean(visibility[POS_ORDER_MODE_VISIBILITY_KEYS[mode]]);
}

export function firstVisiblePosOrderMode(visibility: PosOrderModeVisibility): PosOrderMode {
  for (const mode of POS_ORDER_MODES) {
    if (isPosOrderModeVisible(mode.id, visibility)) return mode.id;
  }
  return "dine-in";
}

export function loadPosOrderModeVisibility(branchCode: string | undefined): PosOrderModeVisibility {
  if (!branchCode) return DEFAULT_POS_ORDER_MODE_VISIBILITY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POS_ORDER_MODE_VISIBILITY;
    const parsed = JSON.parse(raw) as Record<string, Partial<PosOrderModeVisibility>>;
    const stored = parsed[branchCode];
    return stored ? normalizePosOrderModeVisibility(stored) : DEFAULT_POS_ORDER_MODE_VISIBILITY;
  } catch {
    return DEFAULT_POS_ORDER_MODE_VISIBILITY;
  }
}

export function savePosOrderModeVisibility(
  branchCode: string,
  visibility: PosOrderModeVisibility,
): void {
  const next = normalizePosOrderModeVisibility(visibility);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PosOrderModeVisibility>) : {};
    parsed[branchCode] = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(
      new CustomEvent(POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT, {
        detail: { branchCode, visibility: next },
      }),
    );
  } catch {
    // ignore storage errors
  }
}
