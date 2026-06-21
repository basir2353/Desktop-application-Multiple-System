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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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

export function SuppliersPage(): JSX.Element {
  const { branch, canManage } = useInventoryAccess();
  const invalidate = useInvalidateInventory();
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("lastOrder");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    paymentTerms: "Net 15",
    openingBalancePkr: "",
    onboardedDate: todayIso(),
  });

  const query = useQuery({
    queryKey: ["inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchBranchInventory(branch!.code),
  });

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
      setForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        paymentTerms: "Net 15",
        openingBalancePkr: "",
        onboardedDate: todayIso(),
      });
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updateSupplier(id, { active }),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const suppliers = query.data?.suppliers ?? [];
  const filteredSuppliers = useMemo(() => {
    if (!filterDate) return suppliers;
    return suppliers.filter((s) => matchesDateFilter(s, dateFilterMode, filterDate));
  }, [suppliers, filterDate, dateFilterMode]);

  if (query.isLoading) return <InventoryLoading />;
  if (query.isError) return <InventoryError message={(query.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Suppliers" subtitle="Supplier contacts, payment terms, and purchase history." />
      {error ? <InventoryError message={error} /> : null}

      {canManage ? (
        <InventoryFormPanel title="Add supplier" submitLabel="Save supplier" onSubmit={() => createMutation.mutate()} disabled={!form.name.trim() || createMutation.isPending}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputClass} placeholder="Supplier name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={inputClass} placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={inputClass} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className={inputClass} placeholder="Payment terms" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
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
            <input className={`sm:col-span-2 ${inputClass}`} placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </InventoryFormPanel>
      ) : null}

      <ModuleFilterBar>
        <ModuleSegmentedControl
          value={dateFilterMode}
          onChange={setDateFilterMode}
          options={[
            { id: "lastOrder", label: "Last order" },
            { id: "onboarded", label: "Onboarded" },
          ]}
        />
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${mutedClass}`}>Filter date</span>
          <input
            className={inputClass}
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
        </label>
        {filterDate ? (
          <button
            type="button"
            className={`self-end text-xs ${linkActionClass}`}
            onClick={() => setFilterDate("")}
          >
            Clear date
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
              { key: "active", header: "Status", render: (r) => <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge> },
              { key: "totalPurchases", header: "Purchases", render: (r) => formatPkr(r.totalPurchases) },
              {
                key: "lastOrder",
                header: "Last order",
                render: (r) => <span className={mutedClass}>{formatSupplierDate(r.lastOrder)}</span>,
              },
              ...(canManage ? [{
                id: "actions",
                key: "id" as const,
                header: "",
                render: (r: Supplier) => (
                  <div className="flex gap-2">
                    <button type="button" className={`text-xs ${linkActionClass}`} onClick={() => toggleMutation.mutate({ id: r.id, active: !r.active })}>
                      {r.active ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" className={`text-xs ${linkDangerClass}`} onClick={() => deleteMutation.mutate(r.id)}>Delete</button>
                  </div>
                ),
              }] : []),
            ]}
            rows={filteredSuppliers}
          />
          {filterDate && filteredSuppliers.length === 0 ? (
            <p className={`mt-2 text-sm ${mutedClass}`}>No suppliers match the selected date.</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-sm font-medium text-slate-900 dark:text-white">Supplier snapshot</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex justify-between"><span>Active</span><span>{filteredSuppliers.filter((s) => s.active).length}</span></li>
            <li className="flex justify-between"><span>Total spend</span><span className={accentValueClass}>{formatPkr(filteredSuppliers.reduce((s, x) => s + x.totalPurchases, 0))}</span></li>
            <li className="flex justify-between"><span>Opening balance</span><span>{formatPkr(filteredSuppliers.reduce((s, x) => s + x.openingBalancePkr, 0))}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
