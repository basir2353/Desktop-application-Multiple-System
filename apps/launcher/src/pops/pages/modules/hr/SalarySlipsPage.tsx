import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { SalarySlip } from "@platform/contracts";
import { fetchHrPayrollRuns, fetchSalarySlips } from "../../../api/hr";
import { formatPkr, useHrAccess } from "../../../hooks/useHr";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { HrError, HrLoading } from "./HrUi";

export function SalarySlipsPage(): JSX.Element {
  const { branch } = useHrAccess();

  const slipsQuery = useQuery({
    queryKey: ["hr", "salary-slips", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchSalarySlips(branch!.code),
  });

  const payrollQuery = useQuery({
    queryKey: ["hr", "payroll", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchHrPayrollRuns(branch!.code),
  });

  if (slipsQuery.isLoading) return <HrLoading />;
  if (slipsQuery.isError) return <HrError message={(slipsQuery.error as Error).message} />;

  const slips = slipsQuery.data ?? [];
  const payrollRuns = payrollQuery.data ?? [];
  const paidSlips = slips.filter((s) => s.payrollStatus === "paid");
  const isMonitoringBranch = branch?.code === "HQ-01";

  function printSlip(slip: SalarySlip): void {
    const html = `<!DOCTYPE html><html><head><title>Salary slip ${slip.payrollRef}</title>
<style>body{font-family:sans-serif;padding:24px;max-width:480px;margin:0 auto}
h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}
td{padding:6px 0;border-bottom:1px solid #eee}.total{font-weight:bold;font-size:16px}</style></head>
<body><h1>Salary slip</h1>
<p><strong>${slip.employeeName}</strong> (${slip.employeeCode})<br>${slip.jobTitle}</p>
<p>Period: ${slip.periodStart} — ${slip.periodEnd}<br>Ref: ${slip.payrollRef}</p>
<table>
<tr><td>Gross pay</td><td align="right">${formatPkr(slip.grossPkr)}</td></tr>
<tr><td>Deductions (EOBI/tax)</td><td align="right">− ${formatPkr(slip.deductionsPkr)}</td></tr>
<tr><td>Overtime</td><td align="right">${formatPkr(slip.overtimePkr)}</td></tr>
<tr class="total"><td>Net pay</td><td align="right">${formatPkr(slip.netPkr)}</td></tr>
</table></body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salary slips"
        subtitle="One slip per employee per payroll run. Print after payroll is paid, or preview draft/approved runs."
        actions={
          <Link
            to="/pops/hr/payroll"
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500"
          >
            Payroll runs
          </Link>
        }
      />

      {branch ? (
        <p className="text-xs text-slate-500">
          Branch: <span className="text-slate-300">{branch.name}</span> ({branch.code})
          {isMonitoringBranch ? (
            <span className="ml-2 text-amber-400/90">
              — Run payroll on this branch or switch to a store branch (e.g. ISB-GT).
            </span>
          ) : null}
        </p>
      ) : null}

      {slips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
          {payrollRuns.length === 0 ? (
            <>
              <p>No payroll runs for this branch yet.</p>
              <Link to="/pops/hr/payroll" className="mt-2 inline-block text-amber-400/90 hover:text-amber-300">
                Go to Payroll runs → create, approve, and pay
              </Link>
            </>
          ) : (
            <>
              <p>
                {payrollRuns.length} payroll run{payrollRuns.length === 1 ? "" : "s"} exist but no employee
                slips could be built. Add employees under HR → Employees, then re-run payroll.
              </p>
              <Link to="/pops/hr/employees" className="mt-2 inline-block text-amber-400/90 hover:text-amber-300">
                Manage employees
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          {paidSlips.length === 0 ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Showing preview slips — mark payroll as <strong>Paid</strong> on Payroll runs to finalize.
            </p>
          ) : null}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
            <SimpleTable
              rowKey={(r) => String(r.id)}
              columns={[
                { key: "payrollRef", header: "Payroll ref" },
                { key: "employeeCode", header: "ID" },
                { key: "employeeName", header: "Employee" },
                { key: "jobTitle", header: "Role" },
                {
                  key: "periodStart",
                  header: "Period",
                  render: (r) => `${String(r.periodStart)} — ${String(r.periodEnd)}`,
                },
                { key: "netPkr", header: "Net pay", render: (r) => formatPkr(Number(r.netPkr)) },
                {
                  key: "payrollStatus",
                  header: "Payroll",
                  render: (r) => (
                    <Badge
                      tone={
                        r.payrollStatus === "paid"
                          ? "success"
                          : r.payrollStatus === "approved"
                            ? "info"
                            : "warning"
                      }
                    >
                      {String(r.payrollStatus)}
                    </Badge>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (r) => (
                    <button
                      type="button"
                      className="text-xs text-amber-400 hover:text-amber-200"
                      onClick={() => printSlip(slips.find((s: SalarySlip) => s.id === r.id)!)}
                    >
                      Print slip
                    </button>
                  ),
                },
              ]}
              rows={slips as unknown as Record<string, unknown>[]}
            />
          </div>
        </>
      )}
    </div>
  );
}
