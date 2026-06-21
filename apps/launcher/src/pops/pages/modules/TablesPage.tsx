import { Button } from "@platform/ui";
import type { RestaurantTable, SeatingSection } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../../stores/sessionStore";
import { usePopsStore } from "../../../stores/popsStore";
import {
  createRestaurantTable,
  createSeatingSection,
  deleteRestaurantTable,
  deleteSeatingSection,
  fetchBranchFloorAdmin,
} from "../../api/tables";
import { linkDangerClass } from "../../lib/themeClasses";
import { ModuleToolbar } from "../../ui/ModuleToolbar";
import { Badge } from "../../ui/Badge";
import { SimpleTable } from "../../ui/SimpleTable";

export function TablesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("*") ||
    claims?.permissions.includes("pops.menu.manage");

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [tableForm, setTableForm] = useState({ tableNumber: "", seats: "4" });
  const [error, setError] = useState<string | null>(null);

  const floorQuery = useQuery({
    queryKey: ["tables", "admin", branch?.code],
    enabled: Boolean(branch?.code && canManage),
    queryFn: () => fetchBranchFloorAdmin(branch!.code),
  });

  const sections = floorQuery.data?.sections ?? [];
  const allTables = floorQuery.data?.tables ?? [];

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === selectedSectionId) ?? sections[0] ?? null,
    [sections, selectedSectionId],
  );

  useEffect(() => {
    if (sections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(sections[0].id);
    }
  }, [sections, selectedSectionId]);

  const sectionTables = useMemo(
    () => allTables.filter((t) => t.sectionId === selectedSection?.id),
    [allTables, selectedSection?.id],
  );

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["tables"] });
  }

  const createSectionMutation = useMutation({
    mutationFn: (name: string) =>
      createSeatingSection({ branchCode: branch!.code, name, sortOrder: sections.length }),
    onSuccess: (section) => {
      invalidate();
      setNewSectionName("");
      setSelectedSectionId(section.id);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: (id: string) => deleteSeatingSection(id),
    onSuccess: () => {
      invalidate();
      setSelectedSectionId(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const createTableMutation = useMutation({
    mutationFn: () =>
      createRestaurantTable({
        branchCode: branch!.code,
        sectionId: selectedSection!.id,
        tableNumber: tableForm.tableNumber.trim(),
        seats: Number(tableForm.seats) || 4,
        sortOrder: sectionTables.length,
      }),
    onSuccess: () => {
      invalidate();
      setTableForm({ tableNumber: "", seats: "4" });
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteTableMutation = useMutation({
    mutationFn: (id: string) => deleteRestaurantTable(id),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!branch?.code) {
    return <p className="text-sm text-slate-500">Select a branch to manage tables.</p>;
  }

  if (!canManage) {
    return <p className="text-sm text-slate-500">You need menu management permission to configure tables.</p>;
  }

  return (
    <div className="space-y-3">
      <ModuleToolbar
        title="Tables"
        trailing={
          <Button type="button" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => void floorQuery.refetch()}>
            Refresh
          </Button>
        }
      />

      {floorQuery.isLoading ? <p className="text-xs text-slate-500">Loading…</p> : null}
      {floorQuery.isError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {(floorQuery.error as Error).message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 lg:col-span-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seating sections</div>
          <p className="mt-1 text-xs text-slate-600">Rooftop, outside, main hall, etc.</p>

          <div className="mt-3 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              placeholder="New section name…"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
            />
            <Button
              type="button"
              className="shrink-0 text-xs"
              disabled={!newSectionName.trim() || createSectionMutation.isPending}
              onClick={() => createSectionMutation.mutate(newSectionName.trim())}
            >
              Add
            </Button>
          </div>

          <ul className="mt-3 space-y-1">
            {sections.map((section: SeatingSection) => (
              <li key={section.id}>
                <button
                  type="button"
                  onClick={() => setSelectedSectionId(section.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition ${
                    selectedSection?.id === section.id
                      ? "bg-amber-500/15 text-white ring-1 ring-amber-500/30"
                      : "text-slate-400 hover:bg-slate-800/80"
                  }`}
                >
                  <span>{section.name}</span>
                  <span className="text-xs tabular-nums text-slate-500">
                    {allTables.filter((t) => t.sectionId === section.id).length}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selectedSection ? (
            <Button
              type="button"
              variant="ghost"
              className={`mt-3 w-full text-xs ${linkDangerClass}`}
              disabled={deleteSectionMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete section "${selectedSection.name}"?`)) {
                  deleteSectionMutation.mutate(selectedSection.id);
                }
              }}
            >
              Delete section
            </Button>
          ) : null}
        </div>

        <div className="lg:col-span-8">
          {selectedSection ? (
            <>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{selectedSection.name}</h2>
                  <p className="text-sm text-slate-500">{sectionTables.length} table(s) in this section</p>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add table</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                    placeholder="Table #"
                    value={tableForm.tableNumber}
                    onChange={(e) => setTableForm((f) => ({ ...f, tableNumber: e.target.value }))}
                  />
                  <input
                    type="number"
                    min={1}
                    max={24}
                    className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                    placeholder="Seats"
                    value={tableForm.seats}
                    onChange={(e) => setTableForm((f) => ({ ...f, seats: e.target.value }))}
                  />
                  <Button
                    type="button"
                    className="text-xs"
                    disabled={!tableForm.tableNumber.trim() || createTableMutation.isPending}
                    onClick={() => createTableMutation.mutate()}
                  >
                    {createTableMutation.isPending ? "Adding…" : "Add table"}
                  </Button>
                </div>
              </div>

              {sectionTables.length === 0 ? (
                <p className="text-sm text-slate-500">No tables in this section yet.</p>
              ) : (
                <SimpleTable
                  rowKey={(r) => r.id}
                  rows={sectionTables}
                  columns={[
                    {
                      key: "tableNumber",
                      header: "Table",
                      render: (r: RestaurantTable) => (
                        <span className="font-mono font-semibold text-amber-200/90">{r.tableNumber}</span>
                      ),
                    },
                    {
                      key: "seats",
                      header: "Seats",
                      render: (r: RestaurantTable) => `${r.seats} seats`,
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (r: RestaurantTable) => (
                        <Badge tone={r.isActive ? "success" : "neutral"}>
                          {r.isActive ? "Active" : "Hidden"}
                        </Badge>
                      ),
                    },
                    {
                      key: "actions",
                      header: "",
                      id: "actions",
                      render: (r: RestaurantTable) => (
                        <button
                          type="button"
                          className={`text-xs ${linkDangerClass}`}
                          onClick={() => {
                            if (window.confirm(`Remove table ${r.tableNumber}?`)) {
                              deleteTableMutation.mutate(r.id);
                            }
                          }}
                        >
                          Remove
                        </button>
                      ),
                    },
                  ]}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">Add a seating section to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}
