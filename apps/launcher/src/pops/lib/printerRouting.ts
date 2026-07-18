/**
 * Printer profiles and section-based order routing — per-branch, localStorage-backed.
 *
 * This is deliberately separate from `printerAssignmentSettings.ts` (the existing
 * single-printer-name-per-user/category/item feature on the Printer page), which is
 * left untouched. This module powers the new multi-section "Print To" checkboxes on
 * categories/items and the printer-section management screen.
 */
import type { PosCartLine } from "./posCart";
import { loadPrinterSections, savePrinterSections, type PrinterSection } from "./printerSections";

export type PrinterPaperSize = "58mm" | "80mm" | "A4";

/** A printer profile — reusable print settings a section, category, item, or user can
 * point at. Optionally linked to a real OS printer (`systemPrinterName`) detected via
 * the native bridge; status otherwise falls back to manual staff-set state. */
export type PrinterProfile = {
  id: string;
  name: string;
  status: "online" | "offline";
  notes?: string;
  systemPrinterName?: string;
  copies: number;
  paperSize: PrinterPaperSize;
  autoCut: boolean;
};

export type PrinterRoutingState = {
  printers: PrinterProfile[];
  /** sectionId -> ordered printer ids; index 0 is primary, rest are backup. */
  sectionPrinters: Record<string, string[]>;
  /** categoryId -> section ids that category prints to. */
  byCategory: Record<string, string[]>;
  /** itemId -> section ids override. Absent = inherit from category. Present (even []) = explicit override. */
  byItem: Record<string, string[]>;
};

function emptyState(): PrinterRoutingState {
  return { printers: [], sectionPrinters: {}, byCategory: {}, byItem: {} };
}

export const PRINTER_ROUTING_CHANGED_EVENT = "pops-printer-routing-changed";

const STORAGE_KEY = "pops-printer-routing-v1";

function readAll(): Record<string, PrinterRoutingState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PrinterRoutingState>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PrinterRoutingState>, branchCode: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(PRINTER_ROUTING_CHANGED_EVENT, { detail: { branchCode } }));
  } catch {
    // ignore storage errors
  }
}

export function loadPrinterRouting(branchCode: string | undefined): PrinterRoutingState {
  if (!branchCode) return emptyState();
  const all = readAll();
  return all[branchCode] ?? emptyState();
}

function saveState(branchCode: string, state: PrinterRoutingState): void {
  const all = readAll();
  all[branchCode] = state;
  writeAll(all, branchCode);
}

// --- Printer profiles -------------------------------------------------

function newPrinterId(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "printer"}-${Date.now().toString(36)}`;
}

export function addPrinterProfile(
  branchCode: string,
  name: string,
  extra?: { notes?: string; systemPrinterName?: string },
): PrinterProfile {
  const state = loadPrinterRouting(branchCode);
  const profile: PrinterProfile = {
    id: newPrinterId(name),
    name: name.trim(),
    status: "online",
    notes: extra?.notes,
    systemPrinterName: extra?.systemPrinterName,
    copies: 1,
    paperSize: "80mm",
    autoCut: true,
  };
  saveState(branchCode, { ...state, printers: [...state.printers, profile] });
  return profile;
}

export function updatePrinterProfile(
  branchCode: string,
  printerId: string,
  patch: Partial<Omit<PrinterProfile, "id">>,
): void {
  const state = loadPrinterRouting(branchCode);
  saveState(branchCode, {
    ...state,
    printers: state.printers.map((p) => (p.id === printerId ? { ...p, ...patch } : p)),
  });
}

export function duplicatePrinterProfile(branchCode: string, printerId: string): PrinterProfile | null {
  const state = loadPrinterRouting(branchCode);
  const source = state.printers.find((p) => p.id === printerId);
  if (!source) return null;
  const copy: PrinterProfile = { ...source, id: newPrinterId(source.name), name: `${source.name} (copy)` };
  saveState(branchCode, { ...state, printers: [...state.printers, copy] });
  return copy;
}

export function deletePrinterProfile(branchCode: string, printerId: string): void {
  const state = loadPrinterRouting(branchCode);
  const sectionPrinters: Record<string, string[]> = {};
  for (const [sectionId, ids] of Object.entries(state.sectionPrinters)) {
    sectionPrinters[sectionId] = ids.filter((id) => id !== printerId);
  }
  saveState(branchCode, {
    ...state,
    printers: state.printers.filter((p) => p.id !== printerId),
    sectionPrinters,
  });
}

// --- Section <-> printer assignment ------------------------------------

export function setSectionPrinters(branchCode: string, sectionId: string, printerIds: string[]): void {
  const state = loadPrinterRouting(branchCode);
  saveState(branchCode, {
    ...state,
    sectionPrinters: { ...state.sectionPrinters, [sectionId]: printerIds },
  });
}

/** Toggle a printer in/out of a section's list, keeping existing order (new ones append as backup). */
export function togglePrinterForSection(
  branchCode: string,
  sectionId: string,
  printerId: string,
  assign: boolean,
): void {
  const state = loadPrinterRouting(branchCode);
  const current = state.sectionPrinters[sectionId] ?? [];
  const next = assign
    ? current.includes(printerId)
      ? current
      : [...current, printerId]
    : current.filter((id) => id !== printerId);
  setSectionPrinters(branchCode, sectionId, next);
}

/** Move a section's printer up (-1) or down (+1) in priority order — index 0 stays primary. */
export function movePrinterPriority(branchCode: string, sectionId: string, printerId: string, direction: -1 | 1): void {
  const state = loadPrinterRouting(branchCode);
  const current = [...(state.sectionPrinters[sectionId] ?? [])];
  const index = current.indexOf(printerId);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= current.length) return;
  [current[index], current[target]] = [current[target], current[index]];
  setSectionPrinters(branchCode, sectionId, current);
}

// --- Category / item -> sections ---------------------------------------

export function setCategorySections(branchCode: string, categoryId: string, sectionIds: string[]): void {
  const state = loadPrinterRouting(branchCode);
  saveState(branchCode, { ...state, byCategory: { ...state.byCategory, [categoryId]: sectionIds } });
}

/** `null` clears the override so the item inherits its category's sections again. */
export function setItemSections(branchCode: string, itemId: string, sectionIds: string[] | null): void {
  const state = loadPrinterRouting(branchCode);
  const byItem = { ...state.byItem };
  if (sectionIds === null) {
    delete byItem[itemId];
  } else {
    byItem[itemId] = sectionIds;
  }
  saveState(branchCode, { ...state, byItem });
}

export function itemHasSectionOverride(branchCode: string | undefined, itemId: string): boolean {
  if (!branchCode) return false;
  return itemId in loadPrinterRouting(branchCode).byItem;
}

/** Resolve which sections a cart line should print to: item override > category > none. */
export function resolveSectionsForLine(
  branchCode: string | undefined,
  line: Pick<PosCartLine, "item">,
): string[] {
  if (!branchCode) return [];
  const state = loadPrinterRouting(branchCode);
  if (line.item.id in state.byItem) return state.byItem[line.item.id] ?? [];
  return state.byCategory[line.item.categoryId] ?? [];
}

/** Group cart lines by resolved section. Lines with no section assigned are grouped under `null`. */
export function groupCartLinesBySection(
  branchCode: string | undefined,
  lines: PosCartLine[],
  enabledSectionIds: Set<string>,
): { sectionId: string | null; lines: PosCartLine[] }[] {
  const groups = new Map<string | null, PosCartLine[]>();
  for (const line of lines) {
    const sections = resolveSectionsForLine(branchCode, line).filter((id) => enabledSectionIds.has(id));
    if (sections.length === 0) {
      groups.set(null, [...(groups.get(null) ?? []), line]);
      continue;
    }
    for (const sectionId of sections) {
      groups.set(sectionId, [...(groups.get(sectionId) ?? []), line]);
    }
  }
  return [...groups.entries()].map(([sectionId, groupLines]) => ({ sectionId, lines: groupLines }));
}

// --- Backup / restore ----------------------------------------------------

export type PrinterConfigBackup = {
  version: 1;
  exportedAt: string;
  sections: PrinterSection[];
  routing: PrinterRoutingState;
};

/** Serializes sections + routing (profiles, section/category/item assignment) to JSON. */
export function exportPrinterConfig(branchCode: string): string {
  const backup: PrinterConfigBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sections: loadPrinterSections(branchCode),
    routing: loadPrinterRouting(branchCode),
  };
  return JSON.stringify(backup, null, 2);
}

/** Restores sections + routing from a JSON string produced by `exportPrinterConfig`. */
export function importPrinterConfig(branchCode: string, json: string): void {
  const parsed = JSON.parse(json) as Partial<PrinterConfigBackup>;
  if (parsed.version !== 1 || !Array.isArray(parsed.sections) || !parsed.routing) {
    throw new Error("Invalid printer configuration file.");
  }
  savePrinterSections(branchCode, parsed.sections);
  saveState(branchCode, parsed.routing);
}
