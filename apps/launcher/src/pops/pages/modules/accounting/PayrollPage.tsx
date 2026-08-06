import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approvePayrollRun,
  createPayrollRun,
  fetchPayrollRuns,
  payPayrollRun,
} from "../../../api/accounting";
import {
  accountingInputClass,
  formatPkr,
  useAccountingAccess,
} from "../../../hooks/useAccounting";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { modalBackdropRaisedClass } from "../../../lib/themeClasses";
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PayrollPage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [staffCount, setStaffCount] = useState("");
  const [payTarget, setPayTarget] = useState<{ id: string; ref: string } | null>(null);
  const [payAtLocal, setPayAtLocal] = useState(() => toDatetimeLocalValue(new Date()));

  const payrollQuery = useQuery({
    queryKey: ["accounting", "payroll", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchPayrollRuns(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createPayrollRun,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setGross("");
      setDeductions("0");
      setStaffCount("");
    },
  });

  const approveMutation = useMutation({
    mutationFn: approvePayrollRun,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounting"] }),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, paidAt }: { id: string; paidAt: string }) => payPayrollRun(id, { paidAt }),
    onSuccess: () => {
      setPayTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
    },
  });

  if (payrollQuery.isLoading) return <AccountingLoading />;
  if (payrollQuery.isError) return <AccountingError message={(payrollQuery.error as Error).message} />;

  const now = new Date();
  const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const periodEnd = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll management"
        subtitle="Accounting view of payroll journal entries. Create runs from HR → Payroll runs. Pay posts bank JV with pay date/time."
      />

      {canManage ? (
        <AccountingFormPanel
          title="Create payroll run"
          submitLabel="Create draft"
          disabled={createMutation.isPending || !gross || !staffCount}
          onSubmit={() => {
            if (!branch?.code) return;
            createMutation.mutate({
              branchCode: branch.code,
              periodStart,
              periodEnd,
              totalGross: Number(gross),
              totalDeductions: Number(deductions) || 0,
              staffCount: Number(staffCount),
            });
          }}
        >
          <input className={accountingInputClass} placeholder="Total gross (PKR)" type="number" value={gross} onChange={(e) => setGross(e.target.value)} />
          <input className={accountingInputClass} placeholder="Deductions (PKR)" type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
          <input className={accountingInputClass} placeholder="Staff count" type="number" value={staffCount} onChange={(e) => setStaffCount(e.target.value)} />
        </AccountingFormPanel>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.payrollRef)}
          columns={[
            { key: "payrollRef", header: "Ref" },
            { key: "periodStart", header: "From" },
            { key: "periodEnd", header: "To" },
            { key: "totalGross", header: "Gross", render: (r) => formatPkr(Number(r.totalGross)) },
            {
              key: "totalNet",
              header: "Baqaya",
              render: (r) => {
                const net = Number(r.totalNet);
                return (
                  <span className={net < 0 ? "text-red-400" : undefined}>{formatPkr(net)}</span>
                );
              },
            },
            { key: "staffCount", header: "Staff" },
            {
              key: "paidAt",
              header: "Paid at",
              render: (r) =>
                r.paidAt
                  ? new Date(String(r.paidAt)).toLocaleString("en-PK", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "—",
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "paid" ? "success" : r.status === "approved" ? "info" : "warning"}>
                  {String(r.status)}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (r) =>
                canManage ? (
                  <span className="flex gap-2">
                    {r.status === "draft" ? (
                      <button type="button" className="text-xs text-emerald-400" onClick={() => approveMutation.mutate(String(r.id))}>
                        Approve
                      </button>
                    ) : null}
                    {r.status === "approved" ? (
                      <button
                        type="button"
                        className="text-xs text-emerald-400"
                        onClick={() => {
                          setPayAtLocal(toDatetimeLocalValue(new Date()));
                          setPayTarget({ id: String(r.id), ref: String(r.payrollRef) });
                        }}
                      >
                        Pay
                      </button>
                    ) : null}
                  </span>
                ) : null,
            },
          ]}
          rows={payrollQuery.data! as unknown as Record<string, unknown>[]}
        />
      </div>

      {payTarget ? (
        <div className={modalBackdropRaisedClass} role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-950 p-4 shadow-xl">
            <div className="text-sm font-medium text-white">Pay {payTarget.ref}</div>
            <p className="mt-1 text-xs text-slate-400">
              Date &amp; time ledger journal entry pe jayegi (Dr Salaries Payable / Cr Bank).
            </p>
            <label className="mt-3 block text-xs text-slate-500">
              Paid at
              <input
                type="datetime-local"
                className={`${accountingInputClass} mt-1 w-full`}
                value={payAtLocal}
                onChange={(e) => setPayAtLocal(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                onClick={() => setPayTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={payMutation.isPending || !payAtLocal}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                onClick={() =>
                  payMutation.mutate({
                    id: payTarget.id,
                    paidAt: new Date(payAtLocal).toISOString(),
                  })
                }
              >
                {payMutation.isPending ? "Paying…" : "Confirm pay"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
