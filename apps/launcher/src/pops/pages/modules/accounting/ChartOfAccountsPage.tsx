import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAccountHead, fetchAccounts } from "../../../api/accounting";
import { accountingInputClass, formatPkr, useAccountingAccess } from "../../../hooks/useAccounting";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"] as const;

export function ChartOfAccountsPage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<(typeof TYPE_ORDER)[number]>("expense");
  const [subtype, setSubtype] = useState("");

  const accountsQuery = useQuery({
    queryKey: ["accounting", "accounts", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchAccounts(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createAccountHead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting", "accounts"] });
      setName("");
      setCode("");
      setSubtype("");
    },
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
        subtitle="System heads remain available, and you can add heads for your own accounts and expenses."
      />

      {canManage ? (
        <AccountingFormPanel
          title="Create account head"
          submitLabel="Add account head"
          disabled={createMutation.isPending || !branch?.code || !name.trim()}
          onSubmit={() => {
            if (!branch?.code || !name.trim()) return;
            createMutation.mutate({
              branchCode: branch.code,
              name,
              code: code.trim() || undefined,
              type,
              subtype: subtype.trim() || undefined,
            });
          }}
        >
          <input
            className={accountingInputClass}
            placeholder="Head name (e.g. Delivery expenses)"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <select
            className={accountingInputClass}
            value={type}
            onChange={(event) => setType(event.target.value as (typeof TYPE_ORDER)[number])}
          >
            {TYPE_ORDER.map((accountType) => (
              <option key={accountType} value={accountType}>
                {accountType[0].toUpperCase() + accountType.slice(1)}
              </option>
            ))}
          </select>
          <input
            className={accountingInputClass}
            placeholder="Subtype (optional)"
            value={subtype}
            onChange={(event) => setSubtype(event.target.value)}
          />
          <input
            className={accountingInputClass}
            placeholder="Code (optional — generated automatically)"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          {createMutation.isError ? (
            <p className="text-xs text-red-400">{(createMutation.error as Error).message}</p>
          ) : null}
        </AccountingFormPanel>
      ) : null}

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
