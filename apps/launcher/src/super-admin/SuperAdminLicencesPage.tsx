import { Button } from "@platform/ui";
import {
  POPS_MODULE_ACCESS,
  SYSTEM_TYPE_LABELS,
  licencePlanLabel,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchLicencePayments,
  fetchMonthlyLicenceStatus,
  fetchPlatformBusinesses,
  grantPlatformLicence,
  recordLicencePayment,
  updatePlatformBusiness,
} from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";
import { MODULE_TEMPLATES, type ModuleTemplateId } from "./superAdminHelpers";

type ManageTab = "licence" | "modules" | "tax";

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "No expiry set";
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const label = d.toLocaleDateString();
  if (days < 0) return `Expired ${label} (${Math.abs(days)}d ago)`;
  if (days === 0) return `Expires today (${label})`;
  return `Expires ${label} · ${days}d left`;
}

function formatPkr(n: number): string {
  return `Rs ${Math.round(n).toLocaleString("en-PK")}`;
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

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [manageTab, setManageTab] = useState<ManageTab>("licence");
  const [modulesDraft, setModulesDraft] = useState<string[] | null>(null);
  const [allModules, setAllModules] = useState(true);
  const [fbrEnabled, setFbrEnabled] = useState(false);
  const [praEnabled, setPraEnabled] = useState(false);
  const [modulesMsg, setModulesMsg] = useState<string | null>(null);
  const [taxMsg, setTaxMsg] = useState<string | null>(null);
  const [licenceMsg, setLicenceMsg] = useState<string | null>(null);
  const [amount, setAmount] = useState("0");
  const [paidBy, setPaidBy] = useState("");
  const [note, setNote] = useState("");

  const saveModulesMut = useMutation({
    mutationFn: (businessId: string) =>
      updatePlatformBusiness(businessId, {
        enabledModules: allModules ? null : (modulesDraft ?? []),
      }),
    onSuccess: async (saved) => {
      const mods = saved.enabledModules;
      if (mods == null) {
        setAllModules(true);
        setModulesDraft(POPS_MODULE_ACCESS.map((m) => m.id));
      } else {
        setAllModules(false);
        setModulesDraft([...mods]);
      }
      setModulesMsg(
        `Modules saved for ${saved.name}: ${
          saved.enabledModules == null ? "ALL unlocked" : `${saved.enabledModules.length} enabled`
        }. Business users may need refresh / re-login.`,
      );
      await qc.invalidateQueries({ queryKey: ["platform", "businesses"] });
    },
  });

  const saveTaxMut = useMutation({
    mutationFn: (businessId: string) =>
      updatePlatformBusiness(businessId, { fbrEnabled, praEnabled }),
    onSuccess: async (saved) => {
      setFbrEnabled(Boolean(saved.fbrEnabled));
      setPraEnabled(Boolean(saved.praEnabled));
      setTaxMsg(
        `Tax saved: FBR ${saved.fbrEnabled ? "ON" : "OFF"} · PRA ${saved.praEnabled ? "ON" : "OFF"}`,
      );
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
    onSuccess: async (saved) => {
      setLicenceMsg(`Licence extended for ${saved.name}. ${formatExpiry(saved.licenceExpiresAt)}`);
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
      setLicenceMsg("Payment recorded (licence not extended).");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["platform", "licence-payments"] }),
        qc.invalidateQueries({ queryKey: ["platform", "licence-monthly"] }),
      ]);
    },
  });

  const paymentsByBiz = useMemo(() => {
    const map = new Map<string, NonNullable<typeof payments.data>>();
    for (const p of payments.data ?? []) {
      const list = map.get(p.organizationId) ?? [];
      list.push(p);
      map.set(p.organizationId, list);
    }
    return map;
  }, [payments.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (businesses.data ?? []).filter((b) => {
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.adminEmail ?? "").toLowerCase().includes(q) ||
        SYSTEM_TYPE_LABELS[b.systemType].toLowerCase().includes(q) ||
        licencePlanLabel(b.licencePlan).toLowerCase().includes(q)
      );
    });
  }, [businesses.data, search]);

  function openBusiness(b: {
    id: string;
    enabledModules?: string[] | null;
    adminEmail?: string | null;
    fbrEnabled?: boolean;
    praEnabled?: boolean;
  }, tab: ManageTab = "licence") {
    setExpanded(b.id);
    setManageTab(tab);
    setModulesMsg(null);
    setTaxMsg(null);
    setLicenceMsg(null);
    const mods = b.enabledModules;
    if (mods == null) {
      setAllModules(true);
      setModulesDraft(POPS_MODULE_ACCESS.map((m) => m.id));
    } else {
      setAllModules(false);
      setModulesDraft([...mods]);
    }
    setFbrEnabled(Boolean(b.fbrEnabled));
    setPraEnabled(Boolean(b.praEnabled));
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

  function applyTemplate(id: ModuleTemplateId) {
    const tpl = MODULE_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (tpl.modules == null) {
      setAllModules(true);
      setModulesDraft(POPS_MODULE_ACCESS.map((m) => m.id));
    } else {
      setAllModules(false);
      setModulesDraft([...tpl.modules]);
    }
    setModulesMsg(`Template “${tpl.label}” applied to draft — click Save modules.`);
  }

  const busy =
    saveModulesMut.isPending ||
    saveTaxMut.isPending ||
    grantMut.isPending ||
    paymentOnlyMut.isPending;
  const err =
    saveModulesMut.error?.message ||
    saveTaxMut.error?.message ||
    grantMut.error?.message ||
    paymentOnlyMut.error?.message ||
    null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${headingClass}`}>Licences & modules</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            Per business: renew licence, set module ceiling, and toggle FBR / PRA — each in its own
            panel.
          </p>
        </div>
        <Link
          to="/super-admin/payments"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Open Payments →
        </Link>
      </div>

      {/* Compact payments peek — full UI lives on Payments page */}
      <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              This month · {monthly.data?.periodLabel ?? "…"}
            </p>
            <p className={`mt-0.5 text-xs ${mutedClass}`}>
              Month-end unpaid tracking lives on the Payments page.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-emerald-100 px-2.5 py-1 font-medium text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
              Paid {monthly.data?.paidCount ?? "…"}
            </span>
            <span className="rounded-lg bg-amber-100 px-2.5 py-1 font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-200">
              Unpaid {monthly.data?.unpaidCount ?? "…"}
            </span>
            <span className="rounded-lg bg-slate-200 px-2.5 py-1 font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {monthly.data ? formatPkr(monthly.data.totalCollected) : "…"}
            </span>
          </div>
        </div>
      </section>

      {err ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {err}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          className={`${fieldInputClass} max-w-sm`}
          placeholder="Search business, admin, plan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {businesses.isLoading ? (
        <p className={mutedClass}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p className={mutedClass}>No businesses match.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((b) => {
            const expired = Boolean(b.licenceExpired);
            const hist = paymentsByBiz.get(b.id) ?? [];
            const isOpen = expanded === b.id;
            const modulesLabel =
              b.enabledModules == null ? "All modules" : `${b.enabledModules.length} modules`;

            return (
              <li
                key={b.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
                      {b.name}
                    </p>
                    <p className={`mt-0.5 text-sm ${mutedClass}`}>
                      {SYSTEM_TYPE_LABELS[b.systemType]} ·{" "}
                      <span className="capitalize">{b.status}</span>
                      {b.adminEmail ? ` · ${b.adminEmail}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isOpen ? "primary" : "ghost"}
                    onClick={() => (isOpen ? setExpanded(null) : openBusiness(b))}
                  >
                    {isOpen ? "Close" : "Manage"}
                  </Button>
                </div>

                {/* Three separate summary chips */}
                <div className="grid gap-2 px-4 py-3 sm:grid-cols-3">
                  <SummaryChip
                    title="Licence"
                    active={!expired}
                    warn={expired}
                    lines={[
                      licencePlanLabel(b.licencePlan),
                      formatExpiry(b.licenceExpiresAt),
                      hist.length ? `${hist.length} payment(s)` : "No payments yet",
                    ]}
                    onClick={() => openBusiness(b, "licence")}
                  />
                  <SummaryChip
                    title="Modules"
                    active={b.enabledModules == null || (b.enabledModules?.length ?? 0) > 0}
                    lines={[
                      modulesLabel,
                      "Org ceiling for business admins",
                      "Templates available inside",
                    ]}
                    onClick={() => openBusiness(b, "modules")}
                  />
                  <SummaryChip
                    title="Tax (FBR / PRA)"
                    active={Boolean(b.fbrEnabled || b.praEnabled)}
                    lines={[
                      `FBR ${b.fbrEnabled ? "ON" : "OFF"}`,
                      `PRA ${b.praEnabled ? "ON" : "OFF"}`,
                      "Tax & compliance menu",
                    ]}
                    onClick={() => openBusiness(b, "tax")}
                  />
                </div>

                {isOpen ? (
                  <div className="border-t border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-2 dark:border-slate-800">
                      {(
                        [
                          { id: "licence", label: "1 · Licence" },
                          { id: "modules", label: "2 · Modules" },
                          { id: "tax", label: "3 · Tax" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setManageTab(tab.id)}
                          className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                            manageTab === tab.id
                              ? "bg-white text-amber-800 shadow-sm dark:bg-slate-900 dark:text-amber-300"
                              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4 bg-white p-4 dark:bg-slate-900/60">
                      {manageTab === "licence" ? (
                        <section className="space-y-4">
                          <div>
                            <h3 className="text-sm font-semibold">Sell / extend licence</h3>
                            <p className={`mt-1 text-xs ${mutedClass}`}>
                              Grant days and optionally record a payment. Full month unpaid list is
                              on{" "}
                              <Link
                                to="/super-admin/payments"
                                className="text-amber-700 underline dark:text-amber-400"
                              >
                                Payments
                              </Link>
                              .
                            </p>
                          </div>
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
                          <div className="flex flex-wrap gap-2">
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
                              Grant 5 days + payment
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
                              Grant 30 days + payment
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
                          {licenceMsg ? (
                            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                              {licenceMsg}
                            </p>
                          ) : null}
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Recent payments for this business
                            </h4>
                            {hist.length === 0 ? (
                              <p className={`text-sm ${mutedClass}`}>None yet.</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {hist.slice(0, 8).map((p) => (
                                  <li
                                    key={p.id}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                                  >
                                    <span className="font-medium">
                                      {p.periodDays}d · {p.amount} {p.currency}
                                    </span>
                                    {" · "}
                                    {p.paidByLabel ?? "—"}
                                    {" · "}
                                    {new Date(p.paidAt).toLocaleString()}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </section>
                      ) : null}

                      {manageTab === "modules" ? (
                        <section className="space-y-4">
                          <div>
                            <h3 className="text-sm font-semibold">Module access (org ceiling)</h3>
                            <p className={`mt-1 text-xs ${mutedClass}`}>
                              Admins inside this business cannot unlock modules you turn off here.
                            </p>
                          </div>
                          <div>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                              Quick templates
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {MODULE_TEMPLATES.map((tpl) => (
                                <button
                                  key={tpl.id}
                                  type="button"
                                  title={tpl.description}
                                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                  onClick={() => applyTemplate(tpl.id)}
                                >
                                  {tpl.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
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
                          {modulesMsg ? (
                            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                              {modulesMsg}
                            </p>
                          ) : null}
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setModulesMsg(null);
                              saveModulesMut.mutate(b.id);
                            }}
                          >
                            {saveModulesMut.isPending ? "Saving…" : "Save modules"}
                          </Button>
                        </section>
                      ) : null}

                      {manageTab === "tax" ? (
                        <section className="space-y-4">
                          <div>
                            <h3 className="text-sm font-semibold">Tax authorities</h3>
                            <p className={`mt-1 text-xs ${mutedClass}`}>
                              When on, business admins see Tax &amp; compliance and can connect FBR /
                              PRA credentials.
                            </p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                                fbrEnabled
                                  ? "border-emerald-400/70 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
                                  : "border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4"
                                checked={fbrEnabled}
                                onChange={(e) => setFbrEnabled(e.target.checked)}
                              />
                              <span>
                                <span className="font-semibold">FBR</span>
                                <span className={`mt-1 block text-xs ${mutedClass}`}>
                                  Federal Board of Revenue e-invoicing
                                </span>
                              </span>
                            </label>
                            <label
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                                praEnabled
                                  ? "border-emerald-400/70 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
                                  : "border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4"
                                checked={praEnabled}
                                onChange={(e) => setPraEnabled(e.target.checked)}
                              />
                              <span>
                                <span className="font-semibold">PRA</span>
                                <span className={`mt-1 block text-xs ${mutedClass}`}>
                                  Punjab Revenue Authority e-invoicing
                                </span>
                              </span>
                            </label>
                          </div>
                          {taxMsg ? (
                            <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                              {taxMsg}
                            </p>
                          ) : null}
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setTaxMsg(null);
                              saveTaxMut.mutate(b.id);
                            }}
                          >
                            {saveTaxMut.isPending ? "Saving…" : "Save tax settings"}
                          </Button>
                        </section>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SummaryChip({
  title,
  lines,
  active,
  warn,
  onClick,
}: {
  title: string;
  lines: string[];
  active?: boolean;
  warn?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left transition hover:border-amber-400/70 dark:hover:border-amber-600 ${
        warn
          ? "border-rose-300 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30"
          : active
            ? "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/50"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{lines[0]}</p>
      {lines.slice(1).map((line) => (
        <p key={line} className={`mt-0.5 text-xs ${mutedClass}`}>
          {line}
        </p>
      ))}
    </button>
  );
}
