import type { Supplier } from "@platform/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createSupplier, deleteSupplier, fetchBranchInventory, updateSupplier } from "../../../api/inventory";
import { formatPkr, inputClass, useInventoryAccess, useInvalidateInventory } from "../../../hooks/useInventory";
import { accentValueClass, linkActionClass, linkDangerClass, mutedClass } from "../../../lib/themeClasses";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import {
  ModuleCountBadge,
  ModuleFilterBar,
  ModuleSegmentedControl,
} from "../../../ui/ModuleToolbar";
import { InventoryError, InventoryFormPanel, InventoryLoading } from "./InventoryUi";

type DateFilterMode = "lastOrder" | "onboarded";

type SupplierForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  paymentTerms: string;
  openingBalancePkr: string;
  onboardedDate: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): SupplierForm {
  return {
    name: "",
    phone: "",
    email: "",
    address: "",
    paymentTerms: "Net 15",
    openingBalancePkr: "",
    onboardedDate: todayIso(),
  };
}

function formatSupplierDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function matchesDateFilter(supplier: Supplier, mode: DateFilterMode, filterDate: string): boolean {
  const value = mode === "lastOrder" ? supplier.lastOrder : supplier.onboardedDate;
  return value === filterDate;
}

function supplierToForm(s: Supplier): SupplierForm {
  return {
    name: s.name,
    phone: s.phone ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    paymentTerms: s.paymentTerms ?? "Net 15",
    openingBalancePkr: s.openingBalancePkr > 0 ? String(s.openingBalancePkr) : "",
    onboardedDate: s.onboardedDate ?? todayIso(),
  };
}

export function SuppliersPanel({ showHeader = true }: { showHeader?: boolean }): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("lastOrder");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

  function resetForm(): void {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEdit(s: Supplier): void {
    setEditingId(s.id);
    setForm(supplierToForm(s));
    setError(null);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createSupplier({
        branchCode: branch!.code,
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        paymentTerms: form.paymentTerms.trim() || undefined,
        openingBalancePkr: form.openingBalancePkr.trim() ? Number(form.openingBalancePkr) : undefined,
        onboardedDate: form.onboardedDate || undefined,
      }),
    onSuccess: () => {
      invalidate();
      resetForm();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingId) throw new Error("No supplier selected");
      return updateSupplier(editingId, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        paymentTerms: form.paymentTerms.trim() || null,
        openingBalancePkr: form.openingBalancePkr.trim() ? Number(form.openingBalancePkr) : 0,
        onboardedDate: form.onboardedDate || null,
      });
    },
    onSuccess: () => {
      invalidate();
      resetForm();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateSupplier(id, { active }),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      invalidate();
      if (editingId) resetForm();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const suppliers = query.data?.suppliers ?? [];
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (filterDate && !matchesDateFilter(s, dateFilterMode, filterDate)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.paymentTerms ?? "").toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [suppliers, filterDate, dateFilterMode, search]);

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  const formBusy = createMutation.isPending || updateMutation.isPending;
  const formPanel = canManage ? (
    <InventoryFormPanel
      title={editingId ? `Edit supplier · ${form.name || "…"}` : "Add supplier"}
      submitLabel={editingId ? (updateMutation.isPending ? "Saving…" : "Save changes") : "Save supplier"}
      onSubmit={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
      disabled={!form.name.trim() || formBusy}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={inputClass}
          placeholder="Supplier name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder="Payment terms"
          value={form.paymentTerms}
          onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
        />
        <input
          className={inputClass}
          type="number"
          min={0}
          placeholder="Opening balance (Rs)"
          value={form.openingBalancePkr}
          onChange={(e) => setForm({ ...form, openingBalancePkr: e.target.value })}
        />
        <label className="flex flex-col gap-1">
          <span className={`text-xs font-medium ${mutedClass}`}>Onboarded date</span>
          <input
            className={inputClass}
            type="date"
            value={form.onboardedDate}
            onChange={(e) => setForm({ ...form, onboardedDate: e.target.value })}
          />
        </label>
        <input
          className={`sm:col-span-2 ${inputClass}`}
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        {editingId ? (
          <button
            type="button"
            className={`text-xs ${linkActionClass}`}
            onClick={() => resetForm()}
          >
            Cancel edit
          </button>
        ) : null}
      </div>
    </InventoryFormPanel>
  ) : null;

  return (
    <div className="space-y-4">
      {showHeader ? (
        <PageHeader title="Suppliers" subtitle="Supplier contacts, payment terms, and purchase history." />
      ) : null}
      {error ? <InventoryError message={error} /> : null}

      {formPanel}

      <ModuleFilterBar>
        <input
          className={`min-w-[12rem] flex-1 sm:max-w-xs ${inputClass}`}
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ModuleSegmentedControl
          value={dateFilterMode}
          onChange={setDateFilterMode}
          options={[
            { id: "lastOrder", label: "Last order" },
            { id: "onboarded", label: "Onboarded" },
          ]}
        />
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>
            Filter date
          </span>
          <input
            className={inputClass}
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </label>
        {filterDate || search ? (
          <button
            type="button"
            className={`self-end text-xs ${linkActionClass}`}
            onClick={() => {
              setFilterDate("");
              setSearch("");
            }}
          >
            Clear filters
          </button>
        ) : null}
        <ModuleCountBadge shown={filteredSuppliers.length} total={suppliers.length} />
      </ModuleFilterBar>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SimpleTable<Supplier>
            rowKey={(r) => r.id}
            columns={[
              { key: "name", header: "Supplier" },
              { key: "phone", header: "Contact", render: (r) => r.phone ?? "—" },
              { key: "paymentTerms", header: "Terms", render: (r) => r.paymentTerms ?? "—" },
              {
                key: "openingBalancePkr",
                header: "Opening bal.",
                render: (r) => (r.openingBalancePkr > 0 ? formatPkr(r.openingBalancePkr) : "—"),
              },
              {
                key: "onboardedDate",
                header: "Onboarded",
                render: (r) => <span className={mutedClass}>{formatSupplierDate(r.onboardedDate)}</span>,
              },
              {
                key: "active",
                header: "Status",
                render: (r) => (
                  <Badge tone={r.active ? "success" : "neutral"}>
                    {r.active ? "Active" : "Inactive"}
                  </Badge>
                ),
              },
              {
                key: "totalPurchases",
                header: "Purchases",
                render: (r) => formatPkr(r.totalPurchases),
              },
              {
                key: "lastOrder",
                header: "Last order",
                render: (r) => <span className={mutedClass}>{formatSupplierDate(r.lastOrder)}</span>,
              },
              ...(canManage
                ? [
                    {
                      id: "actions",
                      key: "id" as const,
                      header: "",
                      render: (r: Supplier) => (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={`text-xs ${linkActionClass}`}
                            onClick={() => startEdit(r)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`text-xs ${linkActionClass}`}
                            onClick={() => toggleMutation.mutate({ id: r.id, active: !r.active })}
                          >
                            {r.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            className={`text-xs ${linkDangerClass}`}
                            onClick={() => {
                              if (window.confirm(`Delete supplier “${r.name}”?`)) {
                                deleteMutation.mutate(r.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
            rows={filteredSuppliers}
          />
          {filteredSuppliers.length === 0 ? (
            <p className={`mt-2 text-sm ${mutedClass}`}>
              {search || filterDate ? "No suppliers match your filters." : "No suppliers yet."}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-sm font-medium text-slate-900 dark:text-white">Supplier snapshot</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex justify-between">
              <span>Active</span>
              <span>{filteredSuppliers.filter((s) => s.active).length}</span>
            </li>
            <li className="flex justify-between">
              <span>Total spend</span>
              <span className={accentValueClass}>
                {formatPkr(filteredSuppliers.reduce((s, x) => s + x.totalPurchases, 0))}
              </span>
            </li>
            <li className="flex justify-between">
              <span>Opening balance</span>
              <span>{formatPkr(filteredSuppliers.reduce((s, x) => s + x.openingBalancePkr, 0))}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SuppliersPage(): JSX.Element {
  return <SuppliersPanel showHeader />;
}
