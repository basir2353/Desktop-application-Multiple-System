/**
 * POS keyboard shortcuts (desktop).
 * F-keys work even while typing in most fields (except when a modal owns focus).
 * Letter shortcuts (e.g. P) only fire when not typing in an input.
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
  customer: { key: "F12", label: "Customer" },
  /** Selected bill in Latest orders / Orders list — quick reprint. */
  quickPrint: { key: "P", label: "Quick print selected" },
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
    if (key === def.key) {
      // Letter shortcuts must not steal typing.
      if (def.key.length === 1 && isTypingTarget(e.target)) return null;
      return id;
    }
  }
  // Extra: physical + / = increases qty when not typing
  if ((key === "+" || key === "=") && !isTypingTarget(e.target)) return "qtyIncrease";
  // Case-insensitive P for quick print
  if ((key === "p" || key === "P") && !isTypingTarget(e.target)) return "quickPrint";
  return null;
}

export function posShortcutHint(id: PosShortcutId): string {
  return POS_SHORTCUTS[id].key;
}
