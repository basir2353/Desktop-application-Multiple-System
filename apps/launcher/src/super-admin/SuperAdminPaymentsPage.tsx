import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchLicencePayments,
  fetchMonthlyLicenceStatus,
  sendLicenceReminders,
} from "../lib/platformApi";
import { headingClass, mutedClass } from "../pops/lib/themeClasses";

function formatPkr(n: number): string {
  return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
}

export function SuperAdminPaymentsPage(): JSX.Element {
  const qc = useQueryClient();
  const monthly = useQuery({
    queryKey: ["platform", "licence-monthly"],
    queryFn: () => fetchMonthlyLicenceStatus(),
  });
  const payments = useQuery({
    queryKey: ["platform", "licence-payments"],
    queryFn: () => fetchLicencePayments(),
  });
  const [msg, setMsg] = useState<string | null>(null);

  const remindMut = useMutation({
    mutationFn: () => sendLicenceReminders({ mode: "all", force: true }),
    onSuccess: async (result) => {
      setMsg(`Reminders: ${result.sent} sent · ${result.skipped} skipped · ${result.failed} failed`);
      await qc.invalidateQueries({ queryKey: ["platform", "licence-monthly"] });
    },
    onError: (err: Error) => setMsg(err.message),
  });

  const m = monthly.data;
  const recent = (payments.data ?? []).slice(0, 25);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${headingClass}`}>Payments</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            Licence revenue for {m?.periodLabel ?? "this month"} (Asia/Karachi).
          </p>
        </div>
        <Button type="button" disabled={remindMut.isPending} onClick={() => remindMut.mutate()}>
          Send payment reminders
        </Button>
      </div>

      {msg ? (
        <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-[#111827]">
          {msg}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Collected" value={m ? formatPkr(m.totalCollected) : "…"} />
        <Stat label="Paid businesses" value={String(m?.paidCount ?? "…")} />
        <Stat label="Unpaid" value={String(m?.unpaidCount ?? "…")} warn={(m?.unpaidCount ?? 0) > 0} />
        <Stat label="Currency" value={m?.currency ?? "PKR"} />
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <h3 className="text-sm font-semibold">Unpaid this month</h3>
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {(m?.unpaid ?? []).length === 0 ? (
              <li className={`px-4 py-6 text-sm ${mutedClass}`}>All clear.</li>
            ) : (
              (m?.unpaid ?? []).map((row) => (
                <li key={row.organizationId} className="px-4 py-3">
                  <Link
                    to={`/super-admin/businesses/${row.organizationId}`}
                    className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                  >
                    {row.businessName}
                  </Link>
                  <p className={`text-xs ${mutedClass}`}>
                    {row.adminEmail ?? "—"} · {row.licencePlan ?? "no plan"}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <h3 className="text-sm font-semibold">Recent payments</h3>
          </div>
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {recent.length === 0 ? (
              <li className={`px-4 py-6 text-sm ${mutedClass}`}>No payments recorded.</li>
            ) : (
              recent.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{p.businessName ?? p.organizationId.slice(0, 8)}</p>
                    <p className={`text-xs ${mutedClass}`}>
                      {new Date(p.paidAt).toLocaleString()} · {p.periodDays}d
                      {p.paidByLabel ? ` · ${p.paidByLabel}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatPkr(p.amount)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <p className={`text-xs ${mutedClass}`}>
        Full licence grant / module tools live under{" "}
        <Link to="/super-admin/licences" className="text-teal-700 underline dark:text-teal-300">
          Licences
        </Link>
        .
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}): JSX.Element {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warn
          ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          : "border-slate-200 bg-white border-slate-200 bg-white"
      }`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
