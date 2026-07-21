/**
 * POS keyboard shortcuts (desktop).
 * F-keys work even while typing in most fields (except when a modal owns focus).
 */
export const POS_SHORTCUTS = {
  qtyIncrease: { key: "F2", label: "Qty +" },
  orderType: { key: "F3", label: "Order type" },
  quickOrder: { key: "F4", label: "Order" },
  pay: { key: "F5", label: "Pay" },
  cashierIn: { key: "F6", label: "Cashier in" },
  cashierOut: { key: "F7", label: "Cashier out" },
  printBill: { key: "F8", label: "Print invoice" },
  search: { key: "F9", label: "Item search" },
  payOut: { key: "F10", label: "Paying out" },
  theme: { key: "F11", label: "Theme" },
} as const;

export type PosShortcutId = keyof typeof POS_SHORTCUTS;

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function matchPosShortcut(e: KeyboardEvent): PosShortcutId | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const key = e.key;
  for (const [id, def] of Object.entries(POS_SHORTCUTS) as [PosShortcutId, { key: string }][]) {
    if (key === def.key) return id;
  }
  // Extra: physical + / = increases qty when not typing
  if (key === "+" || key === "=") return "qtyIncrease";
  return null;
}

export function posShortcutHint(id: PosShortcutId): string {
  return POS_SHORTCUTS[id].key;
}
