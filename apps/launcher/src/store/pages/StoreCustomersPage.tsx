import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { StoreSale } from "@platform/contracts";
import { createStoreCustomer, fetchStoreCustomers, fetchStoreSales } from "../api/store";
import { printStoreInvoice } from "../lib/printStoreInvoice";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreFormSection, StoreInput, StoreStatCard } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { noticeSuccessClass } from "../../pops/lib/themeClasses";

function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function todayDate(): string {
  return toDateInputValue(new Date());
}

function startOfMonthDate(): string {
  const d = new Date();
  d.setDate(1);
  return toDateInputValue(d);
}

function startOfWeekDate(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return toDateInputValue(d);
}

function saleDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function filterSalesByDate(sales: StoreSale[], from: string, to: string): StoreSale[] {
  return sales.filter((s) => {
    const d = saleDateKey(s.createdAt);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

export function StoreCustomersPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const customersQuery = useQuery({ queryKey: ["store", "customers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreCustomers(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreCustomer({ branchCode: branch!.code, name, phone }),
    onSuccess: () => { invalidate(); setName(""); setNotice("Customer added"); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle="Customer profiles, credit sales, loyalty points, and outstanding balances." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      <StoreFormSection title="Add customer">
        <StoreField label="Name"><StoreInput value={name} onChange={(e) => setName(e.target.value)} /></StoreField>
        <StoreField label="Phone"><StoreInput value={phone} onChange={(e) => setPhone(e.target.value)} /></StoreField>
        <div className="col-span-full"><button type="button" onClick={() => createMutation.mutate()} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Add customer</button></div>
      </StoreFormSection>
      <StoreDataTable
        columns={["Name", "Phone", "Loyalty pts", "Credit limit", "Outstanding", "Total purchases"]}
        rows={(customersQuery.data ?? []).map((c) => [
          c.name, c.phone ?? "—", c.loyaltyPoints, formatPkr(c.creditLimitPkr), formatPkr(c.outstandingPkr), formatPkr(c.totalPurchases),
        ])}
      />
    </div>
  );
}

export function StoreSalesPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const [fromLocal, setFromLocal] = useState(startOfMonthDate);
  const [toLocal, setToLocal] = useState(todayDate);
  const [appliedFrom, setAppliedFrom] = useState(startOfMonthDate);
  const [appliedTo, setAppliedTo] = useState(todayDate);

  const salesQuery = useQuery({
    queryKey: ["store", "sales", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSales(branch!.code),
  });

  const filteredSales = useMemo(
    () => filterSalesByDate(salesQuery.data ?? [], appliedFrom, appliedTo),
    [salesQuery.data, appliedFrom, appliedTo],
  );

  const filteredTotal = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.total, 0),
    [filteredSales],
  );

  function applyFilter(): void {
    setAppliedFrom(fromLocal);
    setAppliedTo(toLocal);
  }

  function applyPreset(preset: "today" | "week" | "month" | "all"): void {
    if (preset === "all") {
      setFromLocal("");
      setToLocal("");
      setAppliedFrom("");
      setAppliedTo("");
      return;
    }
    const from = preset === "today" ? todayDate() : preset === "week" ? startOfWeekDate() : startOfMonthDate();
    const to = todayDate();
    setFromLocal(from);
    setToLocal(to);
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  const periodLabel =
    appliedFrom && appliedTo
      ? `${appliedFrom} — ${appliedTo}`
      : appliedFrom
        ? `From ${appliedFrom}`
        : appliedTo
          ? `Until ${appliedTo}`
          : "All time";

  if (salesQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading sales…</p>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales orders"
        subtitle="Sales history, invoices, returns, discounts, and credit sales."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Date filter</h2>
            <p className="mt-1 text-xs text-slate-500">Filter orders by sale date.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "Today"],
                ["week", "This week"],
                ["month", "This month"],
                ["all", "All time"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:text-sky-400"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StoreField label="From">
            <StoreInput type="date" value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} />
          </StoreField>
          <StoreField label="To">
            <StoreInput type="date" value={toLocal} onChange={(e) => setToLocal(e.target.value)} />
          </StoreField>
          <div className="flex items-end sm:col-span-2">
            <button
              type="button"
              onClick={applyFilter}
              className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 sm:w-auto"
            >
              Apply filter
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Showing {filteredSales.length} order{filteredSales.length === 1 ? "" : "s"} · {periodLabel}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StoreStatCard label="Orders in period" value={filteredSales.length} />
        <StoreStatCard label="Total sales" value={formatPkr(filteredTotal)} tone="success" />
      </div>

      <StoreDataTable
        columns={["Invoice", "Customer", "Payment", "Total", "Status", "Delivery", "Date", ""]}
        rows={filteredSales.map((s) => [
          s.invoiceNumber,
          s.customerName ?? "Walk-in",
          s.paymentMethod + (s.isCredit ? " (Credit)" : ""),
          formatPkr(s.total),
          s.status,
          s.deliveryStatus,
          new Date(s.createdAt).toLocaleString(),
          <button
            key={s.id}
            type="button"
            className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            onClick={() => printStoreInvoice(branch?.name ?? "Store", branch?.code ?? "—", s)}
          >
            Print
          </button>,
        ])}
      />
    </div>
  );
}
