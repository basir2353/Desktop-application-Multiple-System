import { useQuery } from "@tanstack/react-query";
import { fetchAccounts } from "../../../api/accounting";
import { formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingLoading } from "./AccountingUi";

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];

export function ChartOfAccountsPage(): JSX.Element {
  const { branch } = useAccountingAccess();

  const accountsQuery = useQuery({
    queryKey: ["accounting", "accounts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchAccounts(branch!.code),
  });

  if (accountsQuery.isLoading) return <AccountingLoading />;
  if (accountsQuery.isError) return <AccountingError message={(accountsQuery.error as Error).message} />;

  const accounts = accountsQuery.data!;
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: accounts.filter((a) => a.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of accounts"
        subtitle="Foundation of your general ledger — assets, liabilities, income, and expenses."
      />

      {grouped.map((group) => (
        <div key={group.type} className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
          <div className="mb-3 text-sm font-medium capitalize text-emerald-300">{group.type}</div>
          <SimpleTable
            rowKey={(r) => String(r.code)}
            columns={[
              { key: "code", header: "Code" },
              { key: "name", header: "Account" },
              { key: "subtype", header: "Subtype", render: (r) => String(r.subtype ?? "—") },
              {
                key: "balance",
                header: "Balance",
                render: (r) => formatPkr(Number(r.balance)),
              },
            ]}
            rows={group.items as unknown as Record<string, unknown>[]}
          />
        </div>
      ))}
    </div>
  );
}
