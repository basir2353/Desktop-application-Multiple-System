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
      <PageHeader title="Cash management" subtitle="Cash drawer opening, closing, and variance reports." />

      {canOperateDrawer && !openSession ? (
        <AccountingFormPanel
          title="Open cash drawer"
          submitLabel="Open shift"
          disabled={openMutation.isPending}
          onSubmit={() => {
            if (!branch?.code) return;
            openMutation.mutate({ branchCode: branch.code, openingFloat: Number(openingFloat) || 0 });
          }}
        >
          <input className={accountingInputClass} placeholder="Opening float (PKR)" type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
        </AccountingFormPanel>
      ) : null}

      {canOperateDrawer && openSession ? (
        <AccountingFormPanel
          title={`Close session ${openSession.sessionRef}`}
          submitLabel="Close shift"
          disabled={closeMutation.isPending || !countedCash}
          onSubmit={() => closeMutation.mutate({ sessionId: openSession.id, counted: Number(countedCash) })}
        >
          <input className={accountingInputClass} placeholder="Counted cash (PKR)" type="number" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
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
