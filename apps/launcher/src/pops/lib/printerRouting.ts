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

export type PrinterPaperSize = "58mm" | "80mm" | "100mm" | "A4" | "custom";

/** Slip text size on this printer (KOT / receipt). */
export type PrinterTextScale = "S" | "M" | "L";

export const PRINTER_TEXT_SCALE_LABELS: Record<PrinterTextScale, string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
};

export function normalizePrinterTextScale(raw: unknown): PrinterTextScale {
  const t = String(raw ?? "").toUpperCase();
  if (t === "S" || t === "L") return t;
  return "M";
}

export function printerTextScaleFactor(scale: PrinterTextScale | undefined): number {
  if (scale === "S") return 0.85;
  if (scale === "L") return 1.2;
  return 1;
}

/** Logical role of a printer profile (restaurant + general-store). */
export type PrinterType =
  | "kitchen"
  | "bar"
  | "receipt"
  | "other"
  | "counter"
  | "warehouse"
  | "label";

export const PRINTER_TYPE_LABELS: Record<PrinterType, string> = {
  kitchen: "Kitchen",
  bar: "Bar",
  receipt: "Receipt",
  other: "Other",
  counter: "Counter",
  warehouse: "Warehouse",
  label: "Label",
};

export const RESTAURANT_PRINTER_TYPES: PrinterType[] = ["kitchen", "bar", "receipt", "other"];
export const STORE_PRINTER_TYPES: PrinterType[] = ["receipt", "counter", "warehouse", "label", "other"];

export function printerTypesForSystem(isStore: boolean): PrinterType[] {
  return isStore ? STORE_PRINTER_TYPES : RESTAURANT_PRINTER_TYPES;
}

/** Display label — remaps legacy Kitchen/Bar when viewing as General Store. */
export function printerTypeLabel(type: PrinterType, isStore = false): string {
  if (isStore) {
    if (type === "kitchen") return "Back office (legacy)";
    if (type === "bar") return "Extra till (legacy)";
  }
  return PRINTER_TYPE_LABELS[type];
}

const ALL_PRINTER_TYPES = new Set<string>([
  "kitchen",
  "bar",
  "receipt",
  "other",
  "counter",
  "warehouse",
  "label",
]);

export function normalizePrinterType(raw: unknown, fallback: PrinterType = "receipt"): PrinterType {
  const t = String(raw ?? "");
  return ALL_PRINTER_TYPES.has(t) ? (t as PrinterType) : fallback;
}

/** A printer profile — reusable print settings a section, category, item, or user can
 * point at. Optionally linked to a real OS printer (`systemPrinterName`) detected via
 * the native bridge; status otherwise falls back to manual staff-set state. */
export type PrinterProfile = {
  id: string;
  name: string;
  /** Kitchen / Bar / Receipt / Other */
  printerType: PrinterType;
  status: "online" | "offline";
  notes?: string;
  systemPrinterName?: string;
  /** Optional counter / till label (e.g. "Counter 1"). */
  assignedCounter?: string;
  /**
   * @deprecated Prefer `userPrinters` many-to-many map. Kept for migration from older builds.
   */
  assignedUserId?: string;
  copies: number;
  paperSize: PrinterPaperSize;
  /** Slip text size for this printer (S / M / L). */
  textScale: PrinterTextScale;
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
  /** Default receipt / bill printer profile id for POS pay & invoice. */
  receiptPrinterId?: string | null;
  /**
   * Many-to-many: userId → printer profile ids.
   * One user can have Kitchen + Bar + Receipt; one printer can be shared by many users.
   */
  userPrinters: Record<string, string[]>;
  /**
   * sectionId → user / waiter ids assigned to that section.
   * Users in a section prefer that section's printers when printing KOTs.
   */
  sectionUsers: Record<string, string[]>;
};

function emptyState(): PrinterRoutingState {
  return {
    printers: [],
    sectionPrinters: {},
    byCategory: {},
    byItem: {},
    receiptPrinterId: null,
    userPrinters: {},
    sectionUsers: {},
  };
}

function normalizeProfile(raw: Partial<PrinterProfile> & Pick<PrinterProfile, "id" | "name">): PrinterProfile {
  const systemPrinterName = raw.systemPrinterName?.trim() || undefined;
  return {
    id: raw.id,
    name: raw.name,
    printerType: normalizePrinterType(raw.printerType, "receipt"),
    status: raw.status === "offline" ? "offline" : "online",
    notes: raw.notes,
    // Keep every OS link (Epson, PDF, XPS, …) so Auto can print to the chosen device.
    systemPrinterName,
    assignedCounter: raw.assignedCounter,
    assignedUserId: raw.assignedUserId,
    copies: Math.max(1, Number(raw.copies) || 1),
    paperSize:
      raw.paperSize === "58mm" ||
      raw.paperSize === "80mm" ||
      raw.paperSize === "100mm" ||
      raw.paperSize === "A4" ||
      raw.paperSize === "custom"
        ? raw.paperSize
        : "80mm",
    textScale: normalizePrinterTextScale(raw.textScale),
    autoCut: raw.autoCut !== false,
  };
}

function migrateUserPrinters(
  printers: PrinterProfile[],
  existing: Record<string, string[]> | undefined,
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [userId, ids] of Object.entries(existing ?? {})) {
    const unique = [...new Set(ids.filter((id) => printers.some((p) => p.id === id)))];
    if (unique.length > 0) map[userId] = unique;
  }
  // Lift legacy single assignedUserId into the many-to-many map.
  for (const printer of printers) {
    const userId = printer.assignedUserId?.trim();
    if (!userId) continue;
    const current = map[userId] ?? [];
    if (!current.includes(printer.id)) map[userId] = [...current, printer.id];
  }
  return map;
}

function normalizeState(raw: Partial<PrinterRoutingState> | undefined): PrinterRoutingState {
  if (!raw) return emptyState();
  const printers = Array.isArray(raw.printers) ? raw.printers.map((p) => normalizeProfile(p)) : [];
  return {
    printers,
    sectionPrinters: raw.sectionPrinters ?? {},
    byCategory: raw.byCategory ?? {},
    byItem: raw.byItem ?? {},
    receiptPrinterId: raw.receiptPrinterId ?? null,
    userPrinters: migrateUserPrinters(printers, raw.userPrinters),
    sectionUsers: raw.sectionUsers ?? {},
  };
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
  return normalizeState(all[branchCode]);
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
  extra?: {
    notes?: string;
    systemPrinterName?: string;
    printerType?: PrinterType;
    assignedCounter?: string;
  },
): PrinterProfile {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Enter a printer name.");
  }
  const state = loadPrinterRouting(branchCode);
  const systemPrinterName = extra?.systemPrinterName?.trim() || undefined;
  const profile: PrinterProfile = {
    id: newPrinterId(trimmedName),
    name: trimmedName,
    printerType: extra?.printerType ?? "receipt",
    status: "online",
    notes: extra?.notes,
    systemPrinterName,
    assignedCounter: extra?.assignedCounter,
    copies: 1,
    paperSize: "80mm",
    textScale: "M",
    autoCut: true,
  };
  saveState(branchCode, { ...state, printers: [...state.printers, profile] });
  return profile;
}

/**
 * Legacy no-op — PDF/XPS/Fax links are allowed for Auto printing.
 * Kept so older call sites do not break.
 */
export function cleanupVirtualPrinterLinks(_branchCode: string): number {
  return 0;
}

export function setReceiptPrinter(branchCode: string, printerId: string | null): void {
  const state = loadPrinterRouting(branchCode);
  saveState(branchCode, { ...state, receiptPrinterId: printerId });
}

/** Assign or unassign a printer profile for a user (many-to-many). */
export function toggleUserPrinter(
  branchCode: string,
  userId: string,
  printerId: string,
  assign: boolean,
): void {
  const state = loadPrinterRouting(branchCode);
  if (!state.printers.some((p) => p.id === printerId)) return;
  const current = state.userPrinters[userId] ?? [];
  const next = assign
    ? current.includes(printerId)
      ? current
      : [...current, printerId]
    : current.filter((id) => id !== printerId);
  const userPrinters = { ...state.userPrinters };
  if (next.length === 0) delete userPrinters[userId];
  else userPrinters[userId] = next;
  saveState(branchCode, { ...state, userPrinters });
}

export function setUserPrinters(branchCode: string, userId: string, printerIds: string[]): void {
  const state = loadPrinterRouting(branchCode);
  const valid = [...new Set(printerIds.filter((id) => state.printers.some((p) => p.id === id)))];
  const userPrinters = { ...state.userPrinters };
  if (valid.length === 0) delete userPrinters[userId];
  else userPrinters[userId] = valid;
  saveState(branchCode, { ...state, userPrinters });
}

/**
 * Assign exactly one printer of a given type to a user (Receipt / Kitchen / Bar).
 * Other types already assigned to that user are kept. Pass null to clear that type.
 */
export function setUserPrinterForType(
  branchCode: string,
  userId: string,
  printerType: PrinterType,
  printerId: string | null,
): void {
  const state = loadPrinterRouting(branchCode);
  if (printerId && !state.printers.some((p) => p.id === printerId && p.printerType === printerType)) {
    return;
  }
  const current = state.userPrinters[userId] ?? [];
  const keepOtherTypes = current.filter((id) => {
    const profile = state.printers.find((p) => p.id === id);
    return profile != null && profile.printerType !== printerType;
  });
  const next = printerId ? [...keepOtherTypes, printerId] : keepOtherTypes;
  setUserPrinters(branchCode, userId, next);
}

/** Profiles of one type for easy dropdowns (My printers / waiter assign). */
export function listPrintersByType(
  branchCode: string | undefined,
  printerType: PrinterType,
): PrinterProfile[] {
  if (!branchCode) return [];
  return loadPrinterRouting(branchCode)
    .printers.filter((p) => p.printerType === printerType && isDirectPrintableProfile(p))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** All printer profiles assigned to a user. */
export function getPrintersForUser(
  branchCode: string | undefined,
  userId: string | undefined,
): PrinterProfile[] {
  if (!branchCode || !userId) return [];
  const state = loadPrinterRouting(branchCode);
  const ids = state.userPrinters[userId] ?? [];
  return ids
    .map((id) => state.printers.find((p) => p.id === id))
    .filter((p): p is PrinterProfile => Boolean(p));
}

/** User ids that share a printer profile. */
export function getUserIdsForPrinter(
  branchCode: string | undefined,
  printerId: string | undefined,
): string[] {
  if (!branchCode || !printerId) return [];
  const state = loadPrinterRouting(branchCode);
  return Object.entries(state.userPrinters)
    .filter(([, ids]) => ids.includes(printerId))
    .map(([userId]) => userId);
}

/** Distinct counter labels configured on profiles (for filters). */
export function listAssignedCounters(branchCode: string | undefined): string[] {
  if (!branchCode) return [];
  const counters = loadPrinterRouting(branchCode)
    .printers.map((p) => p.assignedCounter?.trim())
    .filter((c): c is string => Boolean(c));
  return [...new Set(counters)].sort((a, b) => a.localeCompare(b));
}

/** Every profile can print — OS-linked (incl. PDF/XPS) uses Auto; unlinked opens the dialog. */
function isDirectPrintableProfile(_profile: PrinterProfile): boolean {
  return true;
}

function pickOnlineThenAny(profiles: PrinterProfile[]): PrinterProfile | null {
  return profiles.find((p) => p.status === "online") ?? profiles[0] ?? null;
}

/** Primary (then backup) online printer profile assigned to a kitchen/bar section. */
export function resolvePrimaryPrinterForSection(
  branchCode: string | undefined,
  sectionId: string | null | undefined,
  userId?: string | null,
): PrinterProfile | null {
  if (!branchCode || !sectionId) return null;
  const state = loadPrinterRouting(branchCode);
  const ids = state.sectionPrinters[sectionId] ?? [];
  if (ids.length === 0) return null;

  const byId = (id: string) => state.printers.find((p) => p.id === id);
  const sectionUserSet = new Set(state.sectionUsers[sectionId] ?? []);
  const userInSection = Boolean(userId && sectionUserSet.has(userId));
  const userSet = userId ? new Set(state.userPrinters[userId] ?? []) : null;

  const ordered: PrinterProfile[] = [];
  // Users assigned to this section use the section printer list directly (primary first).
  if (userInSection) {
    for (const id of ids) {
      const p = byId(id);
      if (p) ordered.push(p);
    }
    return pickOnlineThenAny(ordered.filter(isDirectPrintableProfile));
  }

  // 1) Section printers also assigned to this user (online first later).
  if (userSet) {
    for (const id of ids) {
      if (!userSet.has(id)) continue;
      const p = byId(id);
      if (p) ordered.push(p);
    }
  }
  // 2) Remaining section printers.
  for (const id of ids) {
    const p = byId(id);
    if (p && !ordered.some((x) => x.id === p.id)) ordered.push(p);
  }

  const candidates = ordered.filter(isDirectPrintableProfile);
  if (userSet && candidates.length > 0) {
    const userMatched = candidates.filter((p) => userSet.has(p.id));
    const onlineUser = userMatched.find((p) => p.status === "online");
    if (onlineUser) return onlineUser;
    if (userMatched[0]) return userMatched[0];
  }
  const onlineAny = candidates.find((p) => p.status === "online");
  if (onlineAny) return onlineAny;
  return candidates[0] ?? null;
}

/** Branch-wide default printer for a type (Kitchen/Bar/Receipt), preferring OS-linked online profiles. */
export function resolveDefaultPrinterByType(
  branchCode: string | undefined,
  printerType: PrinterType,
): PrinterProfile | null {
  if (!branchCode) return null;
  const state = loadPrinterRouting(branchCode);
  const typed = state.printers.filter((p) => p.printerType === printerType);
  const withOs = typed.filter((p) => p.systemPrinterName?.trim());
  return pickOnlineThenAny(withOs) ?? pickOnlineThenAny(typed);
}

/** Default receipt printer: user receipt → branch default → OS-linked receipt/counter → any receipt. */
export function resolveReceiptPrinter(
  branchCode: string | undefined,
  userId?: string | null,
): PrinterProfile | null {
  if (!branchCode) return null;
  const userReceipt = resolvePrinterForUser(branchCode, userId, "receipt");
  if (userReceipt) return userReceipt;
  const userCounter = resolvePrinterForUser(branchCode, userId, "counter");
  if (userCounter?.systemPrinterName?.trim()) return userCounter;

  const state = loadPrinterRouting(branchCode);
  if (state.receiptPrinterId) {
    const selected = state.printers.find((p) => p.id === state.receiptPrinterId);
    if (selected) return selected;
  }
  const posTypes: PrinterType[] = ["receipt", "counter"];
  const typed = state.printers.filter((p) => posTypes.includes(p.printerType));
  const withOs = typed.filter((p) => p.systemPrinterName?.trim());
  return pickOnlineThenAny(withOs) ?? pickOnlineThenAny(typed);
}

/**
 * Who owns this print job for routing:
 * - Prefer the logged-in staff who clicked Print (waiter / rider / cashier).
 * - Optional fallback (selected waiter on Waiter page, or bill.waiterId).
 */
export function resolvePrintUserId(
  sessionUserId?: string | null,
  fallbackUserId?: string | null,
): string | null {
  const session = (sessionUserId ?? "").trim();
  if (session) return session;
  const fallback = (fallbackUserId ?? "").trim();
  return fallback || null;
}

/**
 * Resolve a printer for a user. Optional `printerType` picks Kitchen/Bar/Receipt among
 * that user's assigned printers. Shared printers (many users) are supported.
 */
export function resolvePrinterForUser(
  branchCode: string | undefined,
  userId: string | null | undefined,
  printerType?: PrinterType,
): PrinterProfile | null {
  if (!branchCode || !userId) return null;
  const assigned = getPrintersForUser(branchCode, userId);
  if (assigned.length === 0) return null;
  if (printerType) {
    const typed = assigned.filter((p) => p.printerType === printerType);
    // Do not fall back to a different type (e.g. receipt for kitchen KOT).
    if (typed.length === 0) return null;
    return pickOnlineThenAny(typed);
  }
  return pickOnlineThenAny(assigned);
}

/**
 * Best printer for a KOT job.
 * When `sectionId` is set: ONLY printers explicitly assigned to that section
 * (never fall back to “any kitchen printer” — that made one assign look global).
 * When `sectionId` is null (no category routing): user typed printer → system
 * kitchen/bar section primary → orphan type default (not linked to any section).
 * Never steal a printer that belongs only to Grill/Waiter/etc.
 */
export function resolveKotPrinter(
  branchCode: string | undefined,
  sectionId: string | null | undefined,
  userId?: string | null,
  preferredType: PrinterType = "kitchen",
): PrinterProfile | null {
  if (sectionId) {
    return resolvePrimaryPrinterForSection(branchCode, sectionId, userId);
  }
  const fromUser = resolvePrinterForUser(branchCode, userId, preferredType);
  if (fromUser) return fromUser;

  const systemSectionId =
    preferredType === "bar" ? "bar" : preferredType === "kitchen" ? "kitchen" : null;
  if (systemSectionId) {
    const fromSystemSection = resolvePrimaryPrinterForSection(
      branchCode,
      systemSectionId,
      userId,
    );
    if (fromSystemSection) return fromSystemSection;
  }

  return resolveOrphanDefaultPrinterByType(branchCode, preferredType);
}

/** Type default among profiles that are not assigned to any printer section. */
export function resolveOrphanDefaultPrinterByType(
  branchCode: string | undefined,
  printerType: PrinterType,
): PrinterProfile | null {
  if (!branchCode) return null;
  const state = loadPrinterRouting(branchCode);
  const assignedAnywhere = new Set<string>();
  for (const ids of Object.values(state.sectionPrinters)) {
    for (const id of ids) assignedAnywhere.add(id);
  }
  const typed = state.printers.filter(
    (p) => p.printerType === printerType && !assignedAnywhere.has(p.id),
  );
  const withOs = typed.filter((p) => p.systemPrinterName?.trim());
  return pickOnlineThenAny(withOs) ?? pickOnlineThenAny(typed);
}

export function updatePrinterProfile(
  branchCode: string,
  printerId: string,
  patch: Partial<Omit<PrinterProfile, "id">>,
): void {
  const state = loadPrinterRouting(branchCode);
  const nextPatch = { ...patch };
  if (nextPatch.systemPrinterName !== undefined) {
    nextPatch.systemPrinterName = nextPatch.systemPrinterName?.trim() || undefined;
  }
  const printers = state.printers.map((p) => (p.id === printerId ? { ...p, ...nextPatch } : p));
  saveState(branchCode, {
    ...state,
    printers,
  });

  // Thermal Paper & layout is the source of truth for roll width (including Custom mm).
  // Do not overwrite it when a profile paper size changes — that was wiping Custom.
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
  const userPrinters: Record<string, string[]> = {};
  for (const [userId, ids] of Object.entries(state.userPrinters)) {
    const next = ids.filter((id) => id !== printerId);
    if (next.length > 0) userPrinters[userId] = next;
  }
  saveState(branchCode, {
    ...state,
    printers: state.printers.filter((p) => p.id !== printerId),
    sectionPrinters,
    userPrinters,
    receiptPrinterId: state.receiptPrinterId === printerId ? null : state.receiptPrinterId,
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

/** Map a print section (Kitchen / Bar / Receipt / custom) → routing printerType. */
export function printerTypeForSection(section: {
  id: string;
  name: string;
}): PrinterType {
  const id = section.id.toLowerCase();
  const n = section.name.toLowerCase();
  if (id === "receipt" || n.includes("receipt") || n.includes("bill") || n.includes("cashier")) {
    return "receipt";
  }
  if (id === "counter" || n.includes("counter")) return "counter";
  if (id === "warehouse" || n.includes("warehouse")) return "warehouse";
  if (id === "label" || n.includes("label")) return "label";
  if (id === "returns" || n.includes("return")) return "receipt";
  if (id === "back-office" || n.includes("back office") || n.includes("back-office")) {
    return "other";
  }
  if (n.includes("bar") || n.includes("drink") || n.includes("beverage")) return "bar";
  return "kitchen";
}

/** Make `printerId` the primary printer for a section (index 0). Adds it if missing.
 * Also syncs profile `printerType` from the section so Role matches Kitchen/Bar/… everywhere. */
export function setSectionPrimaryPrinter(
  branchCode: string,
  sectionId: string,
  printerId: string,
): void {
  const state = loadPrinterRouting(branchCode);
  const current = state.sectionPrinters[sectionId] ?? [];
  const next = [printerId, ...current.filter((id) => id !== printerId)];
  setSectionPrinters(branchCode, sectionId, next);

  const section = loadPrinterSections(branchCode).find((s) => s.id === sectionId);
  if (!section) return;
  const printerType = printerTypeForSection(section);
  const profile = loadPrinterRouting(branchCode).printers.find((p) => p.id === printerId);
  if (profile && profile.printerType !== printerType) {
    updatePrinterProfile(branchCode, printerId, { printerType });
  }
}

/** Sections that currently list this printer (primary first when applicable). */
export function listSectionsForPrinter(
  branchCode: string | undefined,
  printerId: string,
  sections: { id: string; name: string; icon?: string }[],
): { id: string; name: string; icon?: string; primary: boolean }[] {
  if (!branchCode) return [];
  const map = loadPrinterRouting(branchCode).sectionPrinters;
  const out: { id: string; name: string; icon?: string; primary: boolean }[] = [];
  for (const section of sections) {
    const ids = map[section.id] ?? [];
    const index = ids.indexOf(printerId);
    if (index === -1) continue;
    out.push({
      id: section.id,
      name: section.name,
      icon: section.icon,
      primary: index === 0,
    });
  }
  return out;
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

/** User / waiter ids assigned to a print section. */
export function getUsersForSection(
  branchCode: string | undefined,
  sectionId: string | undefined,
): string[] {
  if (!branchCode || !sectionId) return [];
  return loadPrinterRouting(branchCode).sectionUsers[sectionId] ?? [];
}

export function setSectionUsers(branchCode: string, sectionId: string, userIds: string[]): void {
  const state = loadPrinterRouting(branchCode);
  const unique = [...new Set(userIds.filter(Boolean))];
  const sectionUsers = { ...state.sectionUsers };
  if (unique.length === 0) delete sectionUsers[sectionId];
  else sectionUsers[sectionId] = unique;
  saveState(branchCode, { ...state, sectionUsers });
}

/** Remove section printer + user assignments (call when deleting a section). */
export function clearSectionRouting(branchCode: string, sectionId: string): void {
  const state = loadPrinterRouting(branchCode);
  const sectionPrinters = { ...state.sectionPrinters };
  const sectionUsers = { ...state.sectionUsers };
  delete sectionPrinters[sectionId];
  delete sectionUsers[sectionId];
  saveState(branchCode, { ...state, sectionPrinters, sectionUsers });
}

/** Assign or remove a user/waiter from a section. */
export function toggleUserForSection(
  branchCode: string,
  sectionId: string,
  userId: string,
  assign: boolean,
): void {
  const current = getUsersForSection(branchCode, sectionId);
  const next = assign
    ? current.includes(userId)
      ? current
      : [...current, userId]
    : current.filter((id) => id !== userId);
  setSectionUsers(branchCode, sectionId, next);

  // Only sync printers that belong to this section's role (kitchen vs receipt).
  // Previously every printer in the section was attached — bill print then could
  // resolve against kitchen devices and multi-printer section lists.
  const state = loadPrinterRouting(branchCode);
  const section = loadPrinterSections(branchCode).find((s) => s.id === sectionId);
  const allowedTypes = new Set(printerTypesForSectionName(section?.id ?? sectionId, section?.name ?? ""));
  const printerIds = (state.sectionPrinters[sectionId] ?? []).filter((id) => {
    const profile = state.printers.find((p) => p.id === id);
    return profile != null && allowedTypes.has(profile.printerType);
  });
  for (const printerId of printerIds) {
    toggleUserPrinter(branchCode, userId, printerId, assign);
  }
}

/** Which profile types a print section should drive (kitchen vs bill/receipt). */
export function printerTypesForSectionName(sectionId: string, sectionName: string): PrinterType[] {
  const id = sectionId.toLowerCase();
  const n = sectionName.toLowerCase();
  if (
    id.includes("receipt") ||
    id.includes("bill") ||
    id.includes("cashier") ||
    id.includes("counter") ||
    n.includes("receipt") ||
    n.includes("bill") ||
    n.includes("cashier") ||
    n.includes("counter")
  ) {
    return ["receipt", "counter"];
  }
  if (id.includes("bar") || n.includes("bar") || n.includes("beverage")) {
    return ["bar"];
  }
  return ["kitchen"];
}

/** Printer profiles currently linked to a section (primary first). */
export function getPrintersForSection(
  branchCode: string | undefined,
  sectionId: string | undefined,
): PrinterProfile[] {
  if (!branchCode || !sectionId) return [];
  const state = loadPrinterRouting(branchCode);
  return (state.sectionPrinters[sectionId] ?? [])
    .map((id) => state.printers.find((p) => p.id === id))
    .filter((p): p is PrinterProfile => Boolean(p));
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
  saveState(branchCode, normalizeState(parsed.routing));
}
