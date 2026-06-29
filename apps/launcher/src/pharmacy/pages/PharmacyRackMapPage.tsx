import { type Medicine } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchPharmacyMedicines } from "../api/pharmacy";
import { usePharmacyAccess } from "../hooks/usePharmacy";
import { PharmacyInput } from "../ui/PharmacyUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass } from "../../pops/lib/themeClasses";

type RackGroup = {
  aisle: string;
  racks: {
    rack: string;
    shelves: {
      shelf: string;
      medicines: Medicine[];
    }[];
  }[];
};

function buildRackMap(medicines: Medicine[]): RackGroup[] {
  const byAisle = new Map<string, Map<string, Map<string, Medicine[]>>>();

  for (const m of medicines) {
    const aisle = m.aisleLocation?.trim() || "Unassigned aisle";
    const rack = m.rackLocation?.trim() || "Unassigned rack";
    const shelf = m.shelfLocation?.trim() || "Unassigned shelf";
    if (!byAisle.has(aisle)) byAisle.set(aisle, new Map());
    const racks = byAisle.get(aisle)!;
    if (!racks.has(rack)) racks.set(rack, new Map());
    const shelves = racks.get(rack)!;
    if (!shelves.has(shelf)) shelves.set(shelf, []);
    shelves.get(shelf)!.push(m);
  }

  return [...byAisle.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([aisle, racks]) => ({
      aisle,
      racks: [...racks.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([rack, shelves]) => ({
          rack,
          shelves: [...shelves.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([shelf, meds]) => ({
              shelf,
              medicines: meds.sort((x, y) => x.name.localeCompare(y.name)),
            })),
        })),
    }));
}

export function PharmacyRackMapPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });

  const rackMap = useMemo(() => {
    const all = query.data ?? [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? all.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.genericName ?? "").toLowerCase().includes(q) ||
            (m.aisleLocation ?? "").toLowerCase().includes(q) ||
            (m.rackLocation ?? "").toLowerCase().includes(q) ||
            (m.shelfLocation ?? "").toLowerCase().includes(q),
        )
      : all;
    return buildRackMap(filtered);
  }, [query.data, search]);

  const mappedCount = useMemo(
    () => (query.data ?? []).filter((m) => m.aisleLocation || m.rackLocation || m.shelfLocation).length,
    [query.data],
  );

  if (query.isLoading) return <p className="text-sm text-slate-500">Loading rack map…</p>;
  if (query.isError) return <div className={noticeErrorClass}>{(query.error as Error).message}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rack / shelf mapping"
        subtitle={`Visual layout of ${mappedCount} mapped medicines across aisles, racks, and shelves.`}
      />

      <PharmacyInput
        className="max-w-md"
        placeholder="Filter by medicine, aisle, rack, or shelf…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="space-y-6">
        {rackMap.map((aisleGroup) => (
          <section
            key={aisleGroup.aisle}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{aisleGroup.aisle}</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {aisleGroup.racks.map((rackGroup) => (
                <div
                  key={`${aisleGroup.aisle}-${rackGroup.rack}`}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                >
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{rackGroup.rack}</h3>
                  <ul className="mt-3 space-y-3">
                    {rackGroup.shelves.map((shelfGroup) => (
                      <li key={`${rackGroup.rack}-${shelfGroup.shelf}`}>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Shelf {shelfGroup.shelf}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {shelfGroup.medicines.map((m) => (
                            <li
                              key={m.id}
                              className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs dark:bg-slate-950/50"
                            >
                              <span className="truncate font-medium">{m.name}</span>
                              <span className="shrink-0 text-slate-500">{m.currentStock} u</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {rackMap.length === 0 ? (
        <p className="text-sm text-slate-500">No medicines match your filter. Assign locations on the Medicines page.</p>
      ) : null}
    </div>
  );
}
