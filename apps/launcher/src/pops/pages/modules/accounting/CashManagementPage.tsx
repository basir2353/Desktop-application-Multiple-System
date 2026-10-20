import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { closeCashSession, fetchCashSessions, openCashSession } from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

export function CashManagementPage(): JSX.Element {
  const { branch, canOperateDrawer } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["accounting", "cash-sessions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCashSessions(branch!.code),
  });

  const openMutation = useMutation({
    mutationFn: openCashSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounting"] }),
  });

  const closeMutation = useMutation({
    mutationFn: ({ sessionId, counted }: { sessionId: string; counted: number }) =>
      closeCashSession(sessionId, { countedCash: counted }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setCountedCash("");
    },
  });

  if (sessionsQuery.isLoading) return <AccountingLoading />;
  if (sessionsQuery.isError) return <AccountingError message={(sessionsQuery.error as Error).message} />;

  const openSession = sessionsQuery.data!.find((s) => s.status === "open");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash management"
        subtitle="Cash Register (1101) drawer — set opening balance, run the shift, then close with counted cash."
      />

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100/90">
        <p className="font-semibold text-emerald-200">Cash account flow</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-emerald-100/80">
          <li>Open shift with opening float (posts JV to Cash Register + Owner Equity).</li>
          <li>POS cash sales and expenses update the same cash account.</li>
          <li>Close shift with counted cash — variance posts automatically.</li>
        </ol>
      </div>

      {canOperateDrawer && !openSession ? (
        <AccountingFormPanel
          title="Open cash drawer — Cash Register opening balance"
          submitLabel="Open shift & post opening balance"
          disabled={openMutation.isPending}
          onSubmit={() => {
            if (!branch?.code) return;
            openMutation.mutate({ branchCode: branch.code, openingFloat: Number(openingFloat) || 0 });
          }}
        >
          <label className="block text-xs text-slate-400">
            Opening float / opening balance (PKR)
            <input
              className={`${accountingInputClass} mt-1`}
              placeholder="e.g. 5000"
              type="number"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
            />
          </label>
          <p className="text-[11px] text-slate-500">
            Amount 0 = open drawer with empty float. Amount &gt; 0 creates a journal voucher for Cash
            Register opening balance.
          </p>
          {openMutation.isError ? (
            <p className="text-xs text-red-400">{(openMutation.error as Error).message}</p>
          ) : null}
        </AccountingFormPanel>
      ) : null}

      {canOperateDrawer && openSession ? (
        <AccountingFormPanel
          title={`Close session ${openSession.sessionRef}`}
          submitLabel="Close shift"
          disabled={closeMutation.isPending || !countedCash}
          onSubmit={() => closeMutation.mutate({ sessionId: openSession.id, counted: Number(countedCash) })}
        >
          <p className="text-xs text-slate-400">
            Opening float: {formatPkr(Number(openSession.openingFloat))}
            {openSession.expectedCash != null
              ? ` · Expected now: ${formatPkr(Number(openSession.expectedCash))}`
              : ""}
          </p>
          <input
            className={accountingInputClass}
            placeholder="Counted cash (PKR)"
            type="number"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
          />
        </AccountingFormPanel>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.sessionRef)}
          columns={[
            { key: "sessionRef", header: "Session" },
            { key: "openedBy", header: "Opened by" },
            { key: "openingFloat", header: "Float", render: (r) => formatPkr(Number(r.openingFloat)) },
            { key: "expectedCash", header: "Expected", render: (r) => (r.expectedCash != null ? formatPkr(Number(r.expectedCash)) : "—") },
            { key: "countedCash", header: "Counted", render: (r) => (r.countedCash != null ? formatPkr(Number(r.countedCash)) : "—") },
            { key: "variance", header: "Variance", render: (r) => (r.variance != null ? formatPkr(Number(r.variance)) : "—") },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "open" ? "warning" : "success"}>{String(r.status)}</Badge>
              ),
            },
          ]}
          rows={sessionsQuery.data! as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
