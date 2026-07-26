import { Button } from "@platform/ui";
import { POPS_MODULE_ACCESS, SYSTEM_TYPE_LABELS } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchLicencePayments,
  fetchMonthlyLicenceStatus,
  fetchPlatformBusinesses,
  grantPlatformLicence,
  recordLicencePayment,
  sendLicenceReminders,
  updatePlatformBusiness,
} from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "No expiry set";
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const label = d.toLocaleDateString();
  if (days < 0) return `Expired ${label} (${Math.abs(days)}d ago)`;
  if (days === 0) return `Expires today (${label})`;
  return `Expires ${label} · ${days}d left`;
}

export function SuperAdminLicencesPage(): JSX.Element {
  const qc = useQueryClient();
  const businesses = useQuery({ queryKey: ["platform", "businesses"], queryFn: fetchPlatformBusinesses });
  const payments = useQuery({
    queryKey: ["platform", "licence-payments"],
    queryFn: () => fetchLicencePayments(),
  });
  const monthly = useQuery({
    queryKey: ["platform", "licence-monthly"],
    queryFn: () => fetchMonthlyLicenceStatus(),
  });

  const [monthTab, setMonthTab] = useState<"unpaid" | "paid">("unpaid");
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modulesDraft, setModulesDraft] = useState<string[] | null>(null);
  const [allModules, setAllModules] = useState(true);
  const [amount, setAmount] = useState("0");
  const [paidBy, setPaidBy] = useState("");
  const [note, setNote] = useState("");

  const saveModulesMut = useMutation({
    mutationFn: (businessId: string) =>
      updatePlatformBusiness(businessId, {
        enabledModules: allModules ? null : (modulesDraft ?? []),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["platform", "businesses"] });
    },
  });

  const grantMut = useMutation({
    mutationFn: (args: {
      businessId: string;
      days: 5 | 30;
      amount: number;
      paidByLabel?: string;
      note?: string;
    }) =>
      grantPlatformLicence(args.businessId, {
        days: args.days,
        plan: args.days === 5 ? "trial_5" : "monthly_30",
        recordPayment: true,
        amount: args.amount,
        currency: "PKR",
        paidByLabel: args.paidByLabel,
        note: args.note,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["platform", "businesses"] }),
        qc.invalidateQueries({ queryKey: ["platform", "licence-payments"] }),
        qc.invalidateQueries({ queryKey: ["platform", "licence-monthly"] }),
      ]);
    },
  });

  const paymentOnlyMut = useMutation({
    mutationFn: (args: {
      businessId: string;
      periodDays: number;
      amount: number;
      paidByLabel?: string;
      note?: string;
    }) =>
      recordLicencePayment(args.businessId, {
        periodDays: args.periodDays,
        amount: args.amount,
        currency: "PKR",
        paidByLabel: args.paidByLabel,
        note: args.note,
        extendLicence: false,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["platform", "licence-payments"] }),
        qc.invalidateQueries({ queryKey: ["platform", "licence-monthly"] }),
      ]);
    },
  });

  const remindMut = useMutation({
    mutationFn: (force?: boolean) =>
      sendLicenceReminders({ mode: "all", force: Boolean(force) }),
    onSuccess: async (result) => {
      setReminderMsg(
        `Admin alerts: ${result.sent} created · ${result.skipped} skipped · ${result.failed} failed`,
      );
      await qc.invalidateQueries({ queryKey: ["platform", "licence-monthly"] });
    },
    onError: (e: Error) => setReminderMsg(e.message),
  });

  const paymentsByBiz = useMemo(() => {
    const map = new Map<string, typeof payments.data>();
    for (const p of payments.data ?? []) {
      const list = map.get(p.organizationId) ?? [];
      list.push(p);
      map.set(p.organizationId, list);
    }
    return map;
  }, [payments.data]);

  function openBusiness(b: {
    id: string;
    enabledModules?: string[] | null;
    adminEmail?: string | null;
  }) {
    setExpanded(b.id);
    const mods = b.enabledModules;
    if (mods == null) {
      setAllModules(true);
      setModulesDraft(POPS_MODULE_ACCESS.map((m) => m.id));
    } else {
      setAllModules(false);
      setModulesDraft([...mods]);
    }
    setPaidBy(b.adminEmail ?? "");
    setAmount("0");
    setNote("");
  }

  function toggleModule(id: string) {
    setAllModules(false);
    setModulesDraft((prev) => {
      const set = new Set(prev ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      set.add("pops.read");
      return [...set];
    });
  }

  const busy =
    saveModulesMut.isPending ||
    grantMut.isPending ||
    paymentOnlyMut.isPending ||
    remindMut.isPending;
  const err =
    saveModulesMut.error?.message ||
    grantMut.error?.message ||
    paymentOnlyMut.error?.message ||
    null;

  const monthRows = monthTab === "paid" ? (monthly.data?.paid ?? []) : (monthly.data?.unpaid ?? []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Licences, modules & payments</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Control modules, sell 5/30-day access, track this month&apos;s payments, and push in-app
          payment alerts to business admins in the desktop app.
        </p>
      </div>

      {err ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {err}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">
              This month — {monthly.data?.periodLabel ?? "…"}
            </h3>
            <p className={`mt-1 text-sm ${mutedClass}`}>
              Paid vs not paid (Asia/Karachi). Alerts appear inside the desktop app for business
              admins only (not email) near month-end or when licence ≤5 days left.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || monthly.isLoading}
              onClick={() => remindMut.mutate(false)}
            >
              Send admin alerts to unpaid
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy || monthly.isLoading}
              onClick={() => remindMut.mutate(true)}
            >
              Force re-alert
            </Button>
          </div>
        </div>

        {reminderMsg ? (
          <p className={`mt-3 text-sm ${mutedClass}`}>{reminderMsg}</p>
        ) : null}

        {monthly.isLoading ? (
          <p className={`mt-4 text-sm ${mutedClass}`}>Loading monthly status…</p>
        ) : monthly.isError ? (
          <p className="mt-4 text-sm text-rose-600">
            {(monthly.error as Error)?.message ?? "Failed to load monthly status"}
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-emerald-300/70 bg-emerald-50/80 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="text-xs uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Paid this month
                </p>
                <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
                  {monthly.data?.paidCount ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-amber-300/70 bg-amber-50/80 px-3 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-xs uppercase tracking-wide text-amber-800 dark:text-amber-300">
                  Not paid yet
                </p>
                <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">
                  {monthly.data?.unpaidCount ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-3 dark:border-slate-700">
                <p className={`text-xs uppercase tracking-wide ${mutedClass}`}>Collected</p>
                <p className="mt-1 text-2xl font-semibold">
                  {monthly.data?.totalCollected ?? 0} {monthly.data?.currency ?? "PKR"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant={monthTab === "unpaid" ? "primary" : "ghost"}
                onClick={() => setMonthTab("unpaid")}
              >
                Not paid ({monthly.data?.unpaidCount ?? 0})
              </Button>
              <Button
                type="button"
                variant={monthTab === "paid" ? "primary" : "ghost"}
                onClick={() => setMonthTab("paid")}
              >
                Paid ({monthly.data?.paidCount ?? 0})
              </Button>
            </div>

            {monthRows.length === 0 ? (
              <p className={`mt-3 text-sm ${mutedClass}`}>
                {monthTab === "paid"
                  ? "No payments recorded this month yet."
                  : "All active businesses have a payment this month."}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {monthRows.map((row) => (
                  <li
                    key={row.organizationId}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                      monthTab === "paid"
                        ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                        : "border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {row.businessName}
                      </p>
                      <p className={mutedClass}>
                        {SYSTEM_TYPE_LABELS[row.systemType]}
                        {row.adminEmail ? ` · ${row.adminEmail}` : ""}
                        {monthTab === "paid" && row.payment
                          ? ` · ${row.payment.amount} ${row.payment.currency} · ${new Date(row.payment.paidAt).toLocaleDateString()}`
                          : ` · ${formatExpiry(row.licenceExpiresAt)}`}
                        {row.lastReminderAt
                          ? ` · Reminder ${new Date(row.lastReminderAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const b = (businesses.data ?? []).find((x) => x.id === row.organizationId);
                        if (b) openBusiness(b);
                        else setExpanded(row.organizationId);
                      }}
                    >
                      {monthTab === "unpaid" ? "Collect / grant" : "View"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {businesses.isLoading ? (
        <p className={mutedClass}>Loading…</p>
      ) : (
        <ul className="space-y-3">
          {(businesses.data ?? []).map((b) => {
            const expired = Boolean(b.licenceExpired);
            const daysLeft = b.licenceDaysLeft;
            const hist = paymentsByBiz.get(b.id) ?? [];
            return (
              <li
                key={b.id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className={`text-sm ${mutedClass}`}>
                      {SYSTEM_TYPE_LABELS[b.systemType]} · {b.status}
                      {b.adminEmail ? ` · ${b.adminEmail}` : ""}
                    </p>
                    <p className={`mt-1 text-sm ${expired ? "text-rose-600 dark:text-rose-400" : mutedClass}`}>
                      Plan: {b.licencePlan ?? "—"} · {formatExpiry(b.licenceExpiresAt)}
                      {typeof daysLeft === "number" && !expired ? ` (${daysLeft}d)` : ""}
                    </p>
                    <p className={`mt-1 text-sm ${mutedClass}`}>
                      Modules:{" "}
                      {b.enabledModules == null
                        ? "All modules"
                        : `${b.enabledModules.length} enabled`}
                      {hist.length ? ` · ${hist.length} payment(s) recorded` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => (expanded === b.id ? setExpanded(null) : openBusiness(b))}
                  >
                    {expanded === b.id ? "Close" : "Manage"}
                  </Button>
                </div>

                {expanded === b.id ? (
                  <div className="mt-4 space-y-5 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <section>
                      <h3 className="mb-2 text-sm font-semibold">Module access (org ceiling)</h3>
                      <p className={`mb-3 text-xs ${mutedClass}`}>
                        Admins inside this business cannot unlock modules you turn off here.
                      </p>
                      <label className="mb-3 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={allModules}
                          onChange={(e) => {
                            setAllModules(e.target.checked);
                            if (e.target.checked) {
                              setModulesDraft(POPS_MODULE_ACCESS.map((m) => m.id));
                            }
                          }}
                        />
                        Allow all modules
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {POPS_MODULE_ACCESS.map((mod) => {
                          const checked = allModules || (modulesDraft ?? []).includes(mod.id);
                          return (
                            <label
                              key={mod.id}
                              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                                checked
                                  ? "border-emerald-400/60 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                                  : "border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                disabled={allModules && mod.id === "pops.read"}
                                onChange={() => toggleModule(mod.id)}
                              />
                              <span>
                                <span className="font-medium">{mod.label}</span>
                                <span className={`mt-0.5 block text-xs ${mutedClass}`}>
                                  {mod.description}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-3">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => saveModulesMut.mutate(b.id)}
                        >
                          Save module access
                        </Button>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-semibold">Sell / extend licence</h3>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="text-sm">
                          <span className="mb-1 block">Amount (PKR)</span>
                          <input
                            className={fieldInputClass}
                            inputMode="numeric"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                          />
                        </label>
                        <label className="text-sm sm:col-span-2">
                          <span className="mb-1 block">Paid by (customer)</span>
                          <input
                            className={fieldInputClass}
                            value={paidBy}
                            onChange={(e) => setPaidBy(e.target.value)}
                            placeholder="Name or email"
                          />
                        </label>
                        <label className="text-sm sm:col-span-3">
                          <span className="mb-1 block">Note</span>
                          <input
                            className={fieldInputClass}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. JazzCash / bank transfer"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            grantMut.mutate({
                              businessId: b.id,
                              days: 5,
                              amount: Number(amount) || 0,
                              paidByLabel: paidBy.trim() || undefined,
                              note: note.trim() || undefined,
                            })
                          }
                        >
                          Grant 5 days + record payment
                        </Button>
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            grantMut.mutate({
                              businessId: b.id,
                              days: 30,
                              amount: Number(amount) || 0,
                              paidByLabel: paidBy.trim() || undefined,
                              note: note.trim() || undefined,
                            })
                          }
                        >
                          Grant 30 days (monthly) + record payment
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            paymentOnlyMut.mutate({
                              businessId: b.id,
                              periodDays: 30,
                              amount: Number(amount) || 0,
                              paidByLabel: paidBy.trim() || undefined,
                              note: note.trim() || "Payment only (no extend)",
                            })
                          }
                        >
                          Record payment only
                        </Button>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-2 text-sm font-semibold">Payment history</h3>
                      {hist.length === 0 ? (
                        <p className={`text-sm ${mutedClass}`}>No payments recorded yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {hist.slice(0, 12).map((p) => (
                            <li
                              key={p.id}
                              className={`rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 ${mutedClass}`}
                            >
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {p.periodDays}d · {p.amount} {p.currency}
                              </span>
                              {" · "}
                              {p.paidByLabel ?? "—"}
                              {" · "}
                              {new Date(p.paidAt).toLocaleString()}
                              {p.note ? ` · ${p.note}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <section>
        <h3 className={`text-base font-semibold ${headingClass}`}>Recent payments (all businesses)</h3>
        {payments.isLoading ? (
          <p className={`mt-2 text-sm ${mutedClass}`}>Loading…</p>
        ) : (payments.data ?? []).length === 0 ? (
          <p className={`mt-2 text-sm ${mutedClass}`}>No subscription payments yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
                <tr>
                  <th className="px-3 py-2 font-medium">Business</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Paid by</th>
                  <th className="px-3 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {(payments.data ?? []).slice(0, 40).map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/80">
                    <td className="px-3 py-2">{p.businessName ?? p.organizationId.slice(0, 8)}</td>
                    <td className="px-3 py-2">{p.periodDays} days</td>
                    <td className="px-3 py-2">
                      {p.amount} {p.currency}
                    </td>
                    <td className="px-3 py-2">{p.paidByLabel ?? "—"}</td>
                    <td className="px-3 py-2">{new Date(p.paidAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
