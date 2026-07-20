/** Admin-configurable visibility for optional POS order-type tabs, per branch. */

export type PosOrderModeVisibility = {
  onlineEnabled: boolean;
  foodpandaEnabled: boolean;
  staffFoodEnabled: boolean;
};

export const DEFAULT_POS_ORDER_MODE_VISIBILITY: PosOrderModeVisibility = {
  onlineEnabled: true,
  foodpandaEnabled: true,
  staffFoodEnabled: true,
};

export const POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT = "pops-pos-order-mode-visibility-changed";

const STORAGE_KEY = "pops-pos-order-mode-visibility-v1";

export function normalizePosOrderModeVisibility(
  input: Partial<PosOrderModeVisibility>,
): PosOrderModeVisibility {
  return {
    onlineEnabled: input.onlineEnabled ?? true,
    foodpandaEnabled: input.foodpandaEnabled ?? true,
    staffFoodEnabled: input.staffFoodEnabled ?? true,
  };
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
      new CustomEvent(POS_ORDER_MODE_VISIBILITY_CHANGED_EVENT, { detail: { branchCode, visibility: next } }),
    );
  } catch {
    // ignore storage errors
  }
}
