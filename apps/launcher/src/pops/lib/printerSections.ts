/** Printer sections (Kitchen, Bar, Grill, ...) — per-branch, localStorage-backed. */

export type PrinterSection = {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  /** Default sections ship with the app; custom sections are user-created and fully deletable. */
  isSystem: boolean;
  sortOrder: number;
};

export const DEFAULT_PRINTER_SECTIONS: PrinterSection[] = [
  { id: "kitchen", name: "Kitchen", icon: "🍳", color: "#f59e0b", enabled: true, isSystem: true, sortOrder: 0 },
  { id: "bar", name: "Bar", icon: "🍸", color: "#8b5cf6", enabled: true, isSystem: true, sortOrder: 1 },
  { id: "waiter", name: "Waiter", icon: "🧑‍🍳", color: "#38bdf8", enabled: true, isSystem: true, sortOrder: 2 },
  { id: "grill", name: "Grill", icon: "🔥", color: "#ef4444", enabled: true, isSystem: true, sortOrder: 3 },
  { id: "dessert", name: "Dessert", icon: "🍰", color: "#f472b6", enabled: true, isSystem: true, sortOrder: 4 },
  { id: "drinks", name: "Drinks", icon: "🥤", color: "#22d3ee", enabled: true, isSystem: true, sortOrder: 5 },
  { id: "cashier", name: "Cashier", icon: "🧾", color: "#a3e635", enabled: true, isSystem: true, sortOrder: 6 },
  { id: "pickup", name: "Pickup", icon: "📦", color: "#fb923c", enabled: true, isSystem: true, sortOrder: 7 },
  { id: "delivery", name: "Delivery", icon: "🛵", color: "#34d399", enabled: true, isSystem: true, sortOrder: 8 },
];

export const PRINTER_SECTIONS_CHANGED_EVENT = "pops-printer-sections-changed";

const STORAGE_KEY = "pops-printer-sections-v1";

function readAll(): Record<string, PrinterSection[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PrinterSection[]>;
  } catch {
    return {};
  }
}

function writeAll(data: Record<string, PrinterSection[]>, branchCode: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent(PRINTER_SECTIONS_CHANGED_EVENT, { detail: { branchCode } }));
  } catch {
    // ignore storage errors
  }
}

export function loadPrinterSections(branchCode: string | undefined): PrinterSection[] {
  if (!branchCode) return DEFAULT_PRINTER_SECTIONS;
  const all = readAll();
  const stored = all[branchCode];
  if (!stored || stored.length === 0) return DEFAULT_PRINTER_SECTIONS;
  return [...stored].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function savePrinterSections(branchCode: string, sections: PrinterSection[]): void {
  const all = readAll();
  all[branchCode] = sections;
  writeAll(all, branchCode);
}

function newSectionId(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "section"}-${Date.now().toString(36)}`;
}

export function addPrinterSection(
  branchCode: string,
  input: { name: string; icon: string; color: string },
): PrinterSection {
  const sections = loadPrinterSections(branchCode);
  const next: PrinterSection = {
    id: newSectionId(input.name),
    name: input.name.trim() || "New section",
    icon: input.icon || "🖨️",
    color: input.color || "#94a3b8",
    enabled: true,
    isSystem: false,
    sortOrder: sections.length,
  };
  savePrinterSections(branchCode, [...sections, next]);
  return next;
}

/** Duplicates a section as a new custom (non-system) section, copying icon/color. */
export function duplicatePrinterSection(branchCode: string, sectionId: string): PrinterSection | null {
  const sections = loadPrinterSections(branchCode);
  const source = sections.find((s) => s.id === sectionId);
  if (!source) return null;
  const copy: PrinterSection = {
    id: newSectionId(source.name),
    name: `${source.name} (copy)`,
    icon: source.icon,
    color: source.color,
    enabled: source.enabled,
    isSystem: false,
    sortOrder: sections.length,
  };
  savePrinterSections(branchCode, [...sections, copy]);
  return copy;
}

export function updatePrinterSection(
  branchCode: string,
  sectionId: string,
  patch: Partial<Pick<PrinterSection, "name" | "icon" | "color" | "enabled">>,
): void {
  const sections = loadPrinterSections(branchCode);
  savePrinterSections(
    branchCode,
    sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
  );
}

export function deletePrinterSection(branchCode: string, sectionId: string): void {
  const sections = loadPrinterSections(branchCode);
  const target = sections.find((s) => s.id === sectionId);
  if (!target || target.isSystem) return;
  savePrinterSections(
    branchCode,
    sections.filter((s) => s.id !== sectionId),
  );
}
