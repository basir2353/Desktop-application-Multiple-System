import { Button } from "@platform/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePopsStore } from "../../../stores/popsStore";
import { KotCustomizationPanel } from "../../components/KotCustomizationPanel";
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
  type PrinterSectionPreset,
} from "../../lib/printerSections";
import { useActiveSystemId } from "../../../hooks/useActiveSystemId";
import { fetchStoreCategories, fetchStoreProducts } from "../../../store/api/store";
import {
  addPrinterProfile,
  deletePrinterProfile,
  duplicatePrinterProfile,
  exportPrinterConfig,
  getPrintersForUser,
  getUserIdsForPrinter,
  importPrinterConfig,
  listAssignedCounters,
  listSectionsForPrinter,
  loadPrinterRouting,
  movePrinterPriority,
  PRINTER_ROUTING_CHANGED_EVENT,
  PRINTER_TEXT_SCALE_LABELS,
  printerTypeForSection,
  printerTypeLabel,
  printerTypesForSystem,
  setCategorySections,
  setItemSections,
  setReceiptPrinter,
  setSectionPrimaryPrinter,
  setUserPrinters,
  togglePrinterForSection,
  toggleUserPrinter,
  updatePrinterProfile,
  type PrinterPaperSize,
  type PrinterProfile,
  type PrinterRoutingState,
  type PrinterTextScale,
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
import {
  clampCustomPaperWidthMm,
  loadThermalPrintSettings,
  saveThermalPrintSettings,
} from "../../lib/thermalPrintSettings";
import { fetchBranchMenuAdmin } from "../../api/menu";
import { fetchAssignableStaff, fetchOrgUsers } from "../../api/users";
import { PageHeader } from "../../ui/PageHeader";
import { PrinterBySectionPanel, type AssignablePerson } from "../../components/PrinterBySectionPanel";
import { EnterprisePrintDashboard } from "../../components/EnterprisePrintDashboard";
import { PrintCustomizeHub } from "../../components/PrintCustomizeHub";
import {
  IconActivity,
  IconPalette,
  IconPrinter,
  IconReceipt,
  IconRoute,
  IconServer,
  IconUsers,
  IconLayers,
} from "../../components/printerUiIcons";

const SECTION_ICON_CHOICES = ["🍳", "🍸", "🧑‍🍳", "🔥", "🍰", "🥤", "🧾", "📦", "🛵", "☕", "🥖", "🖨️"];
const SECTION_COLOR_CHOICES = [
  "#f59e0b", "#8b5cf6", "#38bdf8", "#ef4444", "#f472b6",
  "#22d3ee", "#a3e635", "#fb923c", "#34d399", "#94a3b8",
];

/** Main nav — fewer tabs, clearer jobs. Old fine-grained tabs live under Routing. */
const TABS = [
  { id: "overview", label: "Server", Icon: IconServer },
  { id: "printers", label: "Printers", Icon: IconPrinter },
  { id: "routing", label: "Routing", Icon: IconRoute },
  { id: "customize", label: "Customize", Icon: IconPalette },
  { id: "activity", label: "Activity", Icon: IconActivity },
] as const;

type RoutingSub = "staff" | "sections" | "categories" | "items" | "preview";

const ROUTING_SUBS: { id: RoutingSub; label: string; Icon: typeof IconUsers }[] = [
  { id: "staff", label: "Staff", Icon: IconUsers },
  { id: "sections", label: "By section", Icon: IconLayers },
  { id: "categories", label: "Categories", Icon: IconLayers },
  { id: "items", label: "Items", Icon: IconLayers },
  { id: "preview", label: "Preview", Icon: IconRoute },
];


/** Options for type dropdowns — includes legacy type if profile still has Kitchen/Bar on store. */
function typeOptionsForProfile(isStore: boolean, current?: PrinterType): PrinterType[] {
  const base = printerTypesForSystem(isStore);
  if (current && !base.includes(current)) return [current, ...base];
  return base;
}
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
function usePrinterConfig(branchCode: string, preset: PrinterSectionPreset = "restaurant") {
  const [sections, setSections] = useState<PrinterSection[]>(() => loadPrinterSections(branchCode, preset));
  const [historyRevision, setHistoryRevision] = useState(0);
  const [routingRevision, setRoutingRevision] = useState(0);

  useEffect(() => {
    setSections(loadPrinterSections(branchCode, preset));
  }, [branchCode, preset]);

  useEffect(() => {
    function onSectionsChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (detail?.branchCode === branchCode) setSections(loadPrinterSections(branchCode, preset));
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
  }, [branchCode, preset]);

  const routing = useMemo(() => {
    void routingRevision;
    return loadPrinterRouting(branchCode);
  }, [branchCode, routingRevision]);

  return { sections, routing, historyRevision };
}

function StatCard({
  label,
  value,
  tone,
  Icon,
}: {
  label: string;
  value: string | number;
  tone?: "warn" | "danger" | "ok";
  Icon?: typeof IconPrinter;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/50 px-3.5 py-3">
      {Icon ? (
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            tone === "danger"
              ? "bg-red-500/15 text-red-300"
              : tone === "warn"
                ? "bg-amber-500/15 text-amber-300"
                : tone === "ok"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-slate-800 text-slate-400"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <div className="min-w-0">
        <div
          className={`text-lg font-semibold tabular-nums leading-none ${
            tone === "danger" ? "text-red-400" : tone === "warn" ? "text-amber-400" : "text-white"
          }`}
        >
          {value}
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function PrinterDashboardStats({
  branchCode,
  sections,
  systemPrinters,
}: {
  branchCode: string;
  sections: PrinterSection[];
  routing: PrinterRoutingState;
  systemPrinters: SystemPrinterInfo[];
}): JSX.Element {
  const onlineCount = systemPrinters.filter((p) => p.state === "ready" || p.state === "printing").length;
  const offlineCount = systemPrinters.length - onlineCount;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard label="Sections" value={sections.length} Icon={IconLayers} />
      <StatCard label="Printers" value={systemPrinters.length} Icon={IconPrinter} />
      <StatCard
        label="Online"
        value={onlineCount}
        tone={onlineCount > 0 ? "ok" : undefined}
        Icon={IconPrinter}
      />
      <StatCard
        label="Prints today"
        value={todaysPrintCount(branchCode)}
        tone={offlineCount > 0 ? "warn" : undefined}
        Icon={IconReceipt}
      />
    </div>
  );
}

function maybeSetDefaultPosPrinter(
  branchCode: string,
  profileId: string,
  printerType: PrinterType,
  sectionId?: string,
): void {
  const isPosType =
    printerType === "receipt" ||
    printerType === "counter" ||
    sectionId === "receipt" ||
    sectionId === "counter";
  if (!isPosType) return;
  const state = loadPrinterRouting(branchCode);
  if (
    !state.receiptPrinterId ||
    printerType === "receipt" ||
    sectionId === "receipt"
  ) {
    setReceiptPrinter(branchCode, profileId);
  }
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
  isStore = false,
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
  isStore?: boolean;
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
  const assignedIds = selectedSection ? routing.sectionPrinters[selectedSection.id] ?? [] : [];
  /** Center table: ONLY printers assigned to the selected section (not all profiles). */
  const filteredPrinters = (selectedSection
    ? assignedIds
        .map((id) => routing.printers.find((p) => p.id === id))
        .filter((p): p is (typeof routing.printers)[number] => Boolean(p))
    : []
  ).filter((p) => p.name.toLowerCase().includes(printerSearch.trim().toLowerCase()));
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

  function assignSystemPrinter(printer: SystemPrinterInfo): void {
    if (!selectedSection) {
      notify(
        isStore
          ? "Select Receipt or Counter on the left, then tap Use for…"
          : "Select Kitchen or Bar on the left, then tap Use for…",
      );
      return;
    }
    const printerType = printerTypeForSection(selectedSection);
    // Link every Windows printer (USB, network, PDF, XPS, …) for Auto silent print.
    const systemPrinterName = printer.name;
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
      // Keep existing printerType — do not retag a shared profile as Kitchen when
      // linking it to another section (Grill/Waiter). Assignment is per sectionId.
      updatePrinterProfile(branchCode, profile.id, {
        systemPrinterName: profile.systemPrinterName?.trim() || systemPrinterName,
      });
    }
    togglePrinterForSection(branchCode, selectedSection.id, profile.id, true);
    maybeSetDefaultPosPrinter(branchCode, profile.id, printerType, selectedSection.id);
    notify(
      printer.isVirtual
        ? `✓ ${printer.name} → ${selectedSection.name} only (PDF/XPS). Other sections unchanged.`
        : `✓ ${printer.name} → ${selectedSection.name} only. Other sections unchanged.`,
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
              1) Pick a section on the left → 2) Assign printer (only that section)
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {selectedSection
                ? `Selected: ${selectedSection.name}. “Use for ${selectedSection.name}” applies to this section only — not Bar, Grill, Waiter, etc.`
                : isStore
                  ? "Select Receipt or Counter on the left, then choose a printer."
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
                Open Windows Settings → Printers, install your{" "}
                {isStore ? "receipt / counter" : "kitchen"} printer, then click{" "}
                <span className="text-amber-300">Refresh printers</span>.
              </p>
            </div>
          ) : (
            displayedSystemPrinters.map((printer) => {
              const linkedProfile =
                routing.printers.find((p) => p.systemPrinterName === printer.name) ??
                routing.printers.find(
                  (p) => p.name.toLowerCase() === printer.name.toLowerCase(),
                );
              const alreadyOnSection = Boolean(
                linkedProfile && assignedIds.includes(linkedProfile.id),
              );
              return (
              <div
                key={printer.name}
                className={`rounded-lg border p-3 ${
                  alreadyOnSection
                    ? "border-amber-500/40 bg-amber-500/5"
                    : printer.isVirtual
                      ? "border-slate-800 bg-slate-950/40 opacity-90"
                      : "border-slate-700 bg-slate-950/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-sm font-medium text-white">{printer.name}</div>
                  {alreadyOnSection ? (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">
                      On {selectedSection?.name ?? "section"}
                    </span>
                  ) : printer.isVirtual ? (
                    <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] text-sky-300">
                      PDF/XPS
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300">
                      Ready
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot(printer.status)}`} aria-hidden />
                  {statusLabel(printer.status)} · {printer.connectionType}
                  {printer.isDefault ? (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-300">Default</span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {alreadyOnSection && linkedProfile && selectedSection ? (
                    <Button
                      type="button"
                      className="text-xs"
                      onClick={() => {
                        togglePrinterForSection(
                          branchCode,
                          selectedSection.id,
                          linkedProfile.id,
                          false,
                        );
                        notify(`Removed ${printer.name} from ${selectedSection.name} only.`);
                      }}
                    >
                      Remove from {selectedSection.name}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="text-xs"
                      disabled={!selectedSection}
                      onClick={() => assignSystemPrinter(printer)}
                    >
                      Use for {selectedSection?.name ?? "section"}
                    </Button>
                  )}
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
                </div>
              </div>
              );
            })
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
                        const linkedProfile =
                          routing.printers.find((p) => p.systemPrinterName === printer.name) ??
                          routing.printers.find(
                            (p) => p.name.toLowerCase() === printer.name.toLowerCase(),
                          );
                        const alreadyAdded = Boolean(
                          linkedProfile && assignedIds.includes(linkedProfile.id),
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
                                {alreadyAdded
                                  ? `On ${selectedSection?.name ?? "section"}`
                                  : "Select"}
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
              Table below shows printers for
              {selectedSection ? ` ${selectedSection.name} only` : " the selected section"}
              — assigning here never updates other sections.
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
                        {selectedSection
                          ? `No printers on ${selectedSection.name} yet. Use “Use for ${selectedSection.name}” above — other sections stay unchanged.`
                          : "Select a section on the left, then assign a printer."}
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
                              if (!selectedSection) return;
                              togglePrinterForSection(
                                branchCode,
                                selectedSection.id,
                                printer.id,
                                false,
                              );
                              notify(
                                `Removed "${printer.name}" from ${selectedSection.name} only. Other sections unchanged.`,
                              );
                            }}
                          >
                            Remove from {selectedSection?.name ?? "section"}
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

                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
                  <div className="text-xs font-semibold text-slate-200">
                    Assign printer → {selectedSection.name} only
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    This does not change Bar, Grill, Waiter, or other sections.
                  </p>
                  <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                    {displayedSystemPrinters.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        {systemPrintersLoading
                          ? "Scanning Windows printers…"
                          : "No Windows printers found. Click Refresh printers above."}
                      </p>
                    ) : (
                      displayedSystemPrinters.map((printer) => {
                        const linkedProfile =
                          routing.printers.find((p) => p.systemPrinterName === printer.name) ??
                          routing.printers.find(
                            (p) => p.name.toLowerCase() === printer.name.toLowerCase(),
                          );
                        const alreadyOnSection = Boolean(
                          linkedProfile && assignedIds.includes(linkedProfile.id),
                        );
                        return (
                          <div
                            key={`right-${printer.name}`}
                            className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1.5"
                          >
                            <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">
                              {printer.name}
                            </span>
                            {alreadyOnSection ? (
                              <button
                                type="button"
                                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-500/10"
                                onClick={() => {
                                  if (!linkedProfile) return;
                                  togglePrinterForSection(
                                    branchCode,
                                    selectedSection.id,
                                    linkedProfile.id,
                                    false,
                                  );
                                  notify(`Removed ${printer.name} from ${selectedSection.name}.`);
                                }}
                              >
                                Remove
                              </button>
                            ) : (
                              <Button
                                type="button"
                                className="shrink-0 text-[10px]"
                                onClick={() => assignSystemPrinter(printer)}
                              >
                                Use for {selectedSection.name}
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400">
                    Assigned to {selectedSection.name} (top = primary)
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {assignedIds.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        None yet — use “Use for {selectedSection.name}” above.
                      </p>
                    ) : (
                      assignedIds.map((printerId, index) => {
                        const printer = routing.printers.find((p) => p.id === printerId);
                        if (!printer) return null;
                        const primary = index === 0;
                        return (
                          <div
                            key={printer.id}
                            className="flex items-center gap-2 text-xs text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked
                              onChange={() =>
                                togglePrinterForSection(
                                  branchCode,
                                  selectedSection.id,
                                  printer.id,
                                  false,
                                )
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">{printer.name}</span>
                            {primary ? (
                              <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-300">
                                Primary
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-slate-700/60 px-1.5 py-0.5 text-[9px] text-slate-400">
                                Backup
                              </span>
                            )}
                            <span className="flex shrink-0 gap-0.5">
                              <button
                                type="button"
                                disabled={index === 0}
                                className="rounded px-1 text-slate-400 hover:text-white disabled:opacity-30"
                                onClick={() =>
                                  movePrinterPriority(
                                    branchCode,
                                    selectedSection.id,
                                    printer.id,
                                    -1,
                                  )
                                }
                                aria-label="Move up"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={index === assignedIds.length - 1}
                                className="rounded px-1 text-slate-400 hover:text-white disabled:opacity-30"
                                onClick={() =>
                                  movePrinterPriority(
                                    branchCode,
                                    selectedSection.id,
                                    printer.id,
                                    1,
                                  )
                                }
                                aria-label="Move down"
                              >
                                ▼
                              </button>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {routing.printers.some((p) => !assignedIds.includes(p.id)) ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300">
                        Link an existing profile to {selectedSection.name}
                      </summary>
                      <div className="mt-1.5 space-y-1">
                        {routing.printers
                          .filter((p) => !assignedIds.includes(p.id))
                          .map((printer) => (
                            <label
                              key={printer.id}
                              className="flex items-center gap-2 text-[11px] text-slate-400"
                            >
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() =>
                                  togglePrinterForSection(
                                    branchCode,
                                    selectedSection.id,
                                    printer.id,
                                    true,
                                  )
                                }
                              />
                              <span className="truncate">{printer.name}</span>
                            </label>
                          ))}
                      </div>
                    </details>
                  ) : null}
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
        Assign categories to <span className="font-medium text-slate-700 dark:text-slate-300">Pakistani</span>,{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">Fast Food</span>, or{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">Outside</span> — those drive the{" "}
        <span className="font-medium text-slate-700 dark:text-slate-300">Kitchen Sale Report</span>.
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
  sections,
  systemPrinters,
  staffLabelById,
  notify,
  isStore = false,
}: {
  branchCode: string;
  routing: PrinterRoutingState;
  sections: PrinterSection[];
  systemPrinters: SystemPrinterInfo[];
  staffLabelById: Map<string, string>;
  notify: (message: string) => void;
  isStore?: boolean;
}): JSX.Element {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PrinterType>(isStore ? "receipt" : "kitchen");
  const [newSectionId, setNewSectionId] = useState(
    () => sections.find((s) => s.enabled)?.id ?? (isStore ? "receipt" : "kitchen"),
  );
  const [newOsPrinter, setNewOsPrinter] = useState("");
  const addTypeOptions = printerTypesForSystem(isStore);

  const usableOsPrinters = useMemo(
    () => systemPrinters.filter((p) => !p.isVirtual),
    [systemPrinters],
  );
  const virtualOsPrinters = useMemo(
    () => systemPrinters.filter((p) => p.isVirtual),
    [systemPrinters],
  );
  const allOsPrinters = useMemo(
    () => [...usableOsPrinters, ...virtualOsPrinters],
    [usableOsPrinters, virtualOsPrinters],
  );

  function handleAddProfile(): void {
    const name = newName.trim();
    if (!name) {
      notify("Enter a printer name first.");
      return;
    }
    try {
      const sec = sections.find((s) => s.id === newSectionId);
      const printerType = sec ? printerTypeForSection(sec) : newType;
      const profile = addPrinterProfile(branchCode, name, {
        printerType,
        systemPrinterName: newOsPrinter || undefined,
      });
      if (sec) {
        setSectionPrimaryPrinter(branchCode, sec.id, profile.id);
      }
      maybeSetDefaultPosPrinter(branchCode, profile.id, printerType, sec?.id);
      setNewName("");
      setNewOsPrinter("");
      notify(
        profile.systemPrinterName
          ? `Printer “${profile.name}” added (${sec?.name ?? printerType}) → ${profile.systemPrinterName}.`
          : `Printer “${profile.name}” added${sec ? ` as ${sec.name}` : ""}. Link any Windows printer for Auto print.`,
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add printer profile.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {isStore ? "Default POS receipt printer" : "Default receipt printer"}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {isStore
            ? "Used when you tap Print / Pay on Point of Sale. Branch: "
            : "Used for POS Pay / Invoice / split bills. Branch: "}
          <span className="font-mono text-slate-300">{branchCode}</span>
        </p>
        <select
          className="mt-3 w-full max-w-md rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
          value={routing.receiptPrinterId ?? ""}
          onChange={(e) => setReceiptPrinter(branchCode, e.target.value || null)}
        >
          <option value="">
            {isStore
              ? "Auto — first online OS-linked Receipt / Counter printer"
              : "Auto — first online OS-linked Receipt printer"}
          </option>
          {routing.printers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.systemPrinterName ? ` → ${p.systemPrinterName}` : ""} (
              {printerTypeLabel(p.printerType, isStore)})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">All printers</div>
        <p className="mt-1 text-xs text-slate-500">
          Add a name, pick a <span className="text-slate-300">section role</span> (Kitchen / Bar / Grill / … —
          same list as Sections), and link any Windows printer — USB, network,{" "}
          <span className="text-slate-300">Microsoft Print to PDF</span>, XPS, and more. Auto POS print uses the
          linked device; if silent print fails, the Windows dialog opens (same as manual).
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
            value={newSectionId}
            onChange={(e) => {
              const sectionId = e.target.value;
              setNewSectionId(sectionId);
              const sec = sections.find((s) => s.id === sectionId);
              if (sec) setNewType(printerTypeForSection(sec));
            }}
          >
            {(sections.filter((s) => s.enabled).length
              ? sections.filter((s) => s.enabled)
              : []
            ).map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
            {sections.filter((s) => s.enabled).length === 0
              ? addTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {printerTypeLabel(type, isStore)}
                  </option>
                ))
              : null}
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
              <optgroup label="PDF / XPS / virtual — OK for Auto">
                {virtualOsPrinters.map((sp) => (
                  <option key={sp.name} value={sp.name}>
                    {sp.name}
                    {sp.isDefault ? " (default)" : ""}
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
        {allOsPrinters.length === 0 ? (
          <p className="mt-2 text-[11px] text-amber-300">
            No Windows printers found. Install a USB/network printer or use Print to PDF, then refresh. You can still
            add a profile name now and link the OS printer later.
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[56rem] text-left text-xs">
            <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-2">Printer name</th>
                <th className="px-2.5 py-2">Section / Role</th>
                <th className="px-2.5 py-2">OS printer</th>
                <th className="px-2.5 py-2">Counter</th>
                <th className="px-2.5 py-2">Assigned users</th>
                <th className="px-2.5 py-2">Branch</th>
                <th className="px-2.5 py-2">Status</th>
                <th className="px-2.5 py-2">Copies / Paper / Text</th>
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
                      {(() => {
                        const linked = listSectionsForPrinter(branchCode, printer.id, sections);
                        const primaryId = linked.find((s) => s.primary)?.id ?? "";
                        return (
                          <select
                            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                            value={primaryId}
                            onChange={(e) => {
                              const sectionId = e.target.value;
                              if (!sectionId) return;
                              setSectionPrimaryPrinter(branchCode, sectionId, printer.id);
                              const sec = sections.find((s) => s.id === sectionId);
                              if (sec) {
                                maybeSetDefaultPosPrinter(
                                  branchCode,
                                  printer.id,
                                  printerTypeForSection(sec),
                                  sec.id,
                                );
                              }
                            }}
                          >
                            <option value="">
                              {primaryId ? "Change section…" : "No section yet"}
                            </option>
                            {sections
                              .filter((s) => s.enabled)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.icon} {s.name}
                                </option>
                              ))}
                          </select>
                        );
                      })()}
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
                            if (e.target.value) {
                              maybeSetDefaultPosPrinter(
                                branchCode,
                                printer.id,
                                printer.printerType,
                              );
                            }
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
                        {virtualOsPrinters.length > 0 ? (
                          <optgroup label="PDF / XPS / virtual">
                            {virtualOsPrinters.map((sp) => (
                              <option key={sp.name} value={sp.name}>
                                {sp.name}
                                {sp.isDefault ? " (default)" : ""}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {printer.systemPrinterName &&
                        !allOsPrinters.some((sp) => sp.name === printer.systemPrinterName) ? (
                          <option value={printer.systemPrinterName}>
                            {printer.systemPrinterName} (saved)
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
                        staffLabelById={staffLabelById}
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
                          onChange={(e) => {
                            const paperSize = e.target.value as PrinterPaperSize;
                            updatePrinterProfile(branchCode, printer.id, { paperSize });
                            if (printer.printerType === "receipt" || paperSize === "custom") {
                              saveThermalPrintSettings(branchCode, { defaultPaperSize: paperSize });
                            }
                          }}
                          className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                          title="Thermal paper width"
                        >
                          <option value="58mm">58mm roll</option>
                          <option value="80mm">80mm roll</option>
                          <option value="100mm">100mm roll</option>
                          <option value="custom">Custom (branch mm)</option>
                          <option value="A4">A4</option>
                        </select>
                        {printer.paperSize === "custom" ? (
                          <input
                            type="number"
                            min={48}
                            max={120}
                            title="Custom roll width (mm)"
                            className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                            defaultValue={loadThermalPrintSettings(branchCode).customPaperWidthMm}
                            onBlur={(e) => {
                              const mm = clampCustomPaperWidthMm(Number(e.target.value));
                              e.target.value = String(mm);
                              saveThermalPrintSettings(branchCode, {
                                defaultPaperSize: "custom",
                                customPaperWidthMm: mm,
                              });
                              updatePrinterProfile(branchCode, printer.id, { paperSize: "custom" });
                            }}
                          />
                        ) : null}
                        <select
                          value={printer.textScale ?? "M"}
                          onChange={(e) =>
                            updatePrinterProfile(branchCode, printer.id, {
                              textScale: e.target.value as PrinterTextScale,
                            })
                          }
                          className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                          title="Slip text size"
                        >
                          {(Object.keys(PRINTER_TEXT_SCALE_LABELS) as PrinterTextScale[]).map((s) => (
                            <option key={s} value={s}>
                              Text {PRINTER_TEXT_SCALE_LABELS[s]}
                            </option>
                          ))}
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
  staffLabelById,
}: {
  branchCode: string;
  printer: PrinterProfile;
  staffLabelById: Map<string, string>;
}): JSX.Element {
  const assignedIds = getUserIdsForPrinter(branchCode, printer.id);
  const labels = assignedIds.map((id) => staffLabelById.get(id) ?? id);

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
  isStore = false,
}: {
  branchCode: string;
  routing: PrinterRoutingState;
  users: { id: string; email: string; role: string }[];
  notify: (message: string) => void;
  isStore?: boolean;
}): JSX.Element {
  const [filterUser, setFilterUser] = useState("");
  const [filterCounter, setFilterCounter] = useState("");
  const [filterType, setFilterType] = useState<PrinterType | "">("");
  const [filterPrinter, setFilterPrinter] = useState("");
  const [search, setSearch] = useState("");
  const [sections, setSections] = useState(() => loadPrinterSections(branchCode));
  const counters = listAssignedCounters(branchCode);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const typeOptions = printerTypesForSystem(isStore);
  const quickAssignTypes: PrinterType[] = isStore
    ? ["receipt", "counter", "warehouse"]
    : ["kitchen", "bar", "receipt"];

  useEffect(() => {
    const reload = () => setSections(loadPrinterSections(branchCode));
    reload();
    window.addEventListener(PRINTER_SECTIONS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(PRINTER_SECTIONS_CHANGED_EVENT, reload);
  }, [branchCode]);

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
        ? `Assigned all ${printerTypeLabel(type, isStore)} printers to user.`
        : `Removed all ${printerTypeLabel(type, isStore)} printers from user.`,
    );
  }

  function sectionBadgesForPrinter(printerId: string): JSX.Element {
    const linked = listSectionsForPrinter(branchCode, printerId, sections);
    if (linked.length === 0) {
      return <span className="text-[10px] text-slate-600">No section yet</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {linked.map((s) => (
          <span
            key={s.id}
            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
              s.primary
                ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40"
                : "bg-slate-800 text-slate-300"
            }`}
            title={s.primary ? `${s.name} (primary)` : `${s.name} (backup)`}
          >
            {s.icon ? `${s.icon} ` : ""}
            {s.name}
            {s.primary ? " · Primary" : ""}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {isStore
            ? "Assign printers to cashiers / staff"
            : "Assign printers to users / waiters / riders"}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Assign printers to a user, set roll + text size on the printer, and mark which{" "}
          <span className="text-slate-300">section</span> that printer is primary for (Kitchen,
          Bar…). PDF printers also show their section. Branch:{" "}
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
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {printerTypeLabel(type, isStore)}
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
                  {p.name} ({printerTypeLabel(p.printerType, isStore)})
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
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {isStore ? "Staff → Assigned printers" : "User → Assigned printers"}
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[48rem] text-left text-xs">
            <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-2">{isStore ? "User / Cashier" : "User / Waiter"}</th>
                <th className="px-2.5 py-2">Role</th>
                <th className="px-2.5 py-2">Assigned printers · section</th>
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
                      <td className="px-2.5 py-2">
                        <div className="font-medium text-slate-200">{u.email}</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {u.email.includes("@") ? u.email.split("@")[0] : u.email}
                        </div>
                      </td>
                      <td className="px-2.5 py-2">
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        {filteredPrinters.length === 0 ? (
                          <span className="text-slate-600">No printers match filters</span>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {filteredPrinters.map((p) => {
                              const on = assignedIds.has(p.id);
                              const linked = listSectionsForPrinter(branchCode, p.id, sections);
                              const primarySec = linked.find((s) => s.primary);
                              return (
                                <div
                                  key={p.id}
                                  className={`rounded-lg border px-2 py-1.5 ${
                                    on
                                      ? "border-amber-500/40 bg-amber-500/10"
                                      : "border-slate-800 bg-slate-950/50"
                                  }`}
                                >
                                  <label className="flex cursor-pointer items-start gap-2">
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 accent-amber-500"
                                      checked={on}
                                      onChange={(e) => {
                                        toggleUserPrinter(branchCode, u.id, p.id, e.target.checked);
                                        if (
                                          e.target.checked &&
                                          (p.printerType === "receipt" || p.printerType === "counter")
                                        ) {
                                          maybeSetDefaultPosPrinter(branchCode, p.id, p.printerType);
                                        }
                                        notify(
                                          e.target.checked
                                            ? `Assigned ${p.name} → ${u.email}`
                                            : `Removed ${p.name} from ${u.email}`,
                                        );
                                      }}
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-[11px] font-medium text-slate-100">
                                        {p.name}
                                        {p.systemPrinterName ? (
                                          <span className="ml-1 text-[10px] text-sky-400">
                                            → {p.systemPrinterName}
                                          </span>
                                        ) : null}
                                      </span>
                                      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                                        <span>
                                          Role{" "}
                                          {primarySec
                                            ? `${primarySec.icon ? `${primarySec.icon} ` : ""}${primarySec.name}`
                                            : printerTypeLabel(p.printerType, isStore)}
                                        </span>
                                        <span>·</span>
                                        <span>
                                          Text {PRINTER_TEXT_SCALE_LABELS[p.textScale ?? "M"]}
                                        </span>
                                        <span>·</span>
                                        <span>{p.paperSize} roll</span>
                                        {primarySec ? (
                                          <>
                                            <span>·</span>
                                            <span className="text-amber-300">Primary</span>
                                          </>
                                        ) : null}
                                      </span>
                                    </span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {assigned.length > 0 ? (
                          <p className="mt-1.5 text-[10px] text-slate-500">
                            {assigned.length} assigned for {u.email.split("@")[0]}:{" "}
                            {assigned
                              .map((p) => {
                                const sec = listSectionsForPrinter(branchCode, p.id, sections).find(
                                  (s) => s.primary,
                                );
                                return sec
                                  ? `${p.name} (${sec.name})`
                                  : `${p.name} (${printerTypeLabel(p.printerType, isStore)})`;
                              })
                              .join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-col gap-1">
                          {quickAssignTypes.map((type) => (
                            <button
                              key={type}
                              type="button"
                              className="text-left text-[10px] text-sky-400 hover:text-sky-300"
                              onClick={() => assignAllOfType(u.id, type, true)}
                            >
                              + All {printerTypeLabel(type, isStore)}
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
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          Printer → Users · Section · Text size
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Pick a section to make this printer its <span className="text-amber-300">Primary</span>.
          Change roll / text size here — applies when that printer prints.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[52rem] text-left text-xs">
            <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-2">Printer</th>
                <th className="px-2.5 py-2">Section / Role</th>
                <th className="px-2.5 py-2">Section (primary)</th>
                <th className="px-2.5 py-2">Roll · Text</th>
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
                    <tr key={p.id} className="align-top">
                      <td className="px-2.5 py-2 font-medium text-slate-200">
                        {p.name}
                        {p.systemPrinterName ? (
                          <div className="text-[10px] text-sky-400">
                            {/pdf|xps/i.test(p.systemPrinterName) ? "PDF/XPS · " : ""}
                            {p.systemPrinterName}
                          </div>
                        ) : null}
                        <div className="mt-1">{sectionBadgesForPrinter(p.id)}</div>
                      </td>
                      <td className="px-2.5 py-2">
                        {(() => {
                          const linked = listSectionsForPrinter(branchCode, p.id, sections);
                          const primaryId = linked.find((s) => s.primary)?.id ?? "";
                          return (
                            <select
                              className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                              value={primaryId}
                              onChange={(e) => {
                                const sectionId = e.target.value;
                                if (!sectionId) return;
                                setSectionPrimaryPrinter(branchCode, sectionId, p.id);
                                const sec = sections.find((s) => s.id === sectionId);
                                if (sec) {
                                  maybeSetDefaultPosPrinter(
                                    branchCode,
                                    p.id,
                                    printerTypeForSection(sec),
                                    sec.id,
                                  );
                                }
                                notify(
                                  `Role → ${sec?.icon ? `${sec.icon} ` : ""}${sec?.name ?? sectionId}`,
                                );
                              }}
                            >
                              <option value="">
                                {primaryId ? "Change section…" : "No section yet"}
                              </option>
                              {sections
                                .filter((s) => s.enabled)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.icon} {s.name}
                                  </option>
                                ))}
                            </select>
                          );
                        })()}
                      </td>
                      <td className="px-2.5 py-2">
                        <select
                          className="w-full max-w-[12rem] rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                          value=""
                          onChange={(e) => {
                            const sectionId = e.target.value;
                            if (!sectionId) return;
                            setSectionPrimaryPrinter(branchCode, sectionId, p.id);
                            const sec = sections.find((s) => s.id === sectionId);
                            notify(
                              `${p.name} is now Primary for ${sec?.name ?? sectionId}.`,
                            );
                          }}
                        >
                          <option value="">Set primary for section…</option>
                          {sections
                            .filter((s) => s.enabled)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.icon} {s.name}
                              </option>
                            ))}
                        </select>
                        <div className="mt-1.5">{sectionBadgesForPrinter(p.id)}</div>
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-col gap-1">
                          <select
                            value={p.paperSize}
                            onChange={(e) => {
                              const paperSize = e.target.value as PrinterPaperSize;
                              updatePrinterProfile(branchCode, p.id, { paperSize });
                              if (p.printerType === "receipt" || paperSize === "custom") {
                                saveThermalPrintSettings(branchCode, { defaultPaperSize: paperSize });
                              }
                            }}
                            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                          >
                            <option value="58mm">58mm roll</option>
                            <option value="80mm">80mm roll</option>
                            <option value="100mm">100mm roll</option>
                            <option value="custom">Custom</option>
                            <option value="A4">A4</option>
                          </select>
                          {p.paperSize === "custom" ? (
                            <input
                              type="number"
                              min={48}
                              max={120}
                              title="Custom roll width (mm)"
                              className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                              defaultValue={loadThermalPrintSettings(branchCode).customPaperWidthMm}
                              onBlur={(e) => {
                                const mm = clampCustomPaperWidthMm(Number(e.target.value));
                                e.target.value = String(mm);
                                saveThermalPrintSettings(branchCode, {
                                  defaultPaperSize: "custom",
                                  customPaperWidthMm: mm,
                                });
                                updatePrinterProfile(branchCode, p.id, { paperSize: "custom" });
                              }}
                            />
                          ) : null}
                          <select
                            value={p.textScale ?? "M"}
                            onChange={(e) =>
                              updatePrinterProfile(branchCode, p.id, {
                                textScale: e.target.value as PrinterTextScale,
                              })
                            }
                            className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                          >
                            {(Object.keys(PRINTER_TEXT_SCALE_LABELS) as PrinterTextScale[]).map(
                              (s) => (
                                <option key={s} value={s}>
                                  Text {PRINTER_TEXT_SCALE_LABELS[s]}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      </td>
                      <td className="px-2.5 py-2">
                        {userIds.length === 0 ? (
                          <span className="text-slate-600">No users yet</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {userIds.map((id) => {
                              const u = userById.get(id);
                              return (
                                <span
                                  key={id}
                                  className="inline-flex flex-col rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-slate-200"
                                >
                                  <span className="font-medium">
                                    {u?.email?.split("@")[0] ?? id.slice(0, 8)}
                                  </span>
                                  <span className="text-slate-400">{u?.role ?? "—"}</span>
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
  const [liveQueue, setLiveQueue] = useState<
    Array<{ id: string; status: string; printerName?: string | null; orderId?: string | null; error?: string | null }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const { listBranchPrintQueue } = await import("../../lib/branchPrintClient");
        const rows = await listBranchPrintQueue(branchCode);
        if (!cancelled) {
          setLiveQueue(
            rows.map((r) => ({
              id: r.id,
              status: r.status,
              printerName: r.printerName,
              orderId: r.orderId,
              error: r.error,
            })),
          );
        }
      } catch {
        if (!cancelled) setLiveQueue([]);
      }
    }
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [branchCode]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Live branch queue</div>
        <p className="mt-1 text-xs text-slate-500">
          Jobs held by the Branch Print Server (SQLite). Use the Enterprise tab for retry / pause controls.
        </p>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900/90 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2.5 py-2">Status</th>
                <th className="px-2.5 py-2">Printer</th>
                <th className="px-2.5 py-2">Order</th>
                <th className="px-2.5 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {liveQueue.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2.5 py-4 text-center text-slate-500">
                    No live queue jobs.
                  </td>
                </tr>
              ) : (
                liveQueue.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2.5 py-2 text-slate-300">{row.status}</td>
                    <td className="px-2.5 py-2 text-slate-300">{row.printerName ?? "—"}</td>
                    <td className="px-2.5 py-2 text-slate-300">{row.orderId ?? "—"}</td>
                    <td className="px-2.5 py-2 text-red-300">{row.error ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Print history</div>
          <p className="mt-1 text-xs text-slate-500">
            Audit log of every print attempt for this branch (queue + direct fallback).
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
    </div>
  );
}

function PrinterManagement({ branchCode }: { branchCode: string }): JSX.Element {
  const systemId = useActiveSystemId();
  const isStore = systemId === "general-store";
  const sectionPreset: PrinterSectionPreset = isStore ? "general-store" : "restaurant";
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [routingSub, setRoutingSub] = useState<RoutingSub>("staff");
  const [customizeSub, setCustomizeSub] = useState<"receipt" | "kot" | "paper">("receipt");
  const [notice, setNotice] = useState<string | null>(null);
  const { sections, routing } = usePrinterConfig(branchCode, sectionPreset);

  // Remap leftover Kitchen/Bar profile types to store roles once per branch.
  useEffect(() => {
    if (!isStore) return;
    const state = loadPrinterRouting(branchCode);
    for (const p of state.printers) {
      if (p.printerType === "kitchen") {
        updatePrinterProfile(branchCode, p.id, { printerType: "other" });
      } else if (p.printerType === "bar") {
        updatePrinterProfile(branchCode, p.id, { printerType: "counter" });
      }
    }
  }, [isStore, branchCode]);

  const systemPrintersQuery = useQuery({
    queryKey: ["system-printers"],
    queryFn: listSystemPrintersDetailed,
    refetchInterval: 15_000,
  });
  const systemPrinters = systemPrintersQuery.data?.usable ?? [];
  const allSystemPrinters = systemPrintersQuery.data?.printers ?? [];
  const systemPrintersError = systemPrintersQuery.data?.error ?? null;
  const browserPrinterMode = systemPrintersQuery.data?.browserMode === true;

  const menuQuery = useQuery({
    queryKey: ["menu", "admin", branchCode, "printer-management"],
    enabled: !isStore,
    queryFn: () => fetchBranchMenuAdmin(branchCode),
  });

  const storeCategoriesQuery = useQuery({
    queryKey: ["store", "categories", branchCode, "printer-management"],
    enabled: isStore,
    queryFn: () => fetchStoreCategories(branchCode),
  });
  const storeProductsQuery = useQuery({
    queryKey: ["store", "products", branchCode, "printer-management"],
    enabled: isStore,
    queryFn: () => fetchStoreProducts(branchCode),
  });

  const categories = useMemo(() => {
    if (isStore) {
      return (storeCategoriesQuery.data ?? []).map((c) => ({ id: c.id, name: c.name }));
    }
    return menuQuery.data?.categories ?? [];
  }, [isStore, storeCategoriesQuery.data, menuQuery.data?.categories]);

  const items = useMemo(() => {
    if (isStore) {
      return (storeProductsQuery.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId ?? "",
      }));
    }
    return menuQuery.data?.items ?? [];
  }, [isStore, storeProductsQuery.data, menuQuery.data?.items]);

  const assignableQuery = useQuery({
    queryKey: ["assignable-staff", branchCode, "printer-management"],
    queryFn: () => fetchAssignableStaff(branchCode),
  });

  const usersQuery = useQuery({
    queryKey: ["org-users", "printer-management"],
    queryFn: () => fetchOrgUsers(),
    retry: false,
  });
  const users = usersQuery.data ?? [];

  const assignablePeople = useMemo((): AssignablePerson[] => {
    const staff = assignableQuery.data ?? [];
    const fromStaff = staff.map((person) => ({
      id: person.id,
      label: person.name || person.email,
      role: person.role,
      kind: person.role.toLowerCase() === "waiter" ? ("waiter" as const) : ("user" as const),
    }));
    if (!isStore) return fromStaff;
    const seen = new Set(fromStaff.map((p) => p.id));
    const fromOrg = users
      .filter((u) => !seen.has(u.id))
      .map((u) => ({
        id: u.id,
        label: u.email,
        role: String(u.role ?? "staff"),
        kind: "user" as const,
      }));
    return [...fromOrg, ...fromStaff];
  }, [assignableQuery.data, isStore, users]);

  const staffLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const person of assignablePeople) map.set(person.id, person.label);
    for (const user of users) map.set(user.id, user.email);
    return map;
  }, [assignablePeople, users]);

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
            /could not|enter a|failed|invalid|import failed/i.test(notice)
              ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {notice}
        </p>
      ) : null}

      {browserPrinterMode ? (
        <div className="flex gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <IconPrinter className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
          <div>
            <div className="font-semibold text-sky-50">Browser mode</div>
            <p className="mt-1 text-xs leading-relaxed text-sky-100/85">
              PDF / XPS link kar sakte ho. Silent USB print aur Branch Server ke liye desktop{" "}
              <span className="font-medium text-white">.exe</span> use karo.
            </p>
          </div>
        </div>
      ) : null}

      <PrinterDashboardStats
        branchCode={branchCode}
        sections={sections}
        routing={routing}
        systemPrinters={systemPrinters}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50 p-1">
          {TABS.map((tab) => {
            const Icon = tab.Icon;
            const on = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  on ? "bg-amber-500 text-slate-950 shadow-sm" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        {activeTab !== "customize" ? (
          <Button
            type="button"
            variant="ghost"
            className="inline-flex items-center gap-1.5 text-xs text-amber-300"
            onClick={() => {
              setCustomizeSub("receipt");
              setActiveTab("customize");
            }}
          >
            <IconReceipt className="h-3.5 w-3.5" />
            Customize receipt
          </Button>
        ) : null}
      </div>

      {activeTab === "overview" ? (
        <EnterprisePrintDashboard
          branchCode={branchCode}
          branchName={branchCode}
          onCustomizeReceipt={() => {
            setCustomizeSub("receipt");
            setActiveTab("customize");
          }}
        />
      ) : null}
      {activeTab === "printers" ? (
        <div className="space-y-6">
          <PrinterSectionsTab
            branchCode={branchCode}
            sections={sections}
            routing={routing}
            systemPrinters={systemPrinters}
            allSystemPrinters={allSystemPrinters}
            systemPrintersLoading={systemPrintersQuery.isLoading || systemPrintersQuery.isFetching}
            systemPrintersError={systemPrintersError}
            onRefreshSystemPrinters={() => void systemPrintersQuery.refetch()}
            categories={categories}
            items={items}
            notify={notify}
            isStore={isStore}
          />
          <PrinterProfilesTab
            branchCode={branchCode}
            routing={routing}
            sections={sections}
            systemPrinters={allSystemPrinters.length > 0 ? allSystemPrinters : systemPrinters}
            staffLabelById={staffLabelById}
            notify={notify}
            isStore={isStore}
          />
        </div>
      ) : null}
      {activeTab === "routing" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/40 p-1">
            {ROUTING_SUBS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setRoutingSub(id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  routingSub === id
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          {routingSub === "staff" ? (
            <PrinterAssignmentTab
              branchCode={branchCode}
              routing={routing}
              users={users.map((u) => ({
                id: u.id,
                email: u.email,
                role: u.role,
              }))}
              notify={notify}
              isStore={isStore}
            />
          ) : null}
          {routingSub === "sections" ? (
            <PrinterBySectionPanel
              branchCode={branchCode}
              sections={sections}
              routing={routing}
              people={assignablePeople}
              peopleLoading={assignableQuery.isLoading}
              peopleError={
                assignableQuery.isError
                  ? assignableQuery.error instanceof Error
                    ? assignableQuery.error.message
                    : "Could not load staff."
                  : null
              }
              notify={notify}
            />
          ) : null}
          {routingSub === "categories" ? (
            <PrinterCategoriesTab
              branchCode={branchCode}
              sections={sections}
              routing={routing}
              categories={categories}
            />
          ) : null}
          {routingSub === "items" ? (
            <PrinterItemsTab
              branchCode={branchCode}
              sections={sections}
              routing={routing}
              categories={categories}
              items={items}
            />
          ) : null}
          {routingSub === "preview" ? (
            <PrinterRoutingPreviewTab
              sections={sections}
              routing={routing}
              categories={categories}
              items={items}
            />
          ) : null}
        </div>
      ) : null}
      {activeTab === "customize" ? (
        <PrintCustomizeHub
          branchCode={branchCode}
          notify={notify}
          initialSub={customizeSub}
        />
      ) : null}
      {activeTab === "activity" ? <PrintQueueTab branchCode={branchCode} /> : null}
    </div>
  );
}

export function PrinterPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const systemId = useActiveSystemId();
  const isStore = systemId === "general-store";
  const [notice, setNotice] = useState<string | null>(null);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const menuQuery = useQuery({
    queryKey: ["menu", branch?.code],
    enabled: Boolean(branch?.code) && !isStore,
    queryFn: () => fetchBranchMenuAdmin(branch!.code),
  });

  const storeCategoriesQuery = useQuery({
    queryKey: ["store", "categories", branch?.code, "printer-page"],
    enabled: Boolean(branch?.code) && isStore,
    queryFn: () => fetchStoreCategories(branch!.code),
  });
  const storeProductsQuery = useQuery({
    queryKey: ["store", "products", branch?.code, "printer-page"],
    enabled: Boolean(branch?.code) && isStore,
    queryFn: () => fetchStoreProducts(branch!.code),
  });

  const usersQuery = useQuery({
    queryKey: ["org-users"],
    queryFn: () => fetchOrgUsers(),
  });

  const printerMap = useMemo(
    () => loadPrinterAssignments(branch?.code),
    [branch?.code, notice],
  );

  if (!branch?.code) {
    return (
      <PageHeader
        title="Printer"
        subtitle={
          isStore
            ? "Select a General Store branch to configure receipt and counter printers."
            : "Select a branch to configure printer settings."
        }
      />
    );
  }

  const categories = isStore
    ? (storeCategoriesQuery.data ?? []).map((c) => ({ id: c.id, name: c.name }))
    : (menuQuery.data?.categories ?? []);
  const items = isStore
    ? (storeProductsQuery.data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        categoryId: p.categoryId ?? "",
      }))
    : (menuQuery.data?.items ?? []);
  const users = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Printer"
        subtitle={
          isStore
            ? `General Store printer setup for ${branch.name} (${branch.code}) — sections, profiles, routing, and receipt slips.`
            : `Printer configuration for ${branch.name} (${branch.code}) — sections, profiles, routing, and KOT template.`
        }
      />

      <PrinterManagement branchCode={branch.code} />

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {isStore ? "Receipt / slip customization" : "Kitchen ticket customization"}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {isStore
            ? "Design the slip shown on POS Order / Pay / Print. Click Save store slip template, then print from Point of Sale — layout and assigned printer apply automatically."
            : "Full kitchen receipt editor — same style as bill customization. Preview matches Auto print. Also available under Print Settings → step 4."}
        </p>
        <div className="mt-4">
          <KotCustomizationPanel
            branchName={branch.name}
            branchCode={branch.code}
            variant={isStore ? "store" : "restaurant"}
            onNotice={setNotice}
          />
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
