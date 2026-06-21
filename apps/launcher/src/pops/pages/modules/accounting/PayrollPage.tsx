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
import { AccountingError, AccountingFormPanel, AccountingLoading } from "./AccountingUi";

export function PayrollPage(): JSX.Element {
  const { branch, canManage } = useAccountingAccess();
  const queryClient = useQueryClient();
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("0");
  const [staffCount, setStaffCount] = useState("");

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
    mutationFn: payPayrollRun,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["accounting"] }),
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
        subtitle="Accounting view of payroll journal entries. Create runs from HR → Payroll runs."
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
            { key: "totalNet", header: "Net", render: (r) => formatPkr(Number(r.totalNet)) },
            { key: "staffCount", header: "Staff" },
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
                      <button type="button" className="text-xs text-emerald-400" onClick={() => payMutation.mutate(String(r.id))}>
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
    </div>
  );
}
