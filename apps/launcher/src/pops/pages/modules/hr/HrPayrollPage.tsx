import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Employee } from "@platform/contracts";
import {
  approveHrPayrollRun,
  createHrPayrollRun,
  deleteHrPayrollRun,
  fetchEmployees,
  fetchHrPayrollRun,
  fetchHrPayrollRuns,
  payHrPayrollRun,
} from "../../../api/hr";
import { formatPkr, hrInputClass, useHrAccess } from "../../../hooks/useHr";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { HrError, HrLoading } from "./HrUi";

const DEDUCTION_RATE = 0.0727;

type StaffLine = {
  employeeId: string;
  selected: boolean;
  grossPkr: number;
  overtimePkr: number;
  deductionsPkr: number;
};

function buildStaffLines(employees: Employee[]): StaffLine[] {
  return employees
    .filter((e) => e.employmentStatus === "active" || e.employmentStatus === "on_leave")
    .map((e) => ({
      employeeId: e.id,
      selected: true,
      grossPkr: e.baseSalaryPkr,
      overtimePkr: 0,
      deductionsPkr: Math.round(e.baseSalaryPkr * DEDUCTION_RATE),
    }));
}

export function HrPayrollPage(): JSX.Element {
  const { branch, canManage, canApprovePayroll } = useHrAccess();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const defaultPeriodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(now.toISOString().slice(0, 10));
  const [staffLines, setStaffLines] = useState<StaffLine[]>([]);

  const employeesQuery = useQuery({
    queryKey: ["hr", "employees", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEmployees(branch!.code),
  });

  const payrollQuery = useQuery({
    queryKey: ["hr", "payroll", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchHrPayrollRuns(branch!.code),
  });

  const detailQuery = useQuery({
    queryKey: ["hr", "payroll", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => fetchHrPayrollRun(selectedId!),
  });

  useEffect(() => {
    if (employeesQuery.data) {
      setStaffLines(buildStaffLines(employeesQuery.data));
    }
  }, [employeesQuery.data]);

  const selectedLines = useMemo(() => staffLines.filter((l) => l.selected), [staffLines]);
  const previewTotals = useMemo(() => {
    const gross = selectedLines.reduce((s, l) => s + l.grossPkr + l.overtimePkr, 0);
    const deductions = selectedLines.reduce((s, l) => s + l.deductionsPkr, 0);
    return { gross, deductions, net: gross - deductions, count: selectedLines.length };
  }, [selectedLines]);

  const createMutation = useMutation({
    mutationFn: createHrPayrollRun,
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setSelectedId(run.id);
      setShowCreate(false);
      setNotice(`Created ${run.payrollRef} for ${run.staffCount} staff. Approve then Pay to finalize.`);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: approveHrPayrollRun,
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setNotice(`${run.payrollRef} approved — journal entry posted to accounting.`);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const payMutation = useMutation({
    mutationFn: payHrPayrollRun,
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setNotice(`${run.payrollRef} paid — salary slips are ready to print.`);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteHrPayrollRun,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
      void queryClient.invalidateQueries({ queryKey: ["accounting"] });
      setSelectedId(null);
      setNotice("Draft payroll deleted.");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  function updateLine(employeeId: string, patch: Partial<StaffLine>): void {
    setStaffLines((lines) =>
      lines.map((l) => (l.employeeId === employeeId ? { ...l, ...patch } : l)),
    );
  }

  function toggleAll(selected: boolean): void {
    setStaffLines((lines) => lines.map((l) => ({ ...l, selected })));
  }

  function handleCreatePayroll(): void {
    if (!branch?.code || selectedLines.length === 0) return;
    setError(null);
    createMutation.mutate({
      branchCode: branch.code,
      periodStart,
      periodEnd,
      employees: selectedLines.map((l) => ({
        employeeId: l.employeeId,
        grossPkr: l.grossPkr,
        overtimePkr: l.overtimePkr,
        deductionsPkr: l.deductionsPkr,
      })),
    });
  }

  if (payrollQuery.isLoading || employeesQuery.isLoading) return <HrLoading />;
  if (payrollQuery.isError) return <HrError message={(payrollQuery.error as Error).message} />;

  const runs = payrollQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const detail = detailQuery.data;
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payroll runs"
        subtitle="Select staff, set amounts, create a run, then approve and pay."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                setShowCreate((v) => !v);
                setError(null);
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
            >
              {showCreate ? "Close" : "Create payroll"}
            </button>
          ) : null
        }
      />

      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      {showCreate && canManage ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">New payroll run</div>
              <p className="mt-0.5 text-xs text-slate-500">
                Choose which staff to pay this period. Adjust gross, overtime, or deductions per person.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button type="button" className="text-slate-400 hover:text-white" onClick={() => toggleAll(true)}>
                Select all
              </button>
              <span className="text-slate-600">·</span>
              <button type="button" className="text-slate-400 hover:text-white" onClick={() => toggleAll(false)}>
                Clear all
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-slate-500">
              Period from
              <input
                type="date"
                className={`${hrInputClass} mt-1 w-full`}
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-500">
              Period to
              <input
                type="date"
                className={`${hrInputClass} mt-1 w-full`}
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </label>
          </div>

          {employees.length === 0 ? (
            <p className="text-sm text-slate-500">
              No employees on this branch.{" "}
              <Link to="/pops/hr/employees" className="text-amber-400/90 hover:text-amber-300">
                Add employees first
              </Link>
              .
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Pay</th>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Gross (PKR)</th>
                    <th className="px-3 py-2">Overtime</th>
                    <th className="px-3 py-2">Deductions</th>
                    <th className="px-3 py-2">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {staffLines.map((line) => {
                    const emp = employeeById.get(line.employeeId);
                    if (!emp) return null;
                    const net = line.grossPkr - line.deductionsPkr + line.overtimePkr;
                    return (
                      <tr key={line.employeeId} className={line.selected ? "" : "opacity-50"}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={line.selected}
                            onChange={(e) => updateLine(line.employeeId, { selected: e.target.checked })}
                            className="rounded border-slate-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-200">{emp.displayName}</div>
                          <div className="text-xs text-slate-500">{emp.employeeCode}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-400">{emp.jobTitle}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            className={`${hrInputClass} w-28`}
                            value={line.grossPkr}
                            disabled={!line.selected}
                            onChange={(e) => {
                              const grossPkr = Number(e.target.value) || 0;
                              updateLine(line.employeeId, {
                                grossPkr,
                                deductionsPkr: Math.round(grossPkr * DEDUCTION_RATE),
                              });
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            className={`${hrInputClass} w-24`}
                            value={line.overtimePkr}
                            disabled={!line.selected}
                            onChange={(e) =>
                              updateLine(line.employeeId, { overtimePkr: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            className={`${hrInputClass} w-24`}
                            value={line.deductionsPkr}
                            disabled={!line.selected}
                            onChange={(e) =>
                              updateLine(line.employeeId, { deductionsPkr: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-emerald-300/90">{formatPkr(net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
            <dl className="flex flex-wrap gap-4 text-xs text-slate-400">
              <div>
                <dt>Staff selected</dt>
                <dd className="text-sm font-semibold text-white">{previewTotals.count}</dd>
              </div>
              <div>
                <dt>Gross + overtime</dt>
                <dd className="text-sm font-semibold text-white">{formatPkr(previewTotals.gross)}</dd>
              </div>
              <div>
                <dt>Deductions</dt>
                <dd className="text-sm font-semibold text-white">{formatPkr(previewTotals.deductions)}</dd>
              </div>
              <div>
                <dt>Net pay</dt>
                <dd className="text-sm font-semibold text-emerald-300">{formatPkr(previewTotals.net)}</dd>
              </div>
            </dl>
            <button
              type="button"
              disabled={createMutation.isPending || selectedLines.length === 0 || !branch?.code}
              onClick={handleCreatePayroll}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating…" : `Create payroll (${previewTotals.count} staff)`}
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        Journal entries appear under{" "}
        <Link to="/pops/accounting/payroll" className="text-amber-400/90 hover:text-amber-300">
          Accounting → Payroll
        </Link>
        . Workflow: <strong className="text-slate-400">Create</strong> →{" "}
        <strong className="text-slate-400">Approve</strong> →{" "}
        <strong className="text-slate-400">Pay</strong> → Salary slips.
      </p>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          rows={runs as unknown as Record<string, unknown>[]}
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
              render: (r) => (
                <span className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-white"
                    onClick={() => setSelectedId(String(r.id))}
                  >
                    Lines
                  </button>
                  {canApprovePayroll && r.status === "draft" ? (
                    <>
                      <button
                        type="button"
                        className="text-xs text-emerald-400"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate(String(r.id))}
                      >
                        Approve
                      </button>
                      {canManage ? (
                        <button
                          type="button"
                          className="text-xs text-red-400/80 hover:text-red-300"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(String(r.id))}
                        >
                          Delete
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  {canApprovePayroll && r.status === "approved" ? (
                    <button
                      type="button"
                      className="text-xs text-emerald-400"
                      disabled={payMutation.isPending}
                      onClick={() => payMutation.mutate(String(r.id))}
                    >
                      Pay
                    </button>
                  ) : null}
                  {r.status === "paid" ? (
                    <Link to="/pops/hr/salary-slips" className="text-xs text-amber-400/90 hover:text-amber-300">
                      Slips
                    </Link>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </div>

      {selectedId && detail ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">{detail.payrollRef} — employee lines</div>
          <div className="mt-3">
            <SimpleTable
              rowKey={(r) => String(r.id)}
              rows={(detail.lines ?? []) as unknown as Record<string, unknown>[]}
              columns={[
                { key: "employeeCode", header: "ID" },
                { key: "employeeName", header: "Name" },
                { key: "grossPkr", header: "Gross", render: (r) => formatPkr(Number(r.grossPkr)) },
                { key: "deductionsPkr", header: "Deductions", render: (r) => formatPkr(Number(r.deductionsPkr)) },
                { key: "overtimePkr", header: "Overtime", render: (r) => formatPkr(Number(r.overtimePkr)) },
                { key: "netPkr", header: "Net", render: (r) => formatPkr(Number(r.netPkr)) },
              ]}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
