import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchHrDashboard } from "../../../api/hr";
import { formatPkr, useHrAccess } from "../../../hooks/useHr";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { HrError, HrLoading } from "./HrUi";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function HrDashboardPage(): JSX.Element {
  const { branch } = useHrAccess();

  const dashboardQuery = useQuery({
    queryKey: ["hr", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchHrDashboard(branch!.code),
  });

  if (dashboardQuery.isLoading) return <HrLoading label="Loading HR dashboard…" />;
  if (dashboardQuery.isError) {
    return <HrError message={(dashboardQuery.error as Error).message} />;
  }

  const d = dashboardQuery.data!;
  const pay = d.payPeriodSummary;

  return (
    <div className="space-y-4">
      <PageHeader
        title="HR & payroll"
        subtitle="Attendance, shifts, leave, payroll runs, and salary slips — linked to users and accounting."
        actions={
          <>
            <Link to="/pops/hr/leave" className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800">
              Leave approvals
            </Link>
            <Link to="/pops/hr/payroll" className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500">
              Run payroll
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active employees" value={String(d.activeEmployees)} />
        <StatCard label="Present today" value={String(d.presentToday)} hint={`${d.lateToday} late · ${d.absentToday} absent`} />
        <StatCard label="Pending leave" value={String(d.pendingLeave)} />
        <StatCard
          label="Latest payroll"
          value={d.latestPayroll?.payrollRef ?? "—"}
          hint={d.latestPayroll ? d.latestPayroll.status : "No runs yet"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white">Today&apos;s attendance</div>
            <Link to="/pops/hr/attendance" className="text-xs text-amber-400/90 hover:text-amber-300">
              Manage
            </Link>
          </div>
          <div className="mt-3">
            <SimpleTable
              rowKey={(r) => String(r.id)}
              columns={[
                { key: "employeeCode", header: "ID" },
                { key: "employeeName", header: "Name" },
                { key: "jobTitle", header: "Role" },
                { key: "shiftLabel", header: "Shift", render: (r) => String(r.shiftLabel ?? "—") },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <Badge
                      tone={
                        r.status === "present"
                          ? "success"
                          : r.status === "late"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {String(r.status)}
                    </Badge>
                  ),
                },
              ]}
              rows={d.todaysAttendance as unknown as Record<string, unknown>[]}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white">
              Pay period {pay ? `${pay.periodStart} — ${pay.periodEnd}` : "—"}
            </div>
            <Link to="/pops/hr/salary-slips" className="text-xs text-amber-400/90 hover:text-amber-300">
              Salary slips
            </Link>
          </div>
          {pay ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <dt>Gross payroll</dt>
                <dd className="text-white">{formatPkr(pay.grossPkr)}</dd>
              </div>
              <div className="flex justify-between text-slate-400">
                <dt>EOBI / tax withholdings</dt>
                <dd className="text-white">{formatPkr(pay.deductionsPkr)}</dd>
              </div>
              <div className="flex justify-between text-slate-400">
                <dt>Overtime &amp; commissions</dt>
                <dd className="text-white">{formatPkr(pay.overtimePkr)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-medium text-white">
                <dt>Net pay ({pay.staffCount} staff)</dt>
                <dd>{formatPkr(pay.netPkr)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No payroll data yet.</p>
          )}
          <Link
            to="/pops/hr/payroll"
            className="mt-4 flex w-full items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-indigo-500/40 hover:text-white"
          >
            Generate salary slips
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-sm font-medium text-white">Quick links</div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { to: "/pops/hr/employees", label: "Employees" },
            { to: "/pops/hr/attendance", label: "Attendance" },
            { to: "/pops/hr/leave", label: "Leave" },
            { to: "/pops/hr/payroll", label: "Payroll runs" },
            { to: "/pops/accounting/payroll", label: "Accounting GL" },
          ].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 transition hover:border-amber-500/40 hover:text-amber-200"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
