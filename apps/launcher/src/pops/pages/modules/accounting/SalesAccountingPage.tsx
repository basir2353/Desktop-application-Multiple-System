import { useQuery } from "@tanstack/react-query";
import { fetchSalesAccounting } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading, StatCard } from "./AccountingUi";
import { AccountingFlowBanner } from "./AccountingFlowBanner";

export function SalesAccountingPage(): JSX.Element {
  const { branch } = useAccountingAccess();

  const salesQuery = useQuery({
    queryKey: ["accounting", "sales", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchSalesAccounting(branch!.code),
  });

  if (salesQuery.isLoading) return <AccountingLoading />;
  if (salesQuery.isError) return <AccountingError message={(salesQuery.error as Error).message} />;

  const s = salesQuery.data!;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sales accounting"
        subtitle="POS sales automatically create journal entries when bills are completed."
      />
      <AccountingFlowBanner />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dine-in" value={formatPkr(s.dineIn)} />
        <StatCard label="Takeaway" value={formatPkr(s.takeaway)} />
        <StatCard label="Delivery" value={formatPkr(s.delivery)} />
        <StatCard label="Total sales" value={formatPkr(s.totalSales)} />
        <StatCard label="Discounts" value={formatPkr(s.discounts)} />
        <StatCard label="Service charges" value={formatPkr(s.serviceCharges)} />
        <StatCard label="Tax collected" value={formatPkr(s.taxCollected)} />
        <StatCard label="Void orders" value={String(s.voids)} />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="text-sm font-medium text-white">Recent POS bills</div>
        <SimpleTable
          rowKey={(r) => String(r.billRef)}
          columns={[
            { key: "billRef", header: "Bill" },
            { key: "tableLabel", header: "Table / type" },
            { key: "total", header: "Total", render: (r) => formatPkr(Number(r.total)) },
            { key: "status", header: "Status" },
            { key: "createdAt", header: "Date", render: (r) => new Date(String(r.createdAt)).toLocaleString() },
          ]}
          rows={s.recentSales as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
