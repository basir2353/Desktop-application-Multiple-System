import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchInventoryAccounting } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { AccountingError, AccountingLoading, StatCard } from "./AccountingUi";
import { AccountingFlowBanner } from "./AccountingFlowBanner";

export function InventoryAccountingPage(): JSX.Element {
  const { branch } = useAccountingAccess();

  const invQuery = useQuery({
    queryKey: ["accounting", "inventory", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchInventoryAccounting(branch!.code),
  });

  if (invQuery.isLoading) return <AccountingLoading />;
  if (invQuery.isError) return <AccountingError message={(invQuery.error as Error).message} />;

  const m = invQuery.data!;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory accounting"
        subtitle="Stock valuation, COGS, purchases, waste, and adjustments linked to inventory."
        actions={
          <Link to="/pops/inventory" className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
            Inventory module
          </Link>
        }
      />
      <AccountingFlowBanner />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Stock valuation" value={formatPkr(m.stockValuation)} />
        <StatCard label="COGS today" value={formatPkr(m.cogsToday)} />
        <StatCard label="COGS (month)" value={formatPkr(m.cogsMonth)} />
        <StatCard label="Purchase cost (month)" value={formatPkr(m.purchaseCostMonth)} />
        <StatCard label="Waste cost (month)" value={formatPkr(m.wasteCostMonth)} />
        <StatCard label="Adjustment impact (month)" value={formatPkr(m.adjustmentImpactMonth)} />
      </div>
    </div>
  );
}
