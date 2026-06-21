import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEmployee,
  fetchEmployees,
  syncEmployeesFromUsers,
  updateEmployee,
} from "../../../api/hr";
import { formatPkr, hrInputClass, useHrAccess } from "../../../hooks/useHr";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { HrError, HrFormPanel, HrLoading } from "./HrUi";

export function EmployeesPage(): JSX.Element {
  const { branch, canManage } = useHrAccess();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    employeeCode: "",
    displayName: "",
    jobTitle: "",
    shiftLabel: "",
    baseSalaryPkr: "",
  });

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEmployees(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      setForm({ employeeCode: "", displayName: "", jobTitle: "", shiftLabel: "", baseSalaryPkr: "" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncEmployeesFromUsers(branch!.code),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr"] }),
  });

  const terminateMutation = useMutation({
    mutationFn: (id: string) => updateEmployee(id, { employmentStatus: "terminated" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["hr"] }),
  });

  if (employeesQuery.isLoading) return <HrLoading />;
  if (employeesQuery.isError) return <HrError message={(employeesQuery.error as Error).message} />;

  const employees = employeesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employees"
        subtitle="Staff records linked to branch users. Sync from Users & access or add manually."
      />

      {canManage ? (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={syncMutation.isPending || !branch?.code}
              onClick={() => syncMutation.mutate()}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-indigo-500/40 hover:text-white disabled:opacity-50"
            >
              Sync from users
            </button>
          </div>

          <HrFormPanel
            title="Add employee"
            submitLabel="Create employee"
            disabled={
              createMutation.isPending ||
              !form.employeeCode ||
              !form.displayName ||
              !form.jobTitle ||
              !form.baseSalaryPkr ||
              !branch?.code
            }
            onSubmit={() => {
              if (!branch?.code) return;
              createMutation.mutate({
                branchCode: branch.code,
                employeeCode: form.employeeCode,
                displayName: form.displayName,
                jobTitle: form.jobTitle,
                shiftLabel: form.shiftLabel || undefined,
                baseSalaryPkr: Number(form.baseSalaryPkr),
              });
            }}
          >
            <input className={hrInputClass} placeholder="Employee code (E102)" value={form.employeeCode} onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))} />
            <input className={hrInputClass} placeholder="Full name" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            <input className={hrInputClass} placeholder="Job title" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} />
            <input className={hrInputClass} placeholder="Shift (2pm–10pm)" value={form.shiftLabel} onChange={(e) => setForm((f) => ({ ...f, shiftLabel: e.target.value }))} />
            <input className={hrInputClass} placeholder="Base salary (PKR)" type="number" value={form.baseSalaryPkr} onChange={(e) => setForm((f) => ({ ...f, baseSalaryPkr: e.target.value }))} />
          </HrFormPanel>
        </>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          columns={[
            { key: "employeeCode", header: "ID" },
            { key: "displayName", header: "Name" },
            { key: "jobTitle", header: "Role" },
            { key: "shiftLabel", header: "Shift", render: (r) => String(r.shiftLabel ?? "—") },
            { key: "baseSalaryPkr", header: "Salary", render: (r) => formatPkr(Number(r.baseSalaryPkr)) },
            {
              key: "employmentStatus",
              header: "Status",
              render: (r) => (
                <Badge tone={r.employmentStatus === "active" ? "success" : r.employmentStatus === "on_leave" ? "warning" : "neutral"}>
                  {String(r.employmentStatus)}
                </Badge>
              ),
            },
            {
              key: "userId",
              header: "User link",
              render: (r) => (r.userId ? <span className="text-xs text-emerald-400">Linked</span> : <span className="text-xs text-slate-500">—</span>),
            },
            {
              key: "actions",
              header: "",
              render: (r) =>
                canManage && r.employmentStatus === "active" ? (
                  <button
                    type="button"
                    className="text-xs text-red-400"
                    onClick={() => terminateMutation.mutate(String(r.id))}
                  >
                    Terminate
                  </button>
                ) : null,
            },
          ]}
          rows={employees as unknown as Record<string, unknown>[]}
        />
      </div>
    </div>
  );
}
