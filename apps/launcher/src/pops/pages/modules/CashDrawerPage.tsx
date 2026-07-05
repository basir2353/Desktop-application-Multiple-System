import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  closeCashSession,
  fetchCashMovements,
  fetchCashSessions,
  fetchOpenCashSession,
  openCashSession,
  recordCashMovement,
} from "../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../hooks/useAccounting";
import { noticeErrorClass } from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import { AccountingError, AccountingFormPanel, AccountingLoading, StatCard } from "./accounting/AccountingUi";

export function CashDrawerPage(): JSX.Element {
  const { branch, canOperateDrawer } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [paidType, setPaidType] = useState<"paid_in" | "paid_out">("paid_in");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidReason, setPaidReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openSessionQuery = useQuery({
    queryKey: ["accounting", "cash-session-open", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchOpenCashSession(branch!.code),
  });

  const sessionsQuery = useQuery({
    queryKey: ["accounting", "cash-sessions", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCashSessions(branch!.code),
  });

  const openSession = openSessionQuery.data;

  const movementsQuery = useQuery({
    queryKey: ["accounting", "cash-movements", openSession?.id],
    enabled: Boolean(openSession?.id),
    queryFn: () => fetchCashMovements(openSession!.id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["accounting"] });
  };

  const openMutation = useMutation({
    mutationFn: () =>
      openCashSession({ branchCode: branch!.code, openingFloat: Number(openingFloat) || 0 }),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      closeCashSession(openSession!.id, { countedCash: Number(countedCash) }),
    onSuccess: () => {
      invalidate();
      setCountedCash("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const movementMutation = useMutation({
    mutationFn: () =>
      recordCashMovement({
        branchCode: branch!.code,
        sessionId: openSession!.id,
        type: paidType,
        amountPkr: Number(paidAmount),
        reason: paidReason.trim(),
      }),
    onSuccess: () => {
      invalidate();
      setPaidAmount("");
      setPaidReason("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (openSessionQuery.isLoading || sessionsQuery.isLoading) return <AccountingLoading label="Loading cash drawer…" />;
  if (openSessionQuery.isError) {
    return <AccountingError message={(openSessionQuery.error as Error).message} />;
  }
  if (sessionsQuery.isError) {
    return <AccountingError message={(sessionsQuery.error as Error).message} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash drawer"
        subtitle="Pay in, pay out, and cashier out for the active shift."
      />

      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {openSession ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Active session — {openSession.sessionRef}
            </h2>
            <Badge tone="success">Open</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Opened by {openSession.openedBy} at {new Date(openSession.openedAt).toLocaleString()}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Opening float" value={formatPkr(openSession.openingFloat)} />
            <StatCard label="Cash sales" value={formatPkr(openSession.cashSales)} />
            <StatCard label="Pay in / out" value={formatPkr(openSession.cashAdjustments)} />
            <StatCard label="Expected in drawer" value={formatPkr(openSession.liveExpectedCash)} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <AccountingFormPanel
              title="Pay in"
              submitLabel="Record pay in"
              disabled={movementMutation.isPending || paidType !== "paid_in" || !paidAmount || !paidReason.trim()}
              onSubmit={() => {
                setPaidType("paid_in");
                movementMutation.mutate();
              }}
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add cash to the drawer (e.g. change deposit, petty cash top-up).
              </p>
              <input
                className={accountingInputClass}
                type="number"
                min={1}
                placeholder="Amount (PKR)"
                value={paidType === "paid_in" ? paidAmount : ""}
                onChange={(e) => {
                  setPaidType("paid_in");
                  setPaidAmount(e.target.value);
                }}
              />
              <input
                className={accountingInputClass}
                placeholder="Reason"
                value={paidType === "paid_in" ? paidReason : ""}
                onChange={(e) => {
                  setPaidType("paid_in");
                  setPaidReason(e.target.value);
                }}
              />
            </AccountingFormPanel>

            <AccountingFormPanel
              title="Pay out"
              submitLabel="Record pay out"
              disabled={movementMutation.isPending || paidType !== "paid_out" || !paidAmount || !paidReason.trim()}
              onSubmit={() => {
                setPaidType("paid_out");
                movementMutation.mutate();
              }}
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Remove cash from the drawer (e.g. vendor payment, expense).
              </p>
              <input
                className={accountingInputClass}
                type="number"
                min={1}
                placeholder="Amount (PKR)"
                value={paidType === "paid_out" ? paidAmount : ""}
                onChange={(e) => {
                  setPaidType("paid_out");
                  setPaidAmount(e.target.value);
                }}
              />
              <input
                className={accountingInputClass}
                placeholder="Reason"
                value={paidType === "paid_out" ? paidReason : ""}
                onChange={(e) => {
                  setPaidType("paid_out");
                  setPaidReason(e.target.value);
                }}
              />
            </AccountingFormPanel>
          </div>

          {(movementsQuery.data ?? []).length > 0 ? (
            <ul className="mt-4 space-y-1 border-t border-emerald-500/20 pt-4 text-xs text-slate-600 dark:text-slate-400">
              {(movementsQuery.data ?? []).map((m) => (
                <li key={m.id}>
                  {m.type === "paid_in" ? "+" : "−"}
                  {formatPkr(m.amountPkr)} — {m.reason}
                  <span className="ml-2 text-slate-400">
                    {new Date(m.createdAt).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {canOperateDrawer ? (
            <AccountingFormPanel
              title="Cashier out"
              submitLabel="Close shift & reconcile"
              disabled={closeMutation.isPending || !countedCash}
              onSubmit={() => closeMutation.mutate()}
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Count the cash in the drawer and close the session. Expected:{" "}
                {formatPkr(openSession.liveExpectedCash)}.
              </p>
              <input
                className={accountingInputClass}
                type="number"
                min={0}
                placeholder="Counted cash (PKR)"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
              />
            </AccountingFormPanel>
          ) : null}
        </div>
      ) : canOperateDrawer ? (
        <AccountingFormPanel
          title="Open cash drawer"
          submitLabel="Start shift"
          disabled={openMutation.isPending}
          onSubmit={() => openMutation.mutate()}
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter the opening float before taking cash payments.
          </p>
          <input
            className={accountingInputClass}
            type="number"
            min={0}
            placeholder="Opening float (PKR)"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
        </AccountingFormPanel>
      ) : (
        <p className="text-sm text-slate-500">No cash session is open. Ask a supervisor to open the drawer.</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Recent sessions</h3>
        <SimpleTable
          rowKey={(r) => String(r.sessionRef)}
          columns={[
            { key: "sessionRef", header: "Session" },
            { key: "openedBy", header: "Opened by" },
            { key: "openingFloat", header: "Float", render: (r) => formatPkr(Number(r.openingFloat)) },
            {
              key: "expectedCash",
              header: "Expected",
              render: (r) => (r.expectedCash != null ? formatPkr(Number(r.expectedCash)) : "—"),
            },
            {
              key: "countedCash",
              header: "Counted",
              render: (r) => (r.countedCash != null ? formatPkr(Number(r.countedCash)) : "—"),
            },
            {
              key: "variance",
              header: "Variance",
              render: (r) => (r.variance != null ? formatPkr(Number(r.variance)) : "—"),
            },
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
