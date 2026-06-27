import { MEDICINE_CATEGORIES, type Medicine } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createPharmacyMedicine, deletePharmacyMedicine, fetchPharmacyMedicines } from "../api/pharmacy";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../hooks/usePharmacy";
import {
  PharmacyField,
  PharmacyFormSection,
  PharmacyInput,
  PharmacySelect,
  PharmacyStatCard,
} from "../ui/PharmacyUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { Badge } from "../../pops/ui/Badge";
import { noticeErrorClass } from "../../pops/lib/themeClasses";

const emptyForm = {
  sku: "",
  name: "",
  genericName: "",
  presentation: "",
  brandName: "",
  category: "Tablet" as (typeof MEDICINE_CATEGORIES)[number],
  manufacturer: "",
  barcode: "",
  purchasePrice: "",
  sellingPrice: "",
  reorderLevel: "10",
  currentStock: "",
  batchNumber: "",
  expiryDate: "",
};

function stockTone(m: Medicine): "success" | "warning" | "danger" {
  if (m.currentStock === 0) return "danger";
  if (m.currentStock <= m.reorderLevel) return "warning";
  return "success";
}

function stockLabel(m: Medicine): string {
  if (m.currentStock === 0) return "Out of stock";
  if (m.currentStock <= m.reorderLevel) return "Low stock";
  return "In stock";
}

export function MedicinesPage(): JSX.Element {
  const { branch, canManage } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const query = useQuery({
    queryKey: ["pharmacy", "medicines", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPharmacyMedicines(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createPharmacyMedicine({
        branchCode: branch!.code,
        sku: form.sku.trim(),
        name: form.name.trim(),
        genericName: form.genericName.trim() || undefined,
        presentation: form.presentation.trim() || undefined,
        brandName: form.brandName.trim() || undefined,
        category: form.category,
        manufacturer: form.manufacturer.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        purchasePrice: Number(form.purchasePrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        reorderLevel: Number(form.reorderLevel) || 10,
        currentStock: Number(form.currentStock) || 0,
        batchNumber: form.batchNumber.trim() || undefined,
        expiryDate: form.expiryDate || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePharmacyMedicine,
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const allMedicines = query.data ?? [];

  const stats = useMemo(() => {
    const low = allMedicines.filter((m) => m.currentStock > 0 && m.currentStock <= m.reorderLevel).length;
    const out = allMedicines.filter((m) => m.currentStock === 0).length;
    return { total: allMedicines.length, low, out, ok: allMedicines.length - low - out };
  }, [allMedicines]);

  const medicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allMedicines;
    return allMedicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        (m.genericName ?? "").toLowerCase().includes(q) ||
        (m.barcode ?? "").includes(q),
    );
  }, [allMedicines, search]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Loading medicine catalog…
      </div>
    );
  }

  if (query.isError) {
    return <div className={noticeErrorClass}>{(query.error as Error).message}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine master"
        subtitle="Catalog of medicines with presentation, generic name, pricing, and batch details for your pharmacy."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {showForm ? "Hide add form" : "Add new medicine"}
            </button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PharmacyStatCard label="Total medicines" value={stats.total} />
        <PharmacyStatCard label="In stock" value={stats.ok} tone="success" />
        <PharmacyStatCard label="Low stock" value={stats.low} tone="warning" />
        <PharmacyStatCard label="Out of stock" value={stats.out} tone="danger" />
      </div>

      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {canManage && showForm ? (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Register a medicine</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fill in the product identity first, then pricing and opening stock. Fields marked * are required.
              </p>
            </div>
          </div>

          <PharmacyFormSection
            title="Product identity"
            description="How the medicine appears on labels, prescriptions, and invoices."
          >
            <PharmacyField label="SKU / product code" required>
              <PharmacyInput
                placeholder="e.g. MED-006"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Medicine name" required>
              <PharmacyInput
                placeholder="e.g. Panadol 500mg"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Generic name" hint="Active ingredient">
              <PharmacyInput
                placeholder="e.g. Paracetamol"
                value={form.genericName}
                onChange={(e) => setForm({ ...form, genericName: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Presentation" hint="Strength & form shown to staff">
              <PharmacyInput
                placeholder="e.g. 500mg Tablet — 10 strips"
                value={form.presentation}
                onChange={(e) => setForm({ ...form, presentation: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Brand name">
              <PharmacyInput
                placeholder="e.g. GSK"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Category">
              <PharmacySelect
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
              >
                {MEDICINE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </PharmacySelect>
            </PharmacyField>
            <PharmacyField label="Manufacturer">
              <PharmacyInput
                placeholder="e.g. Abbott"
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Barcode" hint="For POS scanning">
              <PharmacyInput
                placeholder="Scan or type barcode"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </PharmacyField>
          </PharmacyFormSection>

          <PharmacyFormSection title="Pricing & stock" description="Purchase and selling prices in PKR.">
            <PharmacyField label="Purchase price (Rs)">
              <PharmacyInput
                type="number"
                min={0}
                placeholder="0"
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Selling price (Rs)">
              <PharmacyInput
                type="number"
                min={0}
                placeholder="0"
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Reorder level" hint="Alert when stock falls below">
              <PharmacyInput
                type="number"
                min={0}
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Opening stock">
              <PharmacyInput
                type="number"
                min={0}
                placeholder="0"
                value={form.currentStock}
                onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
              />
            </PharmacyField>
          </PharmacyFormSection>

          <PharmacyFormSection title="Batch & expiry" description="Optional — used for expiry tracking and FEFO.">
            <PharmacyField label="Batch number">
              <PharmacyInput
                placeholder="e.g. BN2026A"
                value={form.batchNumber}
                onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
              />
            </PharmacyField>
            <PharmacyField label="Expiry date">
              <PharmacyInput
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </PharmacyField>
          </PharmacyFormSection>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="submit"
              disabled={!form.sku.trim() || !form.name.trim() || createMutation.isPending}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving…" : "Save medicine"}
            </button>
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Clear form
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Medicine catalog</h2>
            <p className="text-xs text-slate-500">
              Showing {medicines.length} of {allMedicines.length} products
              {branch ? ` · ${branch.name}` : ""}
            </p>
          </div>
          <div className="relative w-full sm:max-w-md">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            <PharmacyInput
              className="pl-10"
              placeholder="Search by name, generic, SKU, or barcode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {medicines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No medicines found</p>
            <p className="mt-1 text-xs text-slate-500">
              {search ? "Try a different search term." : "Add your first medicine using the form above."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/30">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Presentation</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Expiry</th>
                    <th className="px-4 py-3">Status</th>
                    {canManage ? <th className="px-4 py-3 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {medicines.map((m) => (
                    <tr
                      key={m.id}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{m.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          <span className="font-mono">{m.sku}</span>
                          {m.genericName ? (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span>{m.genericName}</span>
                            </>
                          ) : null}
                          {m.brandName ? (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span>{m.brandName}</span>
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{m.presentation ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {m.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium tabular-nums text-slate-900 dark:text-white">{m.currentStock}</span>
                        <span className="ml-1 text-xs text-slate-500">{m.unit}</span>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-slate-900 dark:text-white">
                        {formatPkr(m.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{m.nearestExpiry ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={stockTone(m)}>{stockLabel(m)}</Badge>
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Remove ${m.name} from the catalog?`)) {
                                deleteMutation.mutate(m.id);
                              }
                            }}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                          >
                            Delete
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
