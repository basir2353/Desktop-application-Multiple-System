export type PrinterAssignment = {
  printerName: string;
};

export const PRINTER_PRESETS = [
  "Kitchen printer",
  "Bar printer",
  "Patio printer",
  "Waiter station 1",
  "Waiter station 2",
  "Grill station",
] as const;

export const PRINTER_ASSIGNMENT_CHANGED_EVENT = "pops-printer-assignment-changed";

const STORAGE_KEY = "pops-printer-assignments-v1";

type BranchPrinterMap = {
  byUser: Record<string, PrinterAssignment>;
  byCategory: Record<string, PrinterAssignment>;
  byItem: Record<string, PrinterAssignment>;
};

function emptyBranchMap(): BranchPrinterMap {
  return { byUser: {}, byCategory: {}, byItem: {} };
}

function readAll(): Record<string, BranchPrinterMap> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BranchPrinterMap>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, BranchPrinterMap>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

function branchMap(branchCode: string): BranchPrinterMap {
  const all = readAll();
  return all[branchCode] ?? emptyBranchMap();
}

function saveBranchMap(branchCode: string, map: BranchPrinterMap): void {
  const all = readAll();
  all[branchCode] = map;
  writeAll(all);
  window.dispatchEvent(
    new CustomEvent(PRINTER_ASSIGNMENT_CHANGED_EVENT, { detail: { branchCode } }),
  );
}

function setAssignment(
  branchCode: string,
  bucket: keyof BranchPrinterMap,
  id: string,
  printerName: string,
): PrinterAssignment | null {
  const map = branchMap(branchCode);
  const trimmed = printerName.trim();
  if (!trimmed) {
    delete map[bucket][id];
  } else {
    map[bucket][id] = { printerName: trimmed };
  }
  saveBranchMap(branchCode, map);
  return trimmed ? { printerName: trimmed } : null;
}

export function loadPrinterAssignments(branchCode: string | undefined): BranchPrinterMap {
  if (!branchCode) return emptyBranchMap();
  return branchMap(branchCode);
}

export function setUserPrinter(
  branchCode: string,
  userId: string,
  printerName: string,
): PrinterAssignment | null {
  return setAssignment(branchCode, "byUser", userId, printerName);
}

export function setCategoryPrinter(
  branchCode: string,
  categoryId: string,
  printerName: string,
): PrinterAssignment | null {
  return setAssignment(branchCode, "byCategory", categoryId, printerName);
}

export function setItemPrinter(
  branchCode: string,
  itemId: string,
  printerName: string,
): PrinterAssignment | null {
  return setAssignment(branchCode, "byItem", itemId, printerName);
}

/** Resolve printer for a cart line — item > category > user (waiter). */
export function resolveLinePrinter(
  branchCode: string | undefined,
  opts: {
    menuItemId?: string;
    categoryId?: string;
    waiterId?: string | null;
  },
): PrinterAssignment | null {
  if (!branchCode) return null;
  const map = branchMap(branchCode);
  if (opts.menuItemId && map.byItem[opts.menuItemId]?.printerName) {
    return map.byItem[opts.menuItemId];
  }
  if (opts.categoryId && map.byCategory[opts.categoryId]?.printerName) {
    return map.byCategory[opts.categoryId];
  }
  if (opts.waiterId && map.byUser[opts.waiterId]?.printerName) {
    return map.byUser[opts.waiterId];
  }
  return null;
}
