import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
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
  importPrinterConfig,
  loadPrinterRouting,
  movePrinterPriority,
  PRINTER_ROUTING_CHANGED_EVENT,
  setCategorySections,
  setItemSections,
  togglePrinterForSection,
  updatePrinterProfile,
  type PrinterPaperSize,
  type PrinterRoutingState,
} from "../../lib/printerRouting";
import { listSystemPrinters, type SystemPrinterInfo } from "../../lib/systemPrinters";
import {
  clearPrintHistory,
  loadPrintHistory,
  logPrintEvent,
  PRINT_HISTORY_CHANGED_EVENT,
  todaysPrintCount,
} from "../../lib/printHistory";
import { printTestPage } from "../../lib/printTicket";
import { fetchBranchMenuAdmin } from "../../api/menu";
import { fetchOrgUsers } from "../../api/users";
import { PageHeader } from "../../ui/PageHeader";

const SECTION_ICON_CHOICES = ["🍳", "🍸", "🧑‍🍳", "🔥", "🍰", "🥤", "🧾", "📦", "🛵", "☕", "🥖", "🖨️"];
const SECTION_COLOR_CHOICES = [
  "#f59e0b", "#8b5cf6", "#38bdf8", "#ef4444", "#f472b6",
  "#22d3ee", "#a3e635", "#fb923c", "#34d399", "#94a3b8",
];
const PAPER_SIZES: PrinterPaperSize[] = ["58mm", "80mm", "A4"];

const TABS = [
  { id: "sections", label: "Sections" },
  { id: "categories", label: "Categories" },
  { id: "items", label: "Items" },
  { id: "profiles", label: "Printer Profiles" },
  { id: "users", label: "Users" },
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

function PrinterSectionsTab({
  branchCode,
  sections,
  routing,
  systemPrinters,
  systemPrintersLoading,
  onRefreshSystemPrinters,
  categories,
  items,
  notify,
}: {
  branchCode: string;
  sections: PrinterSection[];
  routing: PrinterRoutingState;
  systemPrinters: SystemPrinterInfo[];
  systemPrintersLoading: boolean;
  onRefreshSystemPrinters: () => void;
  categories: { id: string; name: string }[];
  items: { id: string; name: string; categoryId: string }[];
  notify: (message: string) => void;
}): JSX.Element {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [sectionSearch, setSectionSearch] = useState("");
  const [printerSearch, setPrinterSearch] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionIcon, setNewSectionIcon] = useState(SECTION_ICON_CHOICES[0]);
  const [newSectionColor, setNewSectionColor] = useState(SECTION_COLOR_CHOICES[0]);
  const [newPrinterName, setNewPrinterName] = useState("");

  useEffect(() => {
    if (!selectedSectionId && sections.length > 0) setSelectedSectionId(sections[0].id);
  }, [sections, selectedSectionId]);

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;

  const filteredSections = sections.filter((s) =>
    s.name.toLowerCase().includes(sectionSearch.trim().toLowerCase()),
  );
  const filteredPrinters = routing.printers.filter((p) =>
    p.name.toLowerCase().includes(printerSearch.trim().toLowerCase()),
  );

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
      notify("Select a section first, then Assign.");
      return;
    }
    let profile = routing.printers.find((p) => p.systemPrinterName === printer.name);
    if (!profile) {
      profile = addPrinterProfile(branchCode, printer.name, { systemPrinterName: printer.name });
    }
    togglePrinterForSection(branchCode, selectedSection.id, profile.id, true);
    notify(`${printer.name} assigned to ${selectedSection.name}.`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">System printers</div>
          <div className="flex items-center gap-2">
            {systemPrintersLoading ? <span className="text-[10px] text-slate-500">Scanning…</span> : null}
            <Button type="button" variant="ghost" className="text-xs" onClick={onRefreshSystemPrinters}>
              Refresh
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Detected from this computer's OS print spooler. Select a section below, then Assign a printer to it.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {systemPrinters.length === 0 ? (
            <p className="text-xs text-slate-500">
              {systemPrintersLoading ? "Scanning for printers…" : "No printers detected on this system."}
            </p>
          ) : (
            systemPrinters.map((printer) => (
              <div key={printer.name} className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-slate-200">{printer.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot(printer.state)}`} aria-hidden />
                      {statusLabel(printer.state)}
                      <span>·</span>
                      {printer.connectionType}
                      {printer.isDefault ? (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-300">Default</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 text-[10px]">
                  <button
                    type="button"
                    className="text-amber-400 hover:text-amber-300"
                    onClick={() => {
                      const ok = printTestPage(printer.name);
                      logPrintEvent(branchCode, { kind: "test", printerName: printer.name, ok });
                      notify(ok ? `Test print sent to ${printer.name}.` : "Could not open the print dialog.");
                    }}
                  >
                    Test print
                  </button>
                  <button
                    type="button"
                    className="text-sky-400 hover:text-sky-300"
                    onClick={() => assignSystemPrinter(printer)}
                  >
                    Assign to {selectedSection?.name ?? "…"}
                  </button>
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
            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
                placeholder="Search printers…"
                value={printerSearch}
                onChange={(e) => setPrinterSearch(e.target.value)}
              />
            </div>

            <div className="mt-2 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
                placeholder="Add printer profile manually"
                value={newPrinterName}
                onChange={(e) => setNewPrinterName(e.target.value)}
              />
              <Button
                type="button"
                className="shrink-0 text-xs"
                disabled={!newPrinterName.trim()}
                onClick={() => {
                  const created = addPrinterProfile(branchCode, newPrinterName.trim());
                  setNewPrinterName("");
                  notify(`Printer "${created.name}" added.`);
                }}
              >
                Add printer
              </Button>
            </div>

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
                        No printer profiles yet. Add one above or Assign a detected system printer.
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
                              const ok = printTestPage(printer.name);
                              logPrintEvent(branchCode, { kind: "test", printerName: printer.name, ok });
                              notify(ok ? `Test print sent to ${printer.name}.` : "Could not open the print dialog.");
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
  notify,
}: {
  branchCode: string;
  routing: PrinterRoutingState;
  notify: (message: string) => void;
}): JSX.Element {
  const [newName, setNewName] = useState("");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">Printer profiles</div>
      <p className="mt-1 text-xs text-slate-500">
        Reusable print settings — copies, paper size, auto-cut — that sections, categories, items, and users
        select instead of retyping a printer name.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 max-w-xs rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
          placeholder="New printer profile name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button
          type="button"
          className="shrink-0 text-xs"
          disabled={!newName.trim()}
          onClick={() => {
            addPrinterProfile(branchCode, newName.trim());
            setNewName("");
          }}
        >
          Add profile
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {routing.printers.length === 0 ? (
          <p className="text-xs text-slate-500">No printer profiles yet.</p>
        ) : (
          routing.printers.map((printer) => (
            <div key={printer.id} className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-medium text-white outline-none focus:border-amber-500/50"
                value={printer.name}
                onChange={(e) => updatePrinterProfile(branchCode, printer.id, { name: e.target.value })}
              />
              {printer.systemPrinterName ? (
                <p className="text-[10px] text-sky-400">Linked to OS printer: {printer.systemPrinterName}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <label className="block">
                  Copies
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
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                  />
                </label>
                <label className="block">
                  Paper size
                  <select
                    value={printer.paperSize}
                    onChange={(e) =>
                      updatePrinterProfile(branchCode, printer.id, {
                        paperSize: e.target.value as PrinterPaperSize,
                      })
                    }
                    className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-white"
                  >
                    {PAPER_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={printer.autoCut}
                  onChange={(e) => updatePrinterProfile(branchCode, printer.id, { autoCut: e.target.checked })}
                />
                Auto cut after each ticket
              </label>
              <div className="flex justify-between text-[10px]">
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PrinterUsersTab({
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
  const [search, setSearch] = useState("");
  const [bulkPrinter, setBulkPrinter] = useState("");
  // Not memoized on purpose: this is a cheap localStorage read that must reflect the
  // latest assignment immediately — the parent's `notify` state update on each
  // selection already re-renders this component, which re-reads fresh here.
  const printerMap = loadPrinterAssignments(branchCode);
  const printerOptions = [...new Set([...routing.printers.map((p) => p.name), ...PRINTER_PRESETS])];
  const filtered = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.trim().toLowerCase()) ||
      u.role.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">User printer assignment</div>
      <p className="mt-1 text-xs text-slate-500">
        Route a user's prints to a specific printer profile — used when no category/item routing applies.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="min-w-0 flex-1 max-w-xs rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500/50"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
          value={bulkPrinter}
          onChange={(e) => setBulkPrinter(e.target.value)}
        >
          <option value="">Bulk assign printer…</option>
          {printerOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="ghost"
          className="text-xs"
          disabled={!bulkPrinter}
          onClick={() => {
            for (const u of filtered) setUserPrinter(branchCode, u.id, bulkPrinter);
            notify(`Assigned "${bulkPrinter}" to ${filtered.length} user(s).`);
          }}
        >
          Apply to filtered
        </Button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2.5 py-2">User</th>
              <th className="px-2.5 py-2">Role</th>
              <th className="px-2.5 py-2">Printer profile</th>
              <th className="px-2.5 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2.5 py-4 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const current = printerMap.byUser[u.id]?.printerName ?? "";
                return (
                  <tr key={u.id}>
                    <td className="px-2.5 py-2 text-slate-200">{u.email}</td>
                    <td className="px-2.5 py-2 text-slate-400">{u.role}</td>
                    <td className="px-2.5 py-2">
                      <select
                        className="w-full max-w-[12rem] rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        value={current}
                        onChange={(e) => {
                          setUserPrinter(branchCode, u.id, e.target.value);
                          notify(`Printer updated for ${u.email}.`);
                        }}
                      >
                        <option value="">Default</option>
                        {printerOptions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      {current ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                          Assigned
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-400">
                          Default
                        </span>
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
  const [activeTab, setActiveTab] = useState<TabId>("sections");
  const [notice, setNotice] = useState<string | null>(null);
  const { sections, routing } = usePrinterConfig(branchCode);

  const systemPrintersQuery = useQuery({
    queryKey: ["system-printers"],
    queryFn: listSystemPrinters,
    refetchInterval: 15_000,
  });
  const systemPrinters = systemPrintersQuery.data ?? [];

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
              let sent = 0;
              for (const p of systemPrinters) {
                const ok = printTestPage(p.name);
                logPrintEvent(branchCode, { kind: "test", printerName: p.name, ok });
                if (ok) sent += 1;
              }
              notify(`Test print sent to ${sent} of ${systemPrinters.length} printers.`);
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
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
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

      {activeTab === "sections" ? (
        <PrinterSectionsTab
          branchCode={branchCode}
          sections={sections}
          routing={routing}
          systemPrinters={systemPrinters}
          systemPrintersLoading={systemPrintersQuery.isFetching}
          onRefreshSystemPrinters={() => void systemPrintersQuery.refetch()}
          categories={categories}
          items={items}
          notify={notify}
        />
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
      {activeTab === "profiles" ? (
        <PrinterProfilesTab branchCode={branchCode} routing={routing} notify={notify} />
      ) : null}
      {activeTab === "users" ? (
        <PrinterUsersTab branchCode={branchCode} routing={routing} users={users} notify={notify} />
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
            Base font size (px)
            <input
              type="number"
              min={9}
              max={14}
              value={kotDraft.baseFontSize}
              onChange={(e) =>
                setKotDraft((p) => ({ ...p, baseFontSize: Number(e.target.value) || 11 }))
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

      <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Printer assignment (legacy)</div>
        <p className="mt-1 text-xs text-slate-500">
          Original single-printer-name assignment by user, category, or item. The Sections/Categories/Items/Users
          tabs above are the newer, richer way to route prints — this panel still works independently.
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
    </div>
  );
}
