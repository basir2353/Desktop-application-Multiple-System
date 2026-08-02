import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchVendorBills } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading, StatCard } from "./AccountingUi";

export function VendorsPage(): JSX.Element {
  const { branch } = useAccountingAccess();
  const [search, setSearch] = useState("");

  const billsQuery = useQuery({
    queryKey: ["accounting", "vendors", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchVendorBills(branch!.code),
  });

  if (billsQuery.isLoading) return <AccountingLoading />;
  if (billsQuery.isError) return <AccountingError message={(billsQuery.error as Error).message} />;

  const bills = billsQuery.data!;
  const outstanding = bills.reduce((s, b) => s + b.balance, 0);
  const bySupplier = new Map<string, { name: string; balance: number; bills: number }>();
  for (const b of bills) {
    const cur = bySupplier.get(b.supplierId) ?? { name: b.supplierName, balance: 0, bills: 0 };
    cur.balance += b.balance;
    cur.bills += 1;
    bySupplier.set(b.supplierId, cur);
  }

  const supplierRows = [...bySupplier.values()];
  const q = search.trim().toLowerCase();
  const filteredSuppliers = q
    ? supplierRows.filter((s) => s.name.toLowerCase().includes(q))
    : supplierRows;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vendor accounting"
        subtitle="Supplier balances, purchase bills, and payment history."
        actions={
          <Link to="/pops/inventory/suppliers" className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
            Manage suppliers
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Outstanding balance" value={formatPkr(outstanding)} />
        <StatCard label="Open bills" value={String(bills.filter((b) => b.status !== "paid").length)} />
        <StatCard label="Suppliers with balance" value={String(supplierRows.filter((s) => s.balance > 0).length)} />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-white">Supplier summary</div>
          <div className="flex items-center gap-2">
            <input
              className="min-w-[10rem] rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white sm:max-w-xs"
              placeholder="Search supplier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="text-xs text-slate-500">
              {filteredSuppliers.length} / {supplierRows.length}
            </span>
          </div>
        </div>
        <SimpleTable
          rowKey={(r) => String(r.name)}
          columns={[
            { key: "name", header: "Supplier" },
            { key: "bills", header: "Bills" },
            { key: "balance", header: "Outstanding", render: (r) => formatPkr(Number(r.balance)) },
          ]}
          rows={filteredSuppliers as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
