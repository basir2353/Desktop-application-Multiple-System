import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createInventoryCookingUnit,
  fetchInventoryCookingUnitStock,
  fetchInventoryCookingUnits,
  updateInventoryCookingUnit,
} from "../../../api/inventory";
import { inputClass, selectClass, useInventoryAccess } from "../../../hooks/useInventory";
import { printHtmlDocumentAndWait } from "../../../lib/printTicket";
import { PageHeader } from "../../../ui/PageHeader";
import { InventoryError, InventoryLoading } from "./InventoryUi";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatStockQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function totalsByUnit(rows: { unit: string; quantity: number }[]): { unit: string; qty: number }[] {
  const byUnit = new Map<string, number>();
  for (const row of rows) {
    const unit = row.unit.trim() || "units";
    byUnit.set(unit, (byUnit.get(unit) ?? 0) + Number(row.quantity || 0));
  }
  return [...byUnit.entries()].map(([unit, qty]) => ({ unit, qty }));
}

function formatUnitTotals(totals: { unit: string; qty: number }[]): string {
  if (totals.length === 0) return "0";
  return totals.map((row) => `${formatStockQty(row.qty)} ${row.unit}`).join("  ·  ");
}

export function CookingUnitsPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "out">("all");
  const [printBusy, setPrintBusy] = useState(false);

  const unitsQuery = useQuery({
    queryKey: ["inventory", "cooking-units", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryCookingUnits(branch!.code),
  });
  const stockQuery = useQuery({
    queryKey: ["inventory", "cooking-unit-stock", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryCookingUnitStock(branch!.code),
  });
  const createMutation = useMutation({
    mutationFn: () => {
      if (!branch?.code || !name.trim()) throw new Error("Enter a Cooking Unit name");
      return createInventoryCookingUnit({
        branchCode: branch.code,
        name: name.trim(),
        code: code.trim() || undefined,
      });
    },
    onSuccess: () => {
      setName("");
      setCode("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["inventory", "cooking-units"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const units = unitsQuery.data?.units ?? [];
  const stock = stockQuery.data ?? [];

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stock.filter((row) => {
      if (sectionFilter && row.cookingUnitId !== sectionFilter) return false;
      if (stockFilter === "in" && !(row.quantity > 0)) return false;
      if (stockFilter === "out" && row.quantity > 0) return false;
      if (!q) return true;
      const sectionName = units.find((unit) => unit.id === row.cookingUnitId)?.name ?? "";
      return (
        row.productName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        sectionName.toLowerCase().includes(q)
      );
    });
  }, [search, sectionFilter, stock, stockFilter, units]);

  const selectedSectionName =
    units.find((unit) => unit.id === sectionFilter)?.name ?? "All sections";
  const stockTotals = useMemo(() => totalsByUnit(filteredStock), [filteredStock]);
  const stockTotalLabel = formatUnitTotals(stockTotals);

  async function printStock(): Promise<void> {
    if (filteredStock.length === 0) {
      setError("Nothing to print for the current filter.");
      return;
    }
    setPrintBusy(true);
    setError(null);
    try {
      const printedAt = new Date().toLocaleString("en-PK");
      const rowsHtml = filteredStock
        .map((row) => {
          const section = units.find((unit) => unit.id === row.cookingUnitId)?.name ?? "Unassigned";
          return `<tr>
            <td>${escapeHtml(section)}</td>
            <td>${escapeHtml(row.productName)}</td>
            <td>${escapeHtml(row.sku)}</td>
            <td>${escapeHtml(row.unit)}</td>
            <td class="num">${escapeHtml(formatStockQty(row.quantity))}</td>
          </tr>`;
        })
        .join("");
      const totalsHtml = stockTotals
        .map((row) => `<div><strong>${escapeHtml(formatStockQty(row.qty))}</strong> ${escapeHtml(row.unit)}</div>`)
        .join("");
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kitchen stock by section</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f3f3f3; }
    tfoot td { font-weight: 700; background: #faf6ea; }
    .num { text-align: right; }
    .total-box { margin-top: 16px; border: 1px solid #ccc; padding: 10px 12px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Kitchen stock by section</h1>
  <div class="meta">
    ${escapeHtml(branch?.name ?? "Branch")} · ${escapeHtml(selectedSectionName)}
    ${stockFilter === "in" ? " · In stock" : stockFilter === "out" ? " · Out of stock" : ""}
    ${search.trim() ? ` · Search: ${escapeHtml(search.trim())}` : ""}
    · ${escapeHtml(printedAt)} · ${filteredStock.length} row${filteredStock.length === 1 ? "" : "s"}
  </div>
  <table>
    <thead>
      <tr>
        <th>Cooking Unit</th>
        <th>Product</th>
        <th>SKU</th>
        <th>Unit</th>
        <th class="num">Quantity</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="4">${escapeHtml(selectedSectionName)} total</td>
        <td class="num">${escapeHtml(stockTotalLabel)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="total-box">
    ${escapeHtml(selectedSectionName)} stock total: ${totalsHtml || "0"}
  </div>
</body>
</html>`;
      const opened = await printHtmlDocumentAndWait(html, "Kitchen stock by section");
      if (!opened) setError("Print dialog could not open.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Print failed");
    } finally {
      setPrintBusy(false);
    }
  }

  if (unitsQuery.isLoading) return <InventoryLoading />;
  if (unitsQuery.isError) return <InventoryError message={(unitsQuery.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cooking Units"
        subtitle="Kitchen sections for Pakistani, Fast Food, Chinese, Continental, Grill, and your own custom sections."
      />
      {error ? <InventoryError message={error} /> : null}
      {canManage ? (
        <form
          className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-[1fr_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
        >
          <input className={inputClass} placeholder="Cooking Unit name" value={name} onChange={(event) => setName(event.target.value)} />
          <input className={inputClass} placeholder="Code (optional)" value={code} onChange={(event) => setCode(event.target.value)} />
          <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50" disabled={createMutation.isPending || !name.trim()}>
            {createMutation.isPending ? "Adding…" : "Add unit"}
          </button>
        </form>
      ) : null}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 text-sm font-medium text-white">Configured Kitchen sections</div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {units.map((unit) => (
            <div
              key={unit.id}
              className={`flex items-center justify-between rounded-lg border bg-slate-950/50 p-3 ${
                sectionFilter === unit.id ? "border-amber-400" : "border-slate-700"
              }`}
            >
              {editingId === unit.id ? (
                <div className="min-w-0 flex-1 space-y-1.5 pr-2">
                  <input className={`${inputClass} w-full`} value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                  <input className={`${inputClass} w-full`} value={editingCode} onChange={(event) => setEditingCode(event.target.value)} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded bg-indigo-600 px-2 py-1 text-[11px] text-white"
                      onClick={() => {
                        void updateInventoryCookingUnit(unit.id, { name: editingName.trim(), code: editingCode.trim() })
                          .then(() => {
                            setEditingId(null);
                            setError(null);
                            void queryClient.invalidateQueries({ queryKey: ["inventory", "cooking-units"] });
                          })
                          .catch((err: Error) => setError(err.message));
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSectionFilter((prev) => (prev === unit.id ? "" : unit.id))}
                >
                  <div className="text-sm font-medium text-white">{unit.name}</div>
                  <div className="text-[11px] text-slate-500">{unit.code} · {unit.totalStock.toLocaleString()} stock units</div>
                </button>
              )}
              {canManage ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${unit.isActive ? "border-emerald-500/40 text-emerald-300" : "border-slate-700 text-slate-500"}`}
                    onClick={() => {
                      void updateInventoryCookingUnit(unit.id, { isActive: !unit.isActive })
                        .then(() => {
                          setError(null);
                          void queryClient.invalidateQueries({ queryKey: ["inventory", "cooking-units"] });
                        })
                        .catch((err: Error) => setError(err.message));
                    }}
                  >
                    {unit.isActive ? "Active" : "Inactive"}
                  </button>
                  {editingId !== unit.id ? (
                    <button
                      type="button"
                      className="text-[11px] text-sky-300 hover:text-sky-200"
                      onClick={() => {
                        setEditingId(unit.id);
                        setEditingName(unit.name);
                        setEditingCode(unit.code);
                      }}
                    >
                      Rename
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-white">Kitchen stock by section</div>
          <Button
            className="text-xs"
            disabled={printBusy || filteredStock.length === 0}
            onClick={() => void printStock()}
          >
            {printBusy ? "Printing…" : "Print"}
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            className={`min-w-[12rem] flex-1 sm:max-w-xs ${inputClass}`}
            placeholder="Search product, SKU, section…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className={selectClass}
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value)}
          >
            <option value="">All sections</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value as "all" | "in" | "out")}
          >
            <option value="all">All stock</option>
            <option value="in">In stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
        {stockQuery.isLoading ? (
          <p className="text-xs text-slate-500">Loading section stock…</p>
        ) : stock.length === 0 ? (
          <p className="text-xs text-slate-500">No unit stock has been transferred yet.</p>
        ) : filteredStock.length === 0 ? (
          <p className="text-xs text-slate-500">No rows match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-2 py-2">Cooking Unit</th>
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2">SKU</th>
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredStock.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2 text-slate-300">{units.find((unit) => unit.id === row.cookingUnitId)?.name ?? "Unassigned"}</td>
                    <td className="px-2 py-2 text-white">{row.productName}</td>
                    <td className="px-2 py-2 text-slate-500">{row.sku}</td>
                    <td className="px-2 py-2 text-slate-400">{row.unit}</td>
                    <td className="px-2 py-2 text-right font-medium text-amber-200">{formatStockQty(row.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-400/40 bg-slate-950/80">
                  <td className="px-2 py-3 text-sm font-semibold text-white" colSpan={4}>
                    {selectedSectionName} total
                  </td>
                  <td className="px-2 py-3 text-right text-sm font-bold text-amber-200">
                    {stockTotalLabel}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2">
              <span className="text-xs font-medium text-amber-100">
                {selectedSectionName} stock total
              </span>
              <span className="text-sm font-bold text-amber-200">{stockTotalLabel}</span>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {filteredStock.length} row{filteredStock.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
