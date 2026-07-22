import { Button } from "@platform/ui";
import { useEffect, useMemo, useState } from "react";
import {
  addPrinterSection,
  deletePrinterSection,
  updatePrinterSection,
  type PrinterSection,
} from "../lib/printerSections";
import {
  getPrintersForSection,
  getUsersForSection,
  clearSectionRouting,
  movePrinterPriority,
  PRINTER_TYPE_LABELS,
  togglePrinterForSection,
  toggleUserForSection,
  toggleUserPrinter,
  type PrinterProfile,
  type PrinterRoutingState,
} from "../lib/printerRouting";

const SECTION_ICON_CHOICES = ["🍳", "🍸", "🧑‍🍳", "🔥", "🍰", "🥤", "🧾", "📦", "🛵", "☕", "🥖", "🖨️", "🍺"];
const SECTION_COLOR_CHOICES = [
  "#f59e0b",
  "#8b5cf6",
  "#38bdf8",
  "#ef4444",
  "#f472b6",
  "#22d3ee",
  "#a3e635",
  "#fb923c",
  "#34d399",
  "#94a3b8",
];

export type AssignablePerson = {
  id: string;
  label: string;
  role: string;
  kind: "user" | "waiter";
};

type Props = {
  branchCode: string;
  sections: PrinterSection[];
  routing: PrinterRoutingState;
  people: AssignablePerson[];
  notify: (message: string) => void;
};

function profileLine(p: PrinterProfile): string {
  const bits = [p.name, PRINTER_TYPE_LABELS[p.printerType]];
  if (p.systemPrinterName) bits.push(p.systemPrinterName);
  if (p.assignedCounter) bits.push(p.assignedCounter);
  return bits.join(" · ");
}

export function PrinterBySectionPanel({
  branchCode,
  sections,
  routing,
  people,
  notify,
}: Props): JSX.Element {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    () => sections.find((s) => s.enabled)?.id ?? sections[0]?.id ?? null,
  );
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🖨️");
  const [newColor, setNewColor] = useState("#94a3b8");
  const [editName, setEditName] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [printerSearch, setPrinterSearch] = useState("");

  const selected =
    sections.find((s) => s.id === selectedSectionId) ?? sections[0] ?? null;

  const sectionPrinters = useMemo(() => {
    if (!selected) return [];
    return getPrintersForSection(branchCode, selected.id);
  }, [branchCode, selected, routing]);

  const sectionUserIds = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(getUsersForSection(branchCode, selected.id));
  }, [branchCode, selected, routing]);

  const assignedPeople = people.filter((p) => sectionUserIds.has(p.id));
  const availablePeople = people.filter((p) => {
    if (sectionUserIds.has(p.id)) return false;
    const q = peopleSearch.trim().toLowerCase();
    if (!q) return true;
    return p.label.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
  });

  const availablePrinters = routing.printers.filter((p) => {
    if (sectionPrinters.some((sp) => sp.id === p.id)) return false;
    const q = printerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.systemPrinterName?.toLowerCase().includes(q) ?? false) ||
      PRINTER_TYPE_LABELS[p.printerType].toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (selected) setEditName(selected.name);
  }, [selected?.id, selected?.name]);

  function selectSection(section: PrinterSection): void {
    setSelectedSectionId(section.id);
    setEditName(section.name);
    setPeopleSearch("");
    setPrinterSearch("");
  }

  function startEdit(section: PrinterSection): void {
    setSelectedSectionId(section.id);
    setEditName(section.name);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Printer by Section</div>
        <p className="mt-1 text-xs text-slate-500">
          Create sections (Kitchen, Bar, Receipt, …), assign printers to each section, then assign users /
          waiters. Click a section to manage its printers and people.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block min-w-[10rem] flex-1 text-[10px] uppercase tracking-wide text-slate-500">
            New section name
            <input
              className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
              placeholder="e.g. Receipt, Patio Kitchen"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500">
            Icon
            <select
              className="mt-0.5 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
            >
              {SECTION_ICON_CHOICES.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500">
            Color
            <select
              className="mt-0.5 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
            >
              {SECTION_COLOR_CHOICES.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            className="text-xs"
            disabled={!newName.trim()}
            onClick={() => {
              const created = addPrinterSection(branchCode, {
                name: newName.trim(),
                icon: newIcon,
                color: newColor,
              });
              setNewName("");
              selectSection(created);
              notify(`Section “${created.name}” added.`);
            }}
          >
            Add section
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Section list */}
        <div className="space-y-2 lg:col-span-4">
          {sections.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-500">
              No sections yet. Add one above.
            </p>
          ) : (
            sections.map((section) => {
              const printerCount = (routing.sectionPrinters[section.id] ?? []).length;
              const userCount = (routing.sectionUsers[section.id] ?? []).length;
              const active = selected?.id === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => selectSection(section)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
                  } ${section.enabled ? "" : "opacity-60"}`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: `${section.color}22`, color: section.color }}
                  >
                    {section.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{section.name}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {printerCount} printer{printerCount === 1 ? "" : "s"} · {userCount} user
                      {userCount === 1 ? "" : "s"}
                      {!section.enabled ? " · disabled" : ""}
                    </span>
                  </span>
                  <span className="text-slate-500" aria-hidden>
                    ›
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Section detail */}
        <div className="lg:col-span-8">
          {!selected ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
              Select a section to manage its printers and users.
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                    style={{ backgroundColor: `${selected.color}22` }}
                  >
                    {selected.icon}
                  </span>
                  <div>
                    <div className="text-base font-semibold text-white">{selected.name}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">
                      {selected.isSystem ? "System section" : "Custom section"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white"
                    onClick={() => {
                      updatePrinterSection(branchCode, selected.id, { enabled: !selected.enabled });
                      notify(selected.enabled ? "Section disabled." : "Section enabled.");
                    }}
                  >
                    {selected.enabled ? "Disable" : "Enable"}
                  </button>
                  {!selected.isSystem ? (
                    <button
                      type="button"
                      className="rounded-md border border-red-500/40 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
                      onClick={() => {
                        if (!confirm(`Delete section “${selected.name}”?`)) return;
                        const name = selected.name;
                        clearSectionRouting(branchCode, selected.id);
                        deletePrinterSection(branchCode, selected.id);
                        setSelectedSectionId(null);
                        notify(`Section “${name}” deleted.`);
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                <label className="block min-w-[12rem] flex-1 text-[10px] uppercase tracking-wide text-slate-500">
                  Edit name
                  <input
                    className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                    value={editName || selected.name}
                    onChange={(e) => setEditName(e.target.value)}
                    onFocus={() => startEdit(selected)}
                  />
                </label>
                <label className="block text-[10px] uppercase tracking-wide text-slate-500">
                  Icon
                  <select
                    className="mt-0.5 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                    value={selected.icon}
                    onChange={(e) =>
                      updatePrinterSection(branchCode, selected.id, { icon: e.target.value })
                    }
                  >
                    {SECTION_ICON_CHOICES.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[10px] uppercase tracking-wide text-slate-500">
                  Color
                  <select
                    className="mt-0.5 block rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                    value={selected.color}
                    onChange={(e) =>
                      updatePrinterSection(branchCode, selected.id, { color: e.target.value })
                    }
                  >
                    {SECTION_COLOR_CHOICES.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  className="text-xs"
                  disabled={!editName.trim() || editName.trim() === selected.name}
                  onClick={() => {
                    updatePrinterSection(branchCode, selected.id, { name: editName.trim() });
                    notify("Section name updated.");
                  }}
                >
                  Save name
                </Button>
              </div>

              {/* Assigned printers */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Assigned printers</h3>
                  <span className="text-[10px] text-slate-500">
                    First printer is primary · use ↑ ↓ to reorder
                  </span>
                </div>
                {sectionPrinters.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-500">
                    No printers in this section yet. Add from the list below.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {sectionPrinters.map((printer, index) => (
                      <li
                        key={printer.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 text-xs text-slate-200">
                          {index === 0 ? (
                            <span className="mr-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              Primary
                            </span>
                          ) : (
                            <span className="mr-2 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                              Backup
                            </span>
                          )}
                          {profileLine(printer)}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 disabled:opacity-40"
                            disabled={index === 0}
                            onClick={() => movePrinterPriority(branchCode, selected.id, printer.id, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 disabled:opacity-40"
                            disabled={index === sectionPrinters.length - 1}
                            onClick={() => movePrinterPriority(branchCode, selected.id, printer.id, 1)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="rounded border border-red-500/30 px-2 py-0.5 text-[10px] text-red-300"
                            onClick={() => {
                              togglePrinterForSection(branchCode, selected.id, printer.id, false);
                              notify(`Removed ${printer.name} from ${selected.name}.`);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 rounded-lg border border-slate-800 p-3">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Add printer to this section
                  </div>
                  <input
                    className="mb-2 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                    placeholder="Search printers…"
                    value={printerSearch}
                    onChange={(e) => setPrinterSearch(e.target.value)}
                  />
                  {availablePrinters.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      {routing.printers.length === 0
                        ? "No printer profiles yet — add them under All Printers first."
                        : "All printers are already assigned, or none match your search."}
                    </p>
                  ) : (
                    <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
                      {availablePrinters.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="rounded-md border border-slate-800 px-2.5 py-1.5 text-left text-xs text-slate-300 hover:border-amber-500/40 hover:text-white"
                          onClick={() => {
                            togglePrinterForSection(branchCode, selected.id, p.id, true);
                            for (const userId of getUsersForSection(branchCode, selected.id)) {
                              toggleUserPrinter(branchCode, userId, p.id, true);
                            }
                            notify(`Added ${p.name} to ${selected.name}.`);
                          }}
                        >
                          + {profileLine(p)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Assigned users / waiters */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Assigned users / waiters</h3>
                  <span className="text-[10px] text-slate-500">
                    People here use this section’s printers
                  </span>
                </div>
                {assignedPeople.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-500">
                    No users assigned yet. Add cashiers or waiters below.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {assignedPeople.map((person) => (
                      <li
                        key={person.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-100">
                            {person.label}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {person.kind === "waiter" ? "Waiter" : person.role}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded border border-red-500/30 px-2 py-0.5 text-[10px] text-red-300"
                          onClick={() => {
                            toggleUserForSection(branchCode, selected.id, person.id, false);
                            notify(`Removed ${person.label} from ${selected.name}.`);
                          }}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 rounded-lg border border-slate-800 p-3">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Add user / waiter
                  </div>
                  <input
                    className="mb-2 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                    placeholder="Search by name or email…"
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                  />
                  {availablePeople.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      {people.length === 0
                        ? "No users or waiters found."
                        : "Everyone is already assigned, or none match your search."}
                    </p>
                  ) : (
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                      {availablePeople.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          className="rounded-md border border-slate-800 px-2.5 py-1.5 text-left text-xs text-slate-300 hover:border-amber-500/40 hover:text-white"
                          onClick={() => {
                            toggleUserForSection(branchCode, selected.id, person.id, true);
                            notify(`Assigned ${person.label} to ${selected.name}.`);
                          }}
                        >
                          + {person.label}
                          <span className="ml-2 text-[10px] text-slate-500">
                            {person.kind === "waiter" ? "Waiter" : person.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
