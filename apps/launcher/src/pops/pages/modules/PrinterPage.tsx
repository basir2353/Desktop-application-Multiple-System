import { Button } from "@platform/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePopsStore } from "../../../stores/popsStore";
import {
  DEFAULT_KOT_PRINT_SETTINGS,
  loadKotPrintSettings,
  normalizeKotPrintSettings,
  saveKotPrintSettings,
  type KotPrintSettings,
} from "../../lib/kotPrintSettings";
import {
  PRINTER_PRESETS,
  loadPrinterAssignments,
  setCategoryPrinter,
  setItemPrinter,
  setUserPrinter,
} from "../../lib/printerAssignmentSettings";
import {
  addPrinterSection,
  deletePrinterSection,
  duplicatePrinterSection,
  loadPrinterSections,
  PRINTER_SECTIONS_CHANGED_EVENT,
  updatePrinterSection,
  type PrinterSection,
} from "../../lib/printerSections";
import {
  addPrinterProfile,
  deletePrinterProfile,
  duplicatePrinterProfile,
  exportPrinterConfig,
  getPrintersForUser,
  getUserIdsForPrinter,
  importPrinterConfig,
  listAssignedCounters,
  loadPrinterRouting,
  movePrinterPriority,
  PRINTER_ROUTING_CHANGED_EVENT,
  PRINTER_TYPE_LABELS,
  setCategorySections,
  setItemSections,
  setReceiptPrinter,
  setUserPrinters,
  togglePrinterForSection,
  toggleUserPrinter,
  updatePrinterProfile,
  type PrinterPaperSize,
  type PrinterProfile,
  type PrinterRoutingState,
  type PrinterType,
} from "../../lib/printerRouting";
import { listSystemPrintersDetailed, type SystemPrinterInfo } from "../../lib/systemPrinters";
import {
  clearPrintHistory,
  loadPrintHistory,
  logPrintEvent,
  PRINT_HISTORY_CHANGED_EVENT,
  todaysPrintCount,
} from "../../lib/printHistory";
import { printTestPageAsync } from "../../lib/printTicket";
import { fetchBranchMenuAdmin } from "../../api/menu";
import { fetchOrgUsers } from "../../api/users";
import { fetchWaiters } from "../../api/billing";
import { PageHeader } from "../../ui/PageHeader";
import {
  PrinterBySectionPanel,
  type AssignablePerson,
} from "../../components/PrinterBySectionPanel";
import { ThermalPrintSettingsPanel } from "../../components/ThermalPrintSettingsPanel";

const SECTION_ICON_CHOICES = ["🍳", "🍸", "🧑‍🍳", "🔥", "🍰", "🥤", "🧾", "📦", "🛵", "☕", "🥖", "🖨️"];
const SECTION_COLOR_CHOICES = [
  "#f59e0b", "#8b5cf6", "#38bdf8", "#ef4444", "#f472b6",
  "#22d3ee", "#a3e635", "#fb923c", "#34d399", "#94a3b8",
];
const PRINTER_TYPES = Object.keys(PRINTER_TYPE_LABELS) as PrinterType[];

const TABS = [
  { id: "printers", label: "All Printers" },
  { id: "by-section", label: "Printer by Section" },
  { id: "settings", label: "Print Settings" },
  { id: "categories", label: "Categories" },
  { id: "items", label: "Items" },
  { id: "preview", label: "Routing Preview" },
  { id: "queue", label: "Print Queue" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function statusDot(state: SystemPrinterInfo["state"]): string {
  if (state === "ready") return "bg-emerald-400";
  if (state === "printing") return "bg-amber-400";
  if (state === "offline") return "bg-red-400";
  return "bg-slate-500";
}

function statusLabel(state: SystemPrinterInfo["state"]): string {
  if (state === "ready") return "Online";
  if (state === "printing") return "Printing";
  if (state === "offline") return "Offline";
  if (state === "paused") return "Paused";
  return "Unknown";
}

/** Shared hook: sections + routing state for a branch, kept in sync via change events. */
function usePrinterConfig(branchCode: string) {
  const [sections, setSections] = useState<PrinterSection[]>(() => loadPrinterSections(branchCode));
  const [routingRevision, setRoutingRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);

  useEffect(() => {
    setSections(loadPrinterSections(branchCode));
  }, [branchCode]);

  useEffect(() => {
    function onSectionsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (detail?.branchCode === branchCode) setSections(loadPrinterSections(branchCode));
    }
    function onRoutingChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (detail?.branchCode === branchCode) setRoutingRevision((n) => n + 1);
    }
    function onHistoryChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (detail?.branchCode === branchCode) setHistoryRevision((n) => n + 1);
    }
    window.addEventListener(PRINTER_SECTIONS_CHANGED_EVENT, onSectionsChanged);
    window.addEventListener(PRINTER_ROUTING_CHANGED_EVENT, onRoutingChanged);
    window.addEventListener(PRINT_HISTORY_CHANGED_EVENT, onHistoryChanged);
    return () => {
      window.removeEventListener(PRINTER_SECTIONS_CHANGED_EVENT, onSectionsChanged);
      window.removeEventListener(PRINTER_ROUTING_CHANGED_EVENT, onRoutingChanged);
      window.removeEventListener(PRINT_HISTORY_CHANGED_EVENT, onHistoryChanged);
    };
  }, [branchCode]);

  const routing = useMemo(() => {
    void routingRevision;
    return loadPrinterRouting(branchCode);
  }, [branchCode, routingRevision]);

  return { sections, routing, historyRevision };
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "danger" }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div
        className={`text-xl font-semibold ${
          tone === "danger" ? "text-red-400" : tone === "warn" ? "text-amber-400" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function PrinterDashboardStats({
  branchCode,
  sections,
  routing,
  systemPrinters,
}: {
  branchCode: string;
  sections: PrinterSection[];
  routing: PrinterRoutingState;
  systemPrinters: SystemPrinterInfo[];
}): JSX.Element {
  const onlineCount = systemPrinters.filter((p) => p.state === "ready" || p.state === "printing").length;
  const offlineCount = systemPrinters.length - onlineCount;
  const linkedCategoryCount = Object.values(routing.byCategory).filter((ids) => ids.length > 0).length;
  const overrideItemCount = Object.keys(routing.byItem).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      <StatCard label="Sections" value={sections.length} />
      <StatCard label="System printers" value={systemPrinters.length} />
      <StatCard label="Online" value={onlineCount} />
      <StatCard label="Offline" value={offlineCount} tone={offlineCount > 0 ? "danger" : undefined} />
      <StatCard label="Categories routed" value={linkedCategoryCount} />
      <StatCard label="Item overrides" value={overrideItemCount} />
      <StatCard label="Pending jobs" value={0} />
      <StatCard label="Prints today" value={todaysPrintCount(branchCode)} />
    </div>
  );
}

function printerTypeForSection(section: PrinterSection): PrinterType {
  const n = section.name.toLowerCase();
  if (n.includes("bar") || n.includes("drink") || n.includes("beverage")) return "bar";
  if (n.includes("receipt") || n.includes("bill") || n.includes("cashier") || n.includes("counter")) {
    return "receipt";
  }
  return "kitchen";
}

function PrinterSectionsTab({
  branchCode,
  sections,
  routing,
  systemPrinters,
  allSystemPrinters,
  systemPrintersLoading,
  systemPrintersError,
  onRefreshSystemPrinters,
  categories,
  items,
  notify,
}: {
  branchCode: string;
  sections: PrinterSection[];
  routing: PrinterRoutingState;
  /** Prefer real printers; may be empty on PCs that only have Fax/PDF. */
  systemPrinters: SystemPrinterInfo[];
  /** Full Windows list — always shown so staff can see / assign. */
  allSystemPrinters: SystemPrinterInfo[];
  systemPrintersLoading: boolean;
  systemPrintersError: string | null;
  onRefreshSystemPrinters: () => void;
  categories: { id: string; name: string }[];
  items: { id: string; name: string; categoryId: string }[];
  notify: (message: string) => void;
}): JSX.Element {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionSearch, setSectionSearch] = useState("");
  const [printerSearch, setPrinterSearch] = useState("");
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionIcon, setNewSectionIcon] = useState(SECTION_ICON_CHOICES[0]);
  const [newSectionColor, setNewSectionColor] = useState(SECTION_COLOR_CHOICES[0]);
  const printerPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedSectionId && sections.length > 0) setSelectedSectionId(sections[0].id);
  }, [sections, selectedSectionId]);

  useEffect(() => {
    if (!printerPickerOpen) return;
    function onPointerDown(event: MouseEvent): void {
      if (!printerPickerRef.current?.contains(event.target as Node)) {
        setPrinterPickerOpen(false);
      }
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setPrinterPickerOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [printerPickerOpen]);

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  const filteredSections = sections.filter((s) =>
    s.name.toLowerCase().includes(sectionSearch.trim().toLowerCase()),
  );
  const filteredPrinters = routing.printers.filter((p) =>
    p.name.toLowerCase().includes(printerSearch.trim().toLowerCase()),
  );
  const displayedSystemPrinters = useMemo(() => {
    const q = printerSearch.trim().toLowerCase();
    const source = allSystemPrinters.length > 0 ? allSystemPrinters : systemPrinters;
    // Real printers first, then virtual (Fax/PDF) so the list is never empty when Windows has devices.
    const sorted = [...source].sort((a, b) => Number(a.isVirtual) - Number(b.isVirtual));
    if (!q) return sorted;
    return sorted.filter(
      (printer) =>
        printer.name.toLowerCase().includes(q) ||
        printer.portName.toLowerCase().includes(q) ||
        printer.connectionType.toLowerCase().includes(q),
    );
  }, [allSystemPrinters, systemPrinters, printerSearch]);

  const selectableSystemPrinters = displayedSystemPrinters;

  function sectionCountsFor(section: PrinterSection) {
    const printerIds = routing.sectionPrinters[section.id] ?? [];
    const catCount = categories.filter((c) => (routing.byCategory[c.id] ?? []).includes(section.id)).length;
    const itemCount = items.filter((i) => (routing.byItem[i.id] ?? []).includes(section.id)).length;
    const primaryId = printerIds[0];
    const primaryPrinter = primaryId ? routing.printers.find((p) => p.id === primaryId) : null;
    return { printerCount: printerIds.length, catCount, itemCount, primaryPrinter };
  }

  function sectionsForPrinter(printerId: string): PrinterSection[] {
    return sections.filter((s) => (routing.sectionPrinters[s.id] ?? []).includes(printerId));
  }

  const linkedCategories = selectedSection
    ? categories.filter((c) => (routing.byCategory[c.id] ?? []).includes(selectedSection.id))
    : [];
  const linkedItems = selectedSection
    ? items.filter((i) => (routing.byItem[i.id] ?? []).includes(selectedSection.id))
    : [];
  const assignedIds = selectedSection ? routing.sectionPrinters[selectedSection.id] ?? [] : [];

  function assignSystemPrinter(printer: SystemPrinterInfo): void {
    if (!selectedSection) {
      notify("Select Kitchen or Bar on the left, then tap Use for…");
      return;
    }
    const printerType = printerTypeForSection(selectedSection);
    // Virtual devices (Fax/PDF): keep as profile label, but do not force direct OS print
    // (that fails with StartDocPrinterW). Real printers get a direct OS link.
    const systemPrinterName = printer.isVirtual ? undefined : printer.name;
    let profile =
      routing.printers.find((p) => p.systemPrinterName === printer.name) ??
      routing.printers.find((p) => p.name.toLowerCase() === printer.name.toLowerCase());
    if (!profile) {
      try {
        profile = addPrinterProfile(branchCode, printer.name, {
          systemPrinterName,
          printerType,
        });
      } catch (err) {
        notify(err instanceof Error ? err.message : String(err));
        return;
      }
    } else {
      updatePrinterProfile(branchCode, profile.id, {
        printerType,
        systemPrinterName: systemPrinterName ?? profile.systemPrinterName,
      });
    }
    togglePrinterForSection(branchCode, selectedSection.id, profile.id, true);
    notify(
      printer.isVirtual
        ? `✓ ${printer.name} → ${selectedSection.name}. (Virtual printer — Windows print dialog will open.)`
        : `✓ ${printer.name} → ${selectedSection.name}. Done.`,
    );
    setPrinterPickerOpen(false);
    setPrinterSearch("");
  }

  function addSystemPrinterFromList(printer: SystemPrinterInfo): void {
    assignSystemPrinter(printer);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 dark:border-amber-500/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              1) Pick a section → 2) Tap a printer
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {selectedSection
                ? `Selected: ${selectedSection.name}. Tap “Use for ${selectedSection.name}” on a printer below.`
                : "Select Kitchen or Bar on the left, then choose a printer."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {systemPrintersLoading ? <span className="text-[10px] text-slate-500">Scanning…</span> : null}
            <Button type="button" className="text-xs" onClick={onRefreshSystemPrinters}>
              Refresh printers
            </Button>
          </div>
        </div>

        {systemPrintersError ? (
          <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {systemPrintersError}
          </div>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {systemPrintersLoading && displayedSystemPrinters.length === 0 ? (
            <p className="text-xs text-slate-500">Scanning Windows printers…</p>
          ) : displayedSystemPrinters.length === 0 ? (
            <div className="col-span-full space-y-2 text-xs text-slate-400">
              <p>No printers detected on this computer.</p>
              <p>
                Open Windows Settings → Printers, install your kitchen printer, then click{" "}
                <span className="text-amber-300">Refresh printers</span>.
              </p>
            </div>
          ) : (
            displayedSystemPrinters.map((printer) => (
              <div
                key={printer.name}
                className={`rounded-lg border p-3 ${
                  printer.isVirtual
                    ? "border-slate-800 bg-slate-950/40 opacity-90"
                    : "border-slate-700 bg-slate-950/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-sm font-medium text-white">{printer.name}</div>
                  {printer.isVirtual ? (
                    <span className="shrink-0 rounded-full bg-slate-700/80 px-1.5 py-0.5 text-[9px] text-slate-300">
                      Virtual
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300">
                      Ready
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot(printer.state)}`} aria-hidden />
                  {statusLabel(printer.state)} · {printer.connectionType}
                  {printer.isDefault ? (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-300">Default</span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="text-xs"
                    disabled={!selectedSection}
                    onClick={() => assignSystemPrinter(printer)}
                  >
                    Use for {selectedSection?.name ?? "section"}
                  </Button>
                  {!printer.isVirtual ? (
                    <button
                      type="button"
                      className="text-[11px] text-amber-400 hover:text-amber-300"
                      onClick={() => {
                        void (async () => {
                          const ok = await printTestPageAsync(printer.name, { branchCode });
                          logPrintEvent(branchCode, { kind: "test", printerName: printer.name, ok });
                          notify(
                            ok
                              ? `Test print sent to ${printer.name}.`
                              : `Test print failed on ${printer.name}.`,
                          );
                        })();
                      }}
                    >
                      Test
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Left sidebar — section cards */}
          <div className="lg:col-span-3">
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
              placeholder="Search sections…"
              value={sectionSearch}
              onChange={(e) => setSectionSearch(e.target.value)}
            />
            <ul className="mt-2 space-y-1.5">
              {filteredSections.map((section) => {
                const { printerCount, catCount, itemCount, primaryPrinter } = sectionCountsFor(section);
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSectionId(section.id)}
                      className={`flex w-full flex-col gap-1 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                        selectedSectionId === section.id
                          ? "border-amber-400 bg-amber-500/10"
                          : "border-slate-700 bg-slate-950 hover:border-slate-600"
                      } ${!section.enabled ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm"
                          style={{ backgroundColor: `${section.color}30` }}
                          aria-hidden
                        >
                          {section.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-200">{section.name}</span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] ${
                            section.enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700/60 text-slate-400"
                          }`}
                        >
                          {section.enabled ? "Active" : "Off"}
                        </span>
                      </div>
                      <div className="pl-8 text-[10px] text-slate-500">
                        {primaryPrinter ? primaryPrinter.name : "No printer"} · {printerCount} printer
                        {printerCount === 1 ? "" : "s"} · {catCount} categories · {itemCount} items
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 space-y-1.5 rounded-lg border border-dashed border-slate-700 p-2">
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white outline-none focus:border-amber-500/50"
                placeholder="New section name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
              />
              <div className="flex flex-wrap gap-1">
                {SECTION_ICON_CHOICES.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewSectionIcon(icon)}
                    className={`h-6 w-6 rounded text-sm ${newSectionIcon === icon ? "bg-amber-500/30 ring-1 ring-amber-400" : "hover:bg-slate-800"}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {SECTION_COLOR_CHOICES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewSectionColor(color)}
                    className={`h-5 w-5 rounded-full ${newSectionColor === color ? "ring-2 ring-white" : ""}`}
                    style={{ backgroundColor: color }}
                    aria-label={color}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                disabled={!newSectionName.trim()}
                onClick={() => {
                  const created = addPrinterSection(branchCode, {
                    name: newSectionName,
                    icon: newSectionIcon,
                    color: newSectionColor,
                  });
                  setNewSectionName("");
                  setSelectedSectionId(created.id);
                  notify(`Section "${created.name}" added.`);
                }}
              >
                + Add section
              </Button>
            </div>
          </div>

          {/* Center panel — printer profiles */}
          <div className="lg:col-span-5">
            <div className="relative" ref={printerPickerRef}>
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
                  placeholder="Search system printers…"
                  value={printerSearch}
                  onChange={(e) => {
                    setPrinterSearch(e.target.value);
                    setPrinterPickerOpen(true);
                  }}
                  onFocus={() => {
                    setPrinterPickerOpen(true);
                    if (systemPrinters.length === 0) onRefreshSystemPrinters();
                  }}
                  onKeyDown={(e) => {
                    // Never create a printer from free text (blocks typing "fax").
                    if (e.key === "Enter") e.preventDefault();
                  }}
                />
                <Button
                  type="button"
                  className="shrink-0 text-xs"
                  onClick={() => {
                    setPrinterPickerOpen((open) => !open);
                    if (!printerPickerOpen && systemPrinters.length === 0) onRefreshSystemPrinters();
                  }}
                >
                  {printerPickerOpen ? "Close" : "Pick printer"}
                </Button>
              </div>

              {printerPickerOpen ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 shadow-xl shadow-black/40">
                  <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-950 px-2.5 py-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Select a system printer
                    </span>
                    <button
                      type="button"
                      className="text-[10px] text-sky-400 hover:text-sky-300"
                      onClick={() => onRefreshSystemPrinters()}
                    >
                      {systemPrintersLoading ? "Scanning…" : "Refresh"}
                    </button>
                  </div>
                  {systemPrintersLoading && systemPrinters.length === 0 ? (
                    <p className="px-2.5 py-3 text-xs text-slate-500">Scanning for printers…</p>
                  ) : selectableSystemPrinters.length === 0 ? (
                    <p className="px-2.5 py-3 text-xs text-slate-500">
                      {systemPrinters.length === 0
                        ? "No printers detected on this computer."
                        : "No printers match your search."}
                    </p>
                  ) : (
                    <ul className="py-1">
                      {selectableSystemPrinters.map((printer) => {
                        const alreadyAdded = routing.printers.some(
                          (p) =>
                            p.systemPrinterName === printer.name ||
                            p.name.toLowerCase() === printer.name.toLowerCase(),
                        );
                        return (
                          <li key={printer.name}>
                            <button
                              type="button"
                              onClick={() => addSystemPrinterFromList(printer)}
                              className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-slate-900"
                            >
                              <span
                                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(printer.state)}`}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-medium text-slate-100">
                                  {printer.name}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-slate-500">
                                  {statusLabel(printer.state)} · {printer.connectionType}
                                  {printer.isDefault ? " · Default" : ""}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                                  alreadyAdded
                                    ? "bg-slate-700/70 text-slate-300"
                                    : "bg-amber-500/15 text-amber-300"
                                }`}
                              >
                                {alreadyAdded ? "Added" : "Select"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <p className="mt-1.5 text-[10px] text-slate-500">
              Click Add printer, pick from the list, then it appears in the table below
              {selectedSection ? ` and is assigned to ${selectedSection.name}` : ""}.
            </p>

            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2.5 py-2">Printer</th>
                    <th className="px-2.5 py-2">Status</th>
                    <th className="px-2.5 py-2">Sections</th>
                    <th className="px-2.5 py-2">Test</th>
                    <th className="px-2.5 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredPrinters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2.5 py-4 text-center text-slate-500">
                        No printer profiles yet. Use Add printer above and select from the list.
                      </td>
                    </tr>
                  ) : (
                    filteredPrinters.map((printer) => (
                      <tr key={printer.id}>
                        <td className="px-2.5 py-2 text-slate-200">
                          {printer.name}
                          {printer.systemPrinterName ? (
                            <span className="ml-1 text-[9px] text-sky-400">● OS</span>
                          ) : null}
                        </td>
                        <td className="px-2.5 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              updatePrinterProfile(branchCode, printer.id, {
                                status: printer.status === "online" ? "offline" : "online",
                              })
                            }
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              printer.status === "online"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-red-500/15 text-red-300"
                            }`}
                          >
                            {printer.status === "online" ? "Online" : "Offline"}
                          </button>
                        </td>
                        <td className="px-2.5 py-2">
                          <div className="flex flex-wrap gap-1">
                            {sectionsForPrinter(printer.id).map((s) => (
                              <span key={s.id} aria-hidden title={s.name}>
                                {s.icon}
                              </span>
                            ))}
                            {sectionsForPrinter(printer.id).length === 0 ? (
                              <span className="text-slate-600">—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2.5 py-2">
                          <button
                            type="button"
                            className="text-amber-400 hover:text-amber-300"
                            onClick={() => {
                              void (async () => {
                                const target = printer.systemPrinterName?.trim();
                                if (!target) {
                                  notify("Link an OS printer on this profile before Test Print.");
                                  return;
                                }
                                const ok = await printTestPageAsync(target, {
                                  branchCode,
                                  paperSize: printer.paperSize,
                                });
                                logPrintEvent(branchCode, { kind: "test", printerName: target, ok });
                                notify(
                                  ok
                                    ? `Test print sent to ${target}.`
                                    : `Test print failed on ${target}. Check connection.`,
                                );
                              })();
                            }}
                          >
                            Test print
                          </button>
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <button
                            type="button"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => {
                              deletePrinterProfile(branchCode, printer.id);
                              notify(`Printer "${printer.name}" removed.`);
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Printer profiles marked "● OS" are linked to a detected system printer. Copies, paper size, and
              auto-cut are configured on the Printer Profiles tab.
            </p>
          </div>

          {/* Right panel — selected section config */}
          <div className="lg:col-span-4">
            {selectedSection ? (
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <label className="block text-xs text-slate-400">
                  Section name
                  <input
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-white outline-none focus:border-amber-500/50 disabled:opacity-50"
                    value={selectedSection.name}
                    disabled={selectedSection.isSystem}
                    onChange={(e) => updatePrinterSection(branchCode, selectedSection.id, { name: e.target.value })}
                  />
                </label>

                <div>
                  <div className="text-xs text-slate-400">Icon</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {SECTION_ICON_CHOICES.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => updatePrinterSection(branchCode, selectedSection.id, { icon })}
                        className={`h-7 w-7 rounded text-sm ${selectedSection.icon === icon ? "bg-amber-500/30 ring-1 ring-amber-400" : "hover:bg-slate-800"}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">Color</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {SECTION_COLOR_CHOICES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updatePrinterSection(branchCode, selectedSection.id, { color })}
                        className={`h-6 w-6 rounded-full ${selectedSection.color === color ? "ring-2 ring-white" : ""}`}
                        style={{ backgroundColor: color }}
                        aria-label={color}
                      />
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={selectedSection.enabled}
                    onChange={(e) =>
                      updatePrinterSection(branchCode, selectedSection.id, { enabled: e.target.checked })
                    }
                  />
                  Section enabled
                </label>

                <div>
                  <div className="text-xs text-slate-400">Assigned printers (top = primary)</div>
                  <div className="mt-1.5 space-y-1">
                    {routing.printers.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Add or assign a printer first.</p>
                    ) : (
                      routing.printers.map((printer) => {
                        const assigned = assignedIds.includes(printer.id);
                        const index = assignedIds.indexOf(printer.id);
                        const primary = index === 0;
                        return (
                          <div key={printer.id} className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={(e) =>
                                togglePrinterForSection(branchCode, selectedSection.id, printer.id, e.target.checked)
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">{printer.name}</span>
                            {primary ? (
                              <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">
                                Primary
                              </span>
                            ) : assigned ? (
                              <span className="shrink-0 rounded-full bg-slate-700/60 px-1.5 py-0.5 text-[9px] text-slate-400">
                                Backup
                              </span>
                            ) : null}
                            {assigned ? (
                              <span className="flex shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  className="rounded px-1 text-slate-400 hover:text-white disabled:opacity-30"
                                  onClick={() => movePrinterPriority(branchCode, selectedSection.id, printer.id, -1)}
                                  aria-label="Move up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={index === assignedIds.length - 1}
                                  className="rounded px-1 text-slate-400 hover:text-white disabled:opacity-30"
                                  onClick={() => movePrinterPriority(branchCode, selectedSection.id, printer.id, 1)}
                                  aria-label="Move down"
                                >
                                  ▼
                                </button>
                              </span>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">Categories linked ({linkedCategories.length})</div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {linkedCategories.length > 0
                      ? linkedCategories.map((c) => c.name).join(", ")
                      : "None yet — set this from the Categories tab."}
                  </p>
                </div>

                <div>
                  <div className="text-xs text-slate-400">Items linked ({linkedItems.length})</div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {linkedItems.length > 0
                      ? linkedItems.map((i) => i.name).join(", ")
                      : "None — items inherit their category's sections unless overridden."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="text-xs text-sky-400 hover:text-sky-300"
                    onClick={() => {
                      const copy = duplicatePrinterSection(branchCode, selectedSection.id);
                      if (copy) {
                        setSelectedSectionId(copy.id);
                        notify(`Section duplicated as "${copy.name}".`);
                      }
                    }}
                  >
                    Duplicate section
                  </button>
                  {!selectedSection.isSystem ? (
                    <button
                      type="button"
                      className="text-xs text-red-400 hover:text-red-300"
                      onClick={() => {
                        if (confirm(`Delete section "${selectedSection.name}"?`)) {
                          deletePrinterSection(branchCode, selectedSection.id);
                          setSelectedSectionId(null);
                          notify(`Section "${selectedSection.name}" deleted.`);
                        }
                      }}
                    >
                      Delete section
                    </button>
                  ) : null}
                </div>
                {selectedSection.isSystem ? (
                  <p className="text-[10px] text-slate-600">Default sections can be renamed and disabled, not deleted.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Select a section to configure it.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrinterCategoriesTab({
  branchCode,
  sections,
  routing,
  categories,
}: {
  branchCode: string;
  sections: PrinterSection[];
  routing: PrinterRoutingState;
  categories: { id: string; name: string }[];
}): JSX.Element {
  const [search, setSearch] = useState("");
  const enabledSections = sections.filter((s) => s.enabled);
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">Category printer routing</div>
      <p className="mt-1 text-xs text-slate-500">
        Every order line in a category prints to the sections checked here, unless a specific item overrides it.
      </p>
      <input
        className="mt-3 w-full max-w-xs rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
        placeholder="Search categories…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2.5 py-2">Category</th>
              <th className="px-2.5 py-2">Print to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-2.5 py-4 text-center text-slate-500">
                  No categories found.
                </td>
              </tr>
            ) : (
              filtered.map((cat) => {
                const assigned = routing.byCategory[cat.id] ?? [];
                return (
                  <tr key={cat.id}>
                    <td className="px-2.5 py-2 text-slate-200">{cat.name}</td>
                    <td className="px-2.5 py-2">
                      <div className="flex flex-wrap gap-2">
                        {enabledSections.map((section) => {
                          const checked = assigned.includes(section.id);
                          return (
                            <label key={section.id} className="flex items-center gap-1 text-[11px] text-slate-300">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...assigned, section.id]
                                    : assigned.filter((id) => id !== section.id);
                                  setCategorySections(branchCode, cat.id, next);
                                }}
                              />
                              <span aria-hidden>{section.icon}</span>
                              {section.name}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrinterItemsTab({
  branchCode,
  sections,
  routing,
  categories,
  items,
}: {
  branchCode: string;
  sections: PrinterSection[];
  routing: PrinterRoutingState;
  categories: { id: string; name: string }[];
  items: { id: string; name: string; categoryId: string }[];
}): JSX.Element {
  const [search, setSearch] = useState("");
  const enabledSections = sections.filter((s) => s.enabled);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";
  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">Item printer overrides</div>
      <p className="mt-1 text-xs text-slate-500">
        Items inherit their category's sections by default. Turn on Override to route a specific item differently.
      </p>
      <input
        className="mt-3 w-full max-w-xs rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
        placeholder="Search items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900/90 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2.5 py-2">Item</th>
              <th className="px-2.5 py-2">Inherited from</th>
              <th className="px-2.5 py-2">Override</th>
              <th className="px-2.5 py-2">Print to</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2.5 py-4 text-center text-slate-500">
                  No items found.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const hasOverride = item.id in routing.byItem;
                const effective = hasOverride
                  ? routing.byItem[item.id] ?? []
                  : routing.byCategory[item.categoryId] ?? [];
                return (
                  <tr key={item.id}>
                    <td className="px-2.5 py-2 text-slate-200">{item.name}</td>
                    <td className="px-2.5 py-2 text-slate-500">{categoryName(item.categoryId)}</td>
                    <td className="px-2.5 py-2">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={hasOverride}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setItemSections(branchCode, item.id, routing.byCategory[item.categoryId] ?? []);
                            } else {
                              setItemSections(branchCode, item.id, null);
                            }
                          }}
                        />
                        <span className="text-[11px] text-slate-400">
                          {hasOverride ? "Yes" : "No"}
                        </span>
                      </label>
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex flex-wrap gap-2">
                        {enabledSections.map((section) => {
                          const checked = effective.includes(section.id);
                          return (
                            <label
                              key={section.id}
                              className={`flex items-center gap-1 text-[11px] ${
                                hasOverride ? "text-slate-300" : "text-slate-600"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!hasOverride}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...effective, section.id]
                                    : effective.filter((id) => id !== section.id);
                                  setItemSections(branchCode, item.id, next);
                                }}
                              />
                              <span aria-hidden>{section.icon}</span>
                              {section.name}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrinterProfilesTab({
  branchCode,
  routing,
  systemPrinters,
  users,
  notify,
}: {
  branchCode: string;
  routing: PrinterRoutingState;
  systemPrinters: SystemPrinterInfo[];
  users: { id: string; email: string; role: string }[];
  notify: (message: string) => void;
}): JSX.Element {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PrinterType>("kitchen");
  const [newOsPrinter, setNewOsPrinter] = useState("");

  const usableOsPrinters = useMemo(
    () => systemPrinters.filter((p) => !p.isVirtual),
    [systemPrinters],
  );
  const virtualOsPrinters = useMemo(
    () => systemPrinters.filter((p) => p.isVirtual),
    [systemPrinters],
  );

  function handleAddProfile(): void {
    const name = newName.trim();
    if (!name) {
      notify("Enter a printer name first.");
      return;
    }
    try {
      const profile = addPrinterProfile(branchCode, name, {
        printerType: newType,
        systemPrinterName: newOsPrinter || undefined,
      });
      setNewName("");
      setNewOsPrinter("");
      notify(
        profile.systemPrinterName
          ? `Printer “${profile.name}” added and linked to ${profile.systemPrinterName}.`
          : `Printer “${profile.name}” added. Link a real OS printer before POS can print.`,
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add printer profile.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Default receipt printer</div>
        <p className="mt-1 text-xs text-slate-500">
          Used for POS Pay / Invoice / split bills. Branch: <span className="font-mono text-slate-300">{branchCode}</span>
        </p>
        <select
          className="mt-3 w-full max-w-md rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
          value={routing.receiptPrinterId ?? ""}
          onChange={(e) => setReceiptPrinter(branchCode, e.target.value || null)}
        >
          <option value="">Auto — first Receipt-type profile</option>
          {routing.printers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.systemPrinterName ? ` → ${p.systemPrinterName}` : ""} ({PRINTER_TYPE_LABELS[p.printerType]})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">All printers</div>
        <p className="mt-1 text-xs text-slate-500">
          Add a name, type (Kitchen / Bar / Receipt), and link a real Windows printer. Do not use XPS, PDF, Fax, or
          OneNote — those cannot print POS tickets. Then assign the profile under Printer by Section.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 max-w-xs rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
            placeholder="Printer name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddProfile();
              }
            }}
          />
          <select
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            value={newType}
            onChange={(e) => setNewType(e.target.value as PrinterType)}
          >
            {PRINTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {PRINTER_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            className="min-w-[12rem] max-w-sm flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
            value={newOsPrinter}
            onChange={(e) => setNewOsPrinter(e.target.value)}
          >
            <option value="">Link OS printer (optional now)</option>
            {usableOsPrinters.map((sp) => (
              <option key={sp.name} value={sp.name}>
                {sp.name}
                {sp.isDefault ? " (default)" : ""}
              </option>
            ))}
            {virtualOsPrinters.length > 0 ? (
              <optgroup label="Virtual — not for POS">
                {virtualOsPrinters.map((sp) => (
                  <option key={sp.name} value={sp.name} disabled>
                    {sp.name} (XPS/PDF/Fax)
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
          <Button
            type="button"
            className="shrink-0 text-xs"
            disabled={!newName.trim()}
            onClick={handleAddProfile}
          >
            Add profile
          </Button>
        </div>
        {usableOsPrinters.length === 0 ? (
          <p className="mt-2 text-[11px] text-amber-300">
            No real Windows printers found. Install/connect a USB or network printer, then refresh. You can still add a
            profile name now and link the OS printer later.
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[56rem] text-left text-xs">
            <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-2">Printer name</th>
                <th className="px-2.5 py-2">Type</th>
                <th className="px-2.5 py-2">OS printer</th>
                <th className="px-2.5 py-2">Counter</th>
                <th className="px-2.5 py-2">Assigned users</th>
                <th className="px-2.5 py-2">Branch</th>
                <th className="px-2.5 py-2">Status</th>
                <th className="px-2.5 py-2">Copies / Paper</th>
                <th className="px-2.5 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {routing.printers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2.5 py-4 text-center text-slate-500">
                    No printer profiles yet — add one or Assign a system printer from Sections.
                  </td>
                </tr>
              ) : (
                routing.printers.map((printer) => (
                  <tr key={printer.id} className="align-top">
                    <td className="px-2.5 py-2">
                      <input
                        className="w-full min-w-[8rem] rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                        value={printer.name}
                        onChange={(e) =>
                          updatePrinterProfile(branchCode, printer.id, { name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <select
                        className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                        value={printer.printerType}
                        onChange={(e) =>
                          updatePrinterProfile(branchCode, printer.id, {
                            printerType: e.target.value as PrinterType,
                          })
                        }
                      >
                        {PRINTER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {PRINTER_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      <select
                        className="max-w-[12rem] rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                        value={printer.systemPrinterName ?? ""}
                        onChange={(e) => {
                          try {
                            updatePrinterProfile(branchCode, printer.id, {
                              systemPrinterName: e.target.value || undefined,
                            });
                          } catch (err) {
                            notify(err instanceof Error ? err.message : "Could not link printer.");
                          }
                        }}
                      >
                        <option value="">Not linked</option>
                        {usableOsPrinters.map((sp) => (
                          <option key={sp.name} value={sp.name}>
                            {sp.name}
                            {sp.isDefault ? " (default)" : ""}
                          </option>
                        ))}
                        {printer.systemPrinterName &&
                        !usableOsPrinters.some((sp) => sp.name === printer.systemPrinterName) ? (
                          <option value={printer.systemPrinterName}>
                            {printer.systemPrinterName} (invalid)
                          </option>
                        ) : null}
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      <input
                        className="w-24 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                        placeholder="Counter"
                        value={printer.assignedCounter ?? ""}
                        onChange={(e) =>
                          updatePrinterProfile(branchCode, printer.id, {
                            assignedCounter: e.target.value || undefined,
                          })
                        }
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <AssignedUsersCell
                        branchCode={branchCode}
                        printer={printer}
                        users={users}
                      />
                    </td>
                    <td className="px-2.5 py-2 font-mono text-[10px] text-slate-400">{branchCode}</td>
                    <td className="px-2.5 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          updatePrinterProfile(branchCode, printer.id, {
                            status: printer.status === "online" ? "offline" : "online",
                          })
                        }
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          printer.status === "online"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {printer.status === "online" ? "Online" : "Offline"}
                      </button>
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          min={1}
                          max={9}
                          value={printer.copies}
                          onChange={(e) =>
                            updatePrinterProfile(branchCode, printer.id, {
                              copies: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                          title="Copies"
                        />
                        <select
                          value={printer.paperSize}
                          onChange={(e) =>
                            updatePrinterProfile(branchCode, printer.id, {
                              paperSize: e.target.value as PrinterPaperSize,
                            })
                          }
                          className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                          title="Thermal paper width"
                        >
                          <option value="58mm">58mm roll</option>
                          <option value="80mm">80mm roll</option>
                          <option value="A4">A4</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          type="button"
                          className="text-amber-400 hover:text-amber-300"
                          onClick={() => {
                            void (async () => {
                              const target = printer.systemPrinterName?.trim();
                              if (!target) {
                                notify("Link an OS printer on this profile before Test Print.");
                                return;
                              }
                              const ok = await printTestPageAsync(target, {
                                copies: printer.copies,
                                branchCode,
                                paperSize: printer.paperSize,
                              });
                              logPrintEvent(branchCode, { kind: "test", printerName: target, ok });
                              notify(
                                ok
                                  ? `Test print sent to ${target}.`
                                  : `Test print failed on ${target}. Check the OS printer link.`,
                              );
                            })();
                          }}
                        >
                          Test print
                        </button>
                        <button
                          type="button"
                          className="text-sky-400 hover:text-sky-300"
                          onClick={() => {
                            const copy = duplicatePrinterProfile(branchCode, printer.id);
                            if (copy) notify(`Profile duplicated as "${copy.name}".`);
                          }}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => deletePrinterProfile(branchCode, printer.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AssignedUsersCell({
  branchCode,
  printer,
  users,
}: {
  branchCode: string;
  printer: PrinterProfile;
  users: { id: string; email: string; role: string }[];
}): JSX.Element {
  const assignedIds = getUserIdsForPrinter(branchCode, printer.id);
  const labels = assignedIds.map((id) => users.find((u) => u.id === id)?.email ?? id);

  return (
    <div className="min-w-[10rem] space-y-1">
      {labels.length === 0 ? (
        <span className="text-[10px] text-slate-600">No users — use Assign Users tab</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {labels.slice(0, 4).map((label) => (
            <span
              key={label}
              className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300"
              title={label}
            >
              {label.includes("@") ? label.split("@")[0] : label}
            </span>
          ))}
          {labels.length > 4 ? (
            <span className="text-[10px] text-slate-500">+{labels.length - 4}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PrinterAssignmentTab({
  branchCode,
  routing,
  users,
  notify,
}: {
  branchCode: string;
  routing: PrinterRoutingState;
  users: { id: string; email: string; role: string }[];
  notify: (message: string) => void;
}): JSX.Element {
  const [filterUser, setFilterUser] = useState("");
  const [filterCounter, setFilterCounter] = useState("");
  const [filterType, setFilterType] = useState<PrinterType | "">("");
  const [filterPrinter, setFilterPrinter] = useState("");
  const [search, setSearch] = useState("");
  const counters = listAssignedCounters(branchCode);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filteredUsers = users.filter((u) => {
    if (filterUser && u.id !== filterUser) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const filteredPrinters = routing.printers.filter((p) => {
    if (filterType && p.printerType !== filterType) return false;
    if (filterCounter && (p.assignedCounter ?? "") !== filterCounter) return false;
    if (filterPrinter && p.id !== filterPrinter) return false;
    return true;
  });

  function assignAllOfType(userId: string, type: PrinterType, assign: boolean): void {
    const targets = routing.printers.filter((p) => p.printerType === type);
    for (const p of targets) toggleUserPrinter(branchCode, userId, p.id, assign);
    notify(
      assign
        ? `Assigned all ${PRINTER_TYPE_LABELS[type]} printers to user.`
        : `Removed all ${PRINTER_TYPE_LABELS[type]} printers from user.`,
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          Assign printers to users / waiters
        </div>
        <p className="mt-1 text-xs text-slate-500">
          One user can have Kitchen + Bar + Receipt. One printer can be shared by many users. Cashiers can also
          change their own printers on POS → <span className="text-amber-300">My printers</span>. Waiters: assign
          by name on Waiter page → Printer assignments. Branch:{" "}
          <span className="font-mono text-slate-300">{branchCode}</span>
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-[10px] uppercase tracking-wide text-slate-500">
            Branch
            <input
              readOnly
              value={branchCode}
              className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1.5 font-mono text-xs text-slate-300"
            />
          </label>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">
            Counter
            <select
              className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              value={filterCounter}
              onChange={(e) => setFilterCounter(e.target.value)}
            >
              <option value="">All counters</option>
              {counters.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">
            User
            <select
              className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">
            Printer type
            <select
              className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as PrinterType | "")}
            >
              <option value="">All types</option>
              {PRINTER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PRINTER_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase tracking-wide text-slate-500">
            Printer
            <select
              className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              value={filterPrinter}
              onChange={(e) => setFilterPrinter(e.target.value)}
            >
              <option value="">All printers</option>
              {routing.printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({PRINTER_TYPE_LABELS[p.printerType]})
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          className="mt-2 w-full max-w-md rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">User → Assigned printers</div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[40rem] text-left text-xs">
            <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-2">User / Waiter</th>
                <th className="px-2.5 py-2">Role</th>
                <th className="px-2.5 py-2">Assigned printers</th>
                <th className="px-2.5 py-2">Quick</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2.5 py-4 text-center text-slate-500">
                    No users match filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const assigned = getPrintersForUser(branchCode, u.id);
                  const assignedIds = new Set(assigned.map((p) => p.id));
                  return (
                    <tr key={u.id} className="align-top">
                      <td className="px-2.5 py-2 font-medium text-slate-200">{u.email}</td>
                      <td className="px-2.5 py-2 text-slate-400">{u.role}</td>
                      <td className="px-2.5 py-2">
                        {filteredPrinters.length === 0 ? (
                          <span className="text-slate-600">No printers match filters</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {filteredPrinters.map((p) => {
                              const on = assignedIds.has(p.id);
                              return (
                                <label
                                  key={p.id}
                                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-[10px] ring-1 transition ${
                                    on
                                      ? "bg-amber-500/20 text-amber-100 ring-amber-500/40"
                                      : "bg-slate-900 text-slate-400 ring-slate-700 hover:ring-slate-500"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="accent-amber-500"
                                    checked={on}
                                    onChange={(e) => {
                                      toggleUserPrinter(branchCode, u.id, p.id, e.target.checked);
                                      notify(
                                        e.target.checked
                                          ? `Assigned ${p.name} → ${u.email}`
                                          : `Removed ${p.name} from ${u.email}`,
                                      );
                                    }}
                                  />
                                  <span>
                                    {p.name}
                                    <span className="ml-1 opacity-70">
                                      · {PRINTER_TYPE_LABELS[p.printerType]}
                                      {p.assignedCounter ? ` · ${p.assignedCounter}` : ""}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {assigned.length > 0 ? (
                          <p className="mt-1.5 text-[10px] text-slate-500">
                            {assigned.length} assigned:{" "}
                            {assigned
                              .map((p) => `${p.name} (${PRINTER_TYPE_LABELS[p.printerType]})`)
                              .join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-col gap-1">
                          {(["kitchen", "bar", "receipt"] as PrinterType[]).map((type) => (
                            <button
                              key={type}
                              type="button"
                              className="text-left text-[10px] text-sky-400 hover:text-sky-300"
                              onClick={() => assignAllOfType(u.id, type, true)}
                            >
                              + All {PRINTER_TYPE_LABELS[type]}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="text-left text-[10px] text-red-400 hover:text-red-300"
                            onClick={() => {
                              setUserPrinters(branchCode, u.id, []);
                              notify(`Cleared all printers for ${u.email}.`);
                            }}
                          >
                            Clear all
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Printer → Assigned users</div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-2">Printer</th>
                <th className="px-2.5 py-2">Type</th>
                <th className="px-2.5 py-2">Counter</th>
                <th className="px-2.5 py-2">Status</th>
                <th className="px-2.5 py-2">Assigned users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredPrinters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2.5 py-4 text-center text-slate-500">
                    No printers match filters. Add profiles first.
                  </td>
                </tr>
              ) : (
                filteredPrinters.map((p) => {
                  const userIds = getUserIdsForPrinter(branchCode, p.id);
                  return (
                    <tr key={p.id}>
                      <td className="px-2.5 py-2 font-medium text-slate-200">
                        {p.name}
                        {p.systemPrinterName ? (
                          <div className="text-[10px] text-sky-400">{p.systemPrinterName}</div>
                        ) : null}
                      </td>
                      <td className="px-2.5 py-2 text-slate-400">{PRINTER_TYPE_LABELS[p.printerType]}</td>
                      <td className="px-2.5 py-2 text-slate-400">{p.assignedCounter || "—"}</td>
                      <td className="px-2.5 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            p.status === "online"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        {userIds.length === 0 ? (
                          <span className="text-slate-600">Shared with nobody yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {userIds.map((id) => {
                              const u = userById.get(id);
                              return (
                                <span
                                  key={id}
                                  className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200"
                                >
                                  {u?.email ?? id}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PrinterRoutingPreviewTab({
  sections,
  routing,
  categories,
  items,
}: {
  sections: PrinterSection[];
  routing: PrinterRoutingState;
  categories: { id: string; name: string }[];
  items: { id: string; name: string; categoryId: string }[];
}): JSX.Element {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => items.slice(0, 3).map((i) => i.id));
  const [search, setSearch] = useState("");

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()));

  function resolveForItem(item: { id: string; categoryId: string }): PrinterSection[] {
    const sectionIds = item.id in routing.byItem ? routing.byItem[item.id] ?? [] : routing.byCategory[item.categoryId] ?? [];
    return sections.filter((s) => sectionIds.includes(s.id) && s.enabled);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">Routing preview</div>
      <p className="mt-1 text-xs text-slate-500">
        Pick a few items to see exactly where their KOT would print — a quick way to verify routing before service.
      </p>

      <input
        className="mt-3 w-full max-w-xs rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
        placeholder="Search items to preview…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {filtered.slice(0, 40).map((item) => {
          const checked = selectedItemIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setSelectedItemIds((current) =>
                  checked ? current.filter((id) => id !== item.id) : [...current, item.id],
                )
              }
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                checked
                  ? "border-amber-400 bg-amber-500/15 text-amber-200"
                  : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600"
              }`}
            >
              {item.name}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        {selectedItemIds.length === 0 ? (
          <p className="text-xs text-slate-500">Select items above to preview routing.</p>
        ) : (
          items
            .filter((i) => selectedItemIds.includes(i.id))
            .map((item) => {
              const targets = resolveForItem(item);
              return (
                <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
                  <span className="font-medium text-slate-200">{item.name}</span>
                  <span className="text-slate-600" aria-hidden>→</span>
                  {targets.length === 0 ? (
                    <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400">
                      Not routed
                    </span>
                  ) : (
                    targets.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                        style={{ backgroundColor: `${t.color}25`, color: t.color }}
                      >
                        {t.icon} {t.name}
                      </span>
                    ))
                  )}
                </div>
              );
            })
        )}
        <p className="pt-1 text-[10px] text-slate-500">
          Categories: {categories.length} · reflects live Categories/Items tab routing.
        </p>
      </div>
    </div>
  );
}

function PrintQueueTab({ branchCode }: { branchCode: string }): JSX.Element {
  const history = loadPrintHistory(branchCode);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Print queue &amp; history</div>
          <p className="mt-1 text-xs text-slate-500">
            Printing is dialog-based today, so there's no async queue to hold — this is a running log of every
            print attempt for auditing and troubleshooting.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="text-xs"
          disabled={history.length === 0}
          onClick={() => clearPrintHistory(branchCode)}
        >
          Clear history
        </Button>
      </div>

      <div className="mt-3 max-h-[28rem] overflow-y-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-900/90 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2.5 py-2">Time</th>
              <th className="px-2.5 py-2">Kind</th>
              <th className="px-2.5 py-2">Printer</th>
              <th className="px-2.5 py-2">Order</th>
              <th className="px-2.5 py-2">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2.5 py-4 text-center text-slate-500">
                  No print activity yet.
                </td>
              </tr>
            ) : (
              history.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-2.5 py-2 text-slate-400">{new Date(entry.at).toLocaleString()}</td>
                  <td className="px-2.5 py-2 uppercase text-slate-300">{entry.kind}</td>
                  <td className="px-2.5 py-2 text-slate-300">{entry.printerName ?? "—"}</td>
                  <td className="px-2.5 py-2 text-slate-300">{entry.orderRef ?? "—"}</td>
                  <td className="px-2.5 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        entry.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {entry.ok ? "Sent" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PrinterManagement({ branchCode }: { branchCode: string }): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("printers");
  const [notice, setNotice] = useState<string | null>(null);
  const { sections, routing } = usePrinterConfig(branchCode);

  const systemPrintersQuery = useQuery({
    queryKey: ["system-printers"],
    queryFn: listSystemPrintersDetailed,
    refetchInterval: 15_000,
  });
  const systemPrinters = systemPrintersQuery.data?.usable ?? [];
  const allSystemPrinters = systemPrintersQuery.data?.printers ?? [];
  const systemPrintersError = systemPrintersQuery.data?.error ?? null;

  const menuQuery = useQuery({
    queryKey: ["menu", "admin", branchCode, "printer-management"],
    queryFn: () => fetchBranchMenuAdmin(branchCode),
  });
  const categories = menuQuery.data?.categories ?? [];
  const items = menuQuery.data?.items ?? [];

  const usersQuery = useQuery({
    queryKey: ["org-users", "printer-management"],
    queryFn: () => fetchOrgUsers(),
  });
  const users = usersQuery.data ?? [];

  const waitersQuery = useQuery({
    queryKey: ["billing", "waiters", branchCode, "printer-management"],
    queryFn: () => fetchWaiters(branchCode),
  });
  const waiters = waitersQuery.data ?? [];

  const assignablePeople = useMemo((): AssignablePerson[] => {
    const fromUsers: AssignablePerson[] = users.map((u) => ({
      id: u.id,
      label: u.email,
      role: u.role,
      kind: "user",
    }));
    const userIds = new Set(fromUsers.map((u) => u.id));
    const fromWaiters: AssignablePerson[] = waiters
      .filter((w) => !userIds.has(w.id))
      .map((w) => ({
        id: w.id,
        label: w.name,
        role: "waiter",
        kind: "waiter" as const,
      }));
    // Prefer waiter display name when the same id exists as an org user.
    const merged = fromUsers.map((u) => {
      const waiter = waiters.find((w) => w.id === u.id);
      if (!waiter) return u;
      return { ...u, label: waiter.name, kind: "waiter" as const, role: "waiter" };
    });
    return [...merged, ...fromWaiters].sort((a, b) => a.label.localeCompare(b.label));
  }, [users, waiters]);

  function notify(message: string): void {
    setNotice(message);
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            disabled={systemPrinters.length === 0}
            onClick={() => {
              void (async () => {
                let sent = 0;
                const routingState = loadPrinterRouting(branchCode);
                for (const p of systemPrinters) {
                  const paperSize = routingState.printers.find(
                    (pr) => pr.systemPrinterName === p.name,
                  )?.paperSize;
                  const ok = await printTestPageAsync(p.name, {
                    branchCode,
                    paperSize,
                  });
                  logPrintEvent(branchCode, { kind: "test", printerName: p.name, ok });
                  if (ok) sent += 1;
                }
                notify(`Test print sent to ${sent} of ${systemPrinters.length} printers.`);
              })();
            }}
          >
            Test all printers
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={() => {
              const json = exportPrinterConfig(branchCode);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `printer-config-${branchCode}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export config
          </Button>
          <label className="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:text-white">
            Import config
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const text = await file.text();
                  importPrinterConfig(branchCode, text);
                  notify("Printer configuration imported.");
                } catch (err) {
                  notify(err instanceof Error ? err.message : "Import failed.");
                }
              }}
            />
          </label>
        </div>
      </div>

      {notice ? (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            /virtual|could not|enter a|xps|failed|invalid/i.test(notice)
              ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {notice}
        </p>
      ) : null}

      <PrinterDashboardStats
        branchCode={branchCode}
        sections={sections}
        routing={routing}
        systemPrinters={systemPrinters}
      />

      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/40 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === tab.id ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "printers" ? (
        <PrinterProfilesTab
          branchCode={branchCode}
          routing={routing}
          systemPrinters={allSystemPrinters.length > 0 ? allSystemPrinters : systemPrinters}
          users={users}
          notify={notify}
        />
      ) : null}
      {activeTab === "by-section" ? (
        <PrinterBySectionPanel
          branchCode={branchCode}
          sections={sections}
          routing={routing}
          people={assignablePeople}
          notify={notify}
        />
      ) : null}
      {activeTab === "settings" ? (
        <ThermalPrintSettingsPanel branchCode={branchCode} notify={notify} />
      ) : null}
      {activeTab === "categories" ? (
        <PrinterCategoriesTab branchCode={branchCode} sections={sections} routing={routing} categories={categories} />
      ) : null}
      {activeTab === "items" ? (
        <PrinterItemsTab
          branchCode={branchCode}
          sections={sections}
          routing={routing}
          categories={categories}
          items={items}
        />
      ) : null}
      {activeTab === "preview" ? (
        <PrinterRoutingPreviewTab sections={sections} routing={routing} categories={categories} items={items} />
      ) : null}
      {activeTab === "queue" ? <PrintQueueTab branchCode={branchCode} /> : null}
    </div>
  );
}

export function PrinterPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const [kotSaved, setKotSaved] = useState<KotPrintSettings>(DEFAULT_KOT_PRINT_SETTINGS);
  const [kotDraft, setKotDraft] = useState<KotPrintSettings>(DEFAULT_KOT_PRINT_SETTINGS);
  const [notice, setNotice] = useState<string | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const menuQuery = useQuery({
    queryKey: ["menu", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchMenuAdmin(branch!.code),
  });

  const usersQuery = useQuery({
    queryKey: ["org-users"],
    queryFn: () => fetchOrgUsers(),
  });

  const printerMap = useMemo(
    () => loadPrinterAssignments(branch?.code),
    [branch?.code, notice],
  );

  useEffect(() => {
    const kot = loadKotPrintSettings(branch?.code);
    setKotSaved(kot);
    setKotDraft(kot);
  }, [branch?.code]);

  function applyKot(): void {
    if (!branch?.code) return;
    const next = normalizeKotPrintSettings(kotDraft);
    saveKotPrintSettings(branch.code, next);
    setKotSaved(next);
    setKotDraft(next);
    setNotice("KOT print template saved.");
  }

  if (!branch?.code) {
    return <PageHeader title="Printer" subtitle="Select a branch to configure printer settings." />;
  }

  const categories = menuQuery.data?.categories ?? [];
  const items = menuQuery.data?.items ?? [];
  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printer"
        subtitle={`Printer configuration for ${branch.name} (${branch.code}) — sections, profiles, routing, and KOT template.`}
      />

      <PrinterManagement branchCode={branch.code} />

      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Kitchen KOT print template</div>
        <p className="mt-1 text-xs text-slate-500">Customize how kitchen order tickets are printed.</p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={kotDraft.emphasizeOrderMeta}
              onChange={(e) => setKotDraft((p) => ({ ...p, emphasizeOrderMeta: e.target.checked }))}
            />
            Bold &amp; enlarge order number, order type, and table number
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={kotDraft.showItemTotals}
              onChange={(e) => setKotDraft((p) => ({ ...p, showItemTotals: e.target.checked }))}
            />
            Show total items and total item quantity
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={kotDraft.itemUnderlineSeparator}
              onChange={(e) => setKotDraft((p) => ({ ...p, itemUnderlineSeparator: e.target.checked }))}
            />
            Underline separator for each item
          </label>
          <label className="block text-xs text-slate-400">
            Base font size (px) — larger is easier to read in kitchen
            <input
              type="number"
              min={12}
              max={20}
              value={kotDraft.baseFontSize}
              onChange={(e) =>
                setKotDraft((p) => ({ ...p, baseFontSize: Number(e.target.value) || 15 }))
              }
              className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="mt-4">
          <Button type="button" className="text-xs" onClick={() => applyKot()}>
            Save KOT template
          </Button>
        </div>
      </div>

      <div className="max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Advanced</div>
            <p className="mt-0.5 text-xs text-slate-500">
              Legacy single-name printer assignment — only needed for older setups.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-900"
            aria-expanded={legacyOpen}
            onClick={() => setLegacyOpen((v) => !v)}
          >
            {legacyOpen ? "Hide legacy assignment" : "Show legacy assignment"}
            <span className="text-[10px] text-slate-400" aria-hidden>
              {legacyOpen ? "▴" : "▾"}
            </span>
          </button>
        </div>

        {legacyOpen ? (
          <div className="p-4">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              Printer assignment (legacy)
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Original single-printer-name assignment by user, category, or item. Prefer{" "}
              <span className="text-slate-300">All Printers</span> and{" "}
              <span className="text-slate-300">Printer by Section</span> above for new setups.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-400">User-wise</div>
                <ul className="mt-2 space-y-2">
                  {users.slice(0, 8).map((u) => (
                    <li key={u.id} className="flex items-center gap-2">
                      <span className="w-40 truncate text-xs text-slate-300">{u.email}</span>
                      <select
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        value={printerMap.byUser[u.id]?.printerName ?? ""}
                        onChange={(e) => {
                          setUserPrinter(branch.code, u.id, e.target.value);
                          setNotice(`Printer updated for ${u.email}`);
                        }}
                      >
                        <option value="">Default</option>
                        {PRINTER_PRESETS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-400">Category-wise</div>
                <ul className="mt-2 space-y-2">
                  {categories.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="w-40 truncate text-xs text-slate-300">{c.name}</span>
                      <select
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        value={printerMap.byCategory[c.id]?.printerName ?? ""}
                        onChange={(e) => {
                          setCategoryPrinter(branch.code, c.id, e.target.value);
                          setNotice(`Printer updated for category ${c.name}`);
                        }}
                      >
                        <option value="">Default</option>
                        {PRINTER_PRESETS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-400">Item-wise</div>
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {items.slice(0, 20).map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <span className="w-40 truncate text-xs text-slate-300">{item.name}</span>
                      <select
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        value={printerMap.byItem[item.id]?.printerName ?? ""}
                        onChange={(e) => {
                          setItemPrinter(branch.code, item.id, e.target.value);
                          setNotice(`Printer updated for ${item.name}`);
                        }}
                      >
                        <option value="">Default</option>
                        {PRINTER_PRESETS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
