import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchVendorBills } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading } from "./AccountingUi";

export function PurchasesPage(): JSX.Element {
  const { branch } = useAccountingAccess();

  const billsQuery = useQuery({
    queryKey: ["accounting", "purchases", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchVendorBills(branch!.code),
  });

  if (billsQuery.isLoading) return <AccountingLoading />;
  if (billsQuery.isError) return <AccountingError message={(billsQuery.error as Error).message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase accounting"
        subtitle="Inventory purchases from goods receiving post to accounts payable."
        actions={
          <Link to="/pops/inventory/goods-receiving" className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-500">
            Receive goods
          </Link>
        }
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.billRef)}
          columns={[
            { key: "billRef", header: "Bill" },
            { key: "supplierName", header: "Supplier" },
            { key: "invoiceNumber", header: "Invoice", render: (r) => String(r.invoiceNumber ?? "—") },
            { key: "amount", header: "Amount", render: (r) => formatPkr(Number(r.amount)) },
            { key: "paid", header: "Paid", render: (r) => formatPkr(Number(r.paid)) },
            { key: "balance", header: "Balance", render: (r) => formatPkr(Number(r.balance)) },
            { key: "status", header: "Status" },
            { key: "sourceRef", header: "GRN", render: (r) => String(r.sourceRef ?? "—") },
          ]}
          rows={billsQuery.data! as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
