import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchVendorBills } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading, StatCard } from "./AccountingUi";

export function VendorsPage(): JSX.Element {
  const { branch } = useAccountingAccess();

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
        <StatCard label="Suppliers with balance" value={String([...bySupplier.values()].filter((s) => s.balance > 0).length)} />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="mb-3 text-sm font-medium text-white">Supplier summary</div>
        <SimpleTable
          rowKey={(r) => String(r.name)}
          columns={[
            { key: "name", header: "Supplier" },
            { key: "bills", header: "Bills" },
            { key: "balance", header: "Outstanding", render: (r) => formatPkr(Number(r.balance)) },
          ]}
          rows={[...bySupplier.values()] as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
