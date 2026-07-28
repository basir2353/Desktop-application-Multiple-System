/** General Store POS — F1–F12 map to screen actions (not products). */

export const STORE_POS_HOTKEYS = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
] as const;

export type StorePosHotkey = (typeof STORE_POS_HOTKEYS)[number];

export type StorePosActionId =
  | "none"
  | "focusSearch"
  | "focusCustomer"
  | "editQty"
  | "hold"
  | "pay"
  | "print"
  | "payIn"
  | "payOut"
  | "toggleQuickPick"
  | "viewBookmarks"
  | "viewAll"
  | "clearSearch"
  | "syncStock";

export type StorePosActionDef = {
  id: StorePosActionId;
  label: string;
  hint: string;
};

export const STORE_POS_ACTIONS: StorePosActionDef[] = [
  { id: "none", label: "— None —", hint: "Key does nothing" },
  { id: "focusSearch", label: "Go to search bar", hint: "Focus item scan / search" },
  { id: "focusCustomer", label: "Go to customer", hint: "Focus customer field" },
  { id: "clearSearch", label: "Clear search", hint: "Clear search and refocus" },
  { id: "editQty", label: "Edit quantity", hint: "Change qty of selected line" },
  { id: "hold", label: "Hold sale", hint: "Open hold checkout" },
  { id: "pay", label: "Pay / complete", hint: "Open payment" },
  { id: "print", label: "Print receipt", hint: "Print last / cart slip" },
  { id: "payIn", label: "Pay In", hint: "Open cash Pay In" },
  { id: "payOut", label: "Pay Out", hint: "Open cash Pay Out" },
  { id: "toggleQuickPick", label: "Quick Pick panel", hint: "Show / hide Quick Pick" },
  { id: "viewBookmarks", label: "Bookmarks view", hint: "Show bookmarked products" },
  { id: "viewAll", label: "All products view", hint: "Show full catalog" },
  { id: "syncStock", label: "Sync stock", hint: "Refresh inventory" },
];

export type StorePosActionMap = Record<StorePosHotkey, StorePosActionId>;

export const DEFAULT_STORE_POS_ACTION_MAP: StorePosActionMap = {
  F1: "focusSearch",
  F2: "toggleQuickPick",
  F3: "viewBookmarks",
  F4: "viewAll",
  F5: "focusCustomer",
  F6: "editQty",
  F7: "payIn",
  F8: "print",
  F9: "hold",
  F10: "pay",
  F11: "payOut",
  F12: "clearSearch",
};

const STORAGE_KEY = "store-pos-action-shortcuts";

function storageKey(branchCode?: string | null): string {
  return branchCode ? `${STORAGE_KEY}:${branchCode}` : STORAGE_KEY;
}

function isHotkey(v: string): v is StorePosHotkey {
  return (STORE_POS_HOTKEYS as readonly string[]).includes(v);
}

function isActionId(v: unknown): v is StorePosActionId {
  return typeof v === "string" && STORE_POS_ACTIONS.some((a) => a.id === v);
}

export function loadStorePosActionMap(branchCode?: string | null): StorePosActionMap {
  try {
    const raw = localStorage.getItem(storageKey(branchCode));
    if (!raw) return { ...DEFAULT_STORE_POS_ACTION_MAP };
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    const next = { ...DEFAULT_STORE_POS_ACTION_MAP };
    for (const key of STORE_POS_HOTKEYS) {
      const val = parsed[key];
      if (isActionId(val)) next[key] = val;
    }
    return next;
  } catch {
    return { ...DEFAULT_STORE_POS_ACTION_MAP };
  }
}

export function saveStorePosActionMap(map: StorePosActionMap, branchCode?: string | null): void {
  try {
    localStorage.setItem(storageKey(branchCode), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function actionLabel(id: StorePosActionId): string {
  return STORE_POS_ACTIONS.find((a) => a.id === id)?.label ?? id;
}

export function matchStorePosHotkey(e: KeyboardEvent): StorePosHotkey | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (!isHotkey(e.key)) return null;
  return e.key;
}
