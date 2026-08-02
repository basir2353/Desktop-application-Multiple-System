import { Button } from "@platform/ui";
import {
  LICENCE_PLANS,
  SYSTEM_TYPE_LABELS,
  defaultExpiryDateForPlan,
  licencePlanLabel,
  resolveLicencePlanMeta,
  type BusinessStatus,
  type CreateBusiness,
  type LicencePlan,
  type LicencePlanMeta,
  type SystemType,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createPlatformBusiness,
  deletePlatformBusiness,
  fetchPlatformBusinesses,
  fetchPlatformSettings,
  fetchPlatformSystemTypes,
  fetchPlatformUsers,
  resetPlatformUserPassword,
  updatePlatformBusiness,
} from "../lib/platformApi";
import {
  businessSystemList,
  systemTypeForBusinessSystemId,
} from "../lib/businessSystems";
import { resolvePraFlags } from "./superAdminHelpers";
import { SuperAdminBusinessUsersViewModal } from "./SuperAdminBusinessUsersViewModal";
import { SuperAdminUserViewModal } from "./SuperAdminUserViewModal";
import type { Business, PlatformUser } from "@platform/contracts";
import {
  saBtnAccentClass,
  saBtnDangerClass,
  saBtnGhostClass,
  saBtnPrimaryClass,
  saInputClass,
  saLinkClass,
  saMutedClass,
  saPageSubClass,
  saPageTitleClass,
  saTableHeadClass,
  saTableWrapClass,
} from "./superAdminTheme";

const fieldInputClass = saInputClass;
const headingClass = saPageTitleClass;
const mutedClass = saMutedClass;

const STATUS_ACTIONS: { status: BusinessStatus; label: string }[] = [
  { status: "active", label: "Activate" },
  { status: "inactive", label: "Deactivate" },
  { status: "suspended", label: "Suspend" },
];

function formatSuggestedPkr(value: number | null): string {
  if (value == null) return "Set yourself";
  if (value === 0) return "Free";
  return `Rs ${value.toLocaleString("en-PK")}`;
}

type CreateFormState = CreateBusiness & { licenceExpiresAtLocal?: string };

function emptyForm(
  defaultPlan: string,
  planMeta: Record<string, LicencePlanMeta>,
): CreateFormState {
  const plan = (LICENCE_PLANS as readonly string[]).includes(defaultPlan)
    ? defaultPlan
    : "standard";
  return {
    name: "",
    systemType: "restaurant",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    licencePlan: plan,
    licenceKey: "",
    licenceExpiresAtLocal: defaultExpiryDateForPlan(plan, planMeta),
    fbrEnabled: false,
    praFakeEnabled: false,
    praRealEnabled: false,
  };
}

export function SuperAdminBusinessesPage(): JSX.Element {
  const qc = useQueryClient();
  const businesses = useQuery({ queryKey: ["platform", "businesses"], queryFn: fetchPlatformBusinesses });
  const users = useQuery({ queryKey: ["platform", "users"], queryFn: fetchPlatformUsers });
  const systemTypes = useQuery({ queryKey: ["platform", "system-types"], queryFn: fetchPlatformSystemTypes });
  const settings = useQuery({ queryKey: ["platform", "settings"], queryFn: fetchPlatformSettings });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewBusiness, setViewBusiness] = useState<Business | null>(null);
  const [viewUser, setViewUser] = useState<PlatformUser | null>(null);
  const defaultPlan =
    typeof settings.data?.entries.default_licence_plan === "string" &&
    settings.data.entries.default_licence_plan.trim()
      ? settings.data.entries.default_licence_plan.trim()
      : "standard";

  const planMeta = useMemo(
    () => resolveLicencePlanMeta(settings.data?.entries),
    [settings.data?.entries],
  );

  /** Only ERP shells we actually ship (Restaurant / Pharmacy / General Store). */
  const shippedSystemOptions = useMemo(() => {
    const fromApp = businessSystemList.map((s) => {
      const id = systemTypeForBusinessSystemId(s.id);
      return { id, label: SYSTEM_TYPE_LABELS[id] };
    });
    if (!systemTypes.data?.length) return fromApp;
    const allowed = new Set(fromApp.map((o) => o.id));
    return systemTypes.data.filter((o) => allowed.has(o.id));
  }, [systemTypes.data]);

  const [form, setForm] = useState<CreateFormState>(() => emptyForm(defaultPlan, planMeta));

  useEffect(() => {
    if (!showForm) {
      setForm(emptyForm(defaultPlan, planMeta));
    }
  }, [defaultPlan, showForm, planMeta]);

  const selectedPlan = (form.licencePlan ?? defaultPlan) as string;
  const selectedMeta = planMeta[selectedPlan as LicencePlan] ?? planMeta.standard;

  const usersQuery = useQuery({
    queryKey: ["platform", "users"],
    queryFn: fetchPlatformUsers,
    staleTime: 30_000,
  });

  /** Blocks create only when email is on a live business/user. Orphans are freed by the API. */
  const emailTakenBy = useMemo(() => {
    const email = form.adminEmail.trim().toLowerCase();
    if (!email.includes("@")) return null;
    const byBusiness =
      (businesses.data ?? []).find((b) => (b.adminEmail ?? "").toLowerCase() === email) ?? null;
    if (byBusiness) return byBusiness.name;
    const byUser =
      (usersQuery.data ?? []).find(
        (u) => u.email.toLowerCase() === email && Boolean(u.businessId),
      ) ?? null;
    if (byUser) {
      return byUser.businessName?.trim()
        ? `${byUser.name} · ${byUser.businessName}`
        : byUser.name;
    }
    return null;
  }, [businesses.data, form.adminEmail, usersQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (businesses.data ?? []).filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.adminEmail ?? "").toLowerCase().includes(q) ||
        SYSTEM_TYPE_LABELS[b.systemType].toLowerCase().includes(q) ||
        (b.licenceKey ?? "").toLowerCase().includes(q) ||
        licencePlanLabel(b.licencePlan, planMeta).toLowerCase().includes(q)
      );
    });
  }, [businesses.data, search, statusFilter, planMeta]);

  const createMut = useMutation({
    mutationFn: createPlatformBusiness,
    onSuccess: async () => {
      setShowForm(false);
      setError(null);
      setForm(emptyForm(defaultPlan, planMeta));
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Create failed"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BusinessStatus }) =>
      updatePlatformBusiness(id, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });

  const taxMut = useMutation({
    mutationFn: ({
      id,
      fbrEnabled,
      praFakeEnabled,
      praRealEnabled,
    }: {
      id: string;
      fbrEnabled: boolean;
      praFakeEnabled: boolean;
      praRealEnabled: boolean;
    }) => updatePlatformBusiness(id, { fbrEnabled, praFakeEnabled, praRealEnabled }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deletePlatformBusiness,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });

  const resetUserMut = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      resetPlatformUserPassword(userId, password),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
      if (viewUser) {
        const next = await qc.fetchQuery({
          queryKey: ["platform", "users"],
          queryFn: fetchPlatformUsers,
        });
        const refreshed = next.find(
          (u) => u.id === viewUser.id && u.businessId === viewUser.businessId,
        );
        if (refreshed) setViewUser(refreshed);
      }
    },
  });

  function selectPlan(plan: LicencePlan): void {
    setForm((f) => ({
      ...f,
      licencePlan: plan,
      licenceExpiresAtLocal:
        plan === "custom"
          ? f.licenceExpiresAtLocal || ""
          : defaultExpiryDateForPlan(plan, planMeta),
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${headingClass}`}>Businesses</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            Create client installations with a real licence plan, manage status, and open a business
            for full control.
          </p>
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            <strong>FBR / FPRA / Real PRA:</strong> toggle in the table below, open{" "}
            <Link to="/super-admin/tax" className="font-semibold underline">
              FBR / FPRA · Real PRA
            </Link>
            , or click <strong>Manage</strong> → Tax authority section.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setError(null);
            setShowForm((v) => !v);
          }}
        >
                          {showForm ? "Cancel" : "New business"}
                        </Button>
      </div>

      {showForm ? (
        <form
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm border-slate-200 bg-white"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (emailTakenBy) {
              setError(
                `Login email “${form.adminEmail.trim()}” is already used by “${emailTakenBy.name}”. Customer emails are separate — use a different login email.`,
              );
              return;
            }
            if (selectedPlan === "custom" && !form.licenceExpiresAtLocal?.trim()) {
              setError("Custom plan needs a licence expiry date.");
              return;
            }
            const { licenceExpiresAtLocal, licenceKey, ...rest } = form;
            createMut.mutate({
              ...rest,
              licencePlan: selectedPlan,
              licenceKey: licenceKey?.trim() || undefined,
              licenceExpiresAt: licenceExpiresAtLocal
                ? new Date(`${licenceExpiresAtLocal}T23:59:59.000Z`).toISOString()
                : undefined,
            });
          }}
        >
          <div className="border-b border-amber-200/80 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
              What the licence does
            </p>
            <p className={`mt-1 text-xs ${mutedClass} dark:text-amber-200/80`}>
              The licence controls how long this business can log into the ERP. After expiry, login
              is blocked until you renew on the Licences page. Suggested PKR is for your reference
              only — record payments separately when money is collected.
            </p>
          </div>

          <div className="space-y-6 p-4 sm:p-5">
            <section className="space-y-3">
              <SectionTitle>Business</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Business name">
                  <input
                    className={fieldInputClass}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="e.g. City Grill"
                  />
                </Field>
                <Field label="System type">
                  <select
                    className={fieldInputClass}
                    value={form.systemType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, systemType: e.target.value as SystemType }))
                    }
                  >
                    {shippedSystemOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle>System admin (first licensed user)</SectionTitle>
              <p className={`text-xs ${mutedClass}`}>
                This account is the business owner login. They can create more staff inside the ERP.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Admin name">
                  <input
                    className={fieldInputClass}
                    value={form.adminName}
                    onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                    required
                  />
                </Field>
                <Field label="Admin email">
                  <input
                    type="email"
                    className={`${fieldInputClass} ${
                      emailTakenBy
                        ? "border-rose-400 focus:border-rose-500 dark:border-rose-700"
                        : ""
                    }`}
                    value={form.adminEmail}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, adminEmail: e.target.value }));
                      setError(null);
                    }}
                    required
                    autoComplete="off"
                  />
                  <p className={`mt-1 text-[11px] ${mutedClass}`}>
                    Login email only (not customer email). Must be unique among live user accounts.
                  </p>
                  {emailTakenBy ? (
                    <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                      Already used by “{emailTakenBy.name}”. Choose another email.
                    </p>
                  ) : null}
                </Field>
                <Field label="Admin password">
                  <input
                    type="password"
                    className={fieldInputClass}
                    value={form.adminPassword}
                    onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle>Licence package</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {LICENCE_PLANS.map((plan) => {
                  const meta = planMeta[plan];
                  const active = selectedPlan === plan;
                  return (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => selectPlan(plan)}
                      className={[
                        "rounded-xl border px-3 py-3 text-left transition",
                        active
                          ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/30"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-white/15 dark:bg-[#070D18]/40 dark:hover:border-slate-600",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {meta.label}
                        </p>
                        <span
                          className={`shrink-0 text-xs font-medium ${
                            active ? "text-teal-800" : mutedClass
                          }`}
                        >
                          {formatSuggestedPkr(meta.suggestedPkr)}
                        </span>
                      </div>
                      <p className={`mt-1 text-xs ${mutedClass}`}>{meta.blurb}</p>
                      {meta.days != null ? (
                        <p className="mt-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          Access for {meta.days} days
                        </p>
                      ) : (
                        <p className="mt-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                          Pick expiry below
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-white/15 dark:bg-[#070D18]/30 sm:grid-cols-2">
                <Field
                  label={
                    selectedPlan === "custom"
                      ? "Licence expires (required)"
                      : "Licence expires (auto from plan)"
                  }
                >
                  <input
                    type="date"
                    className={fieldInputClass}
                    value={form.licenceExpiresAtLocal ?? ""}
                    required={selectedPlan === "custom"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, licenceExpiresAtLocal: e.target.value }))
                    }
                  />
                  <p className={`mt-1 text-[11px] ${mutedClass}`}>
                    Selected: {selectedMeta.label}
                    {form.licenceExpiresAtLocal
                      ? ` · until ${new Date(`${form.licenceExpiresAtLocal}T12:00:00`).toLocaleDateString()}`
                      : ""}
                  </p>
                </Field>
                <Field label="Licence key (optional)">
                  <input
                    className={fieldInputClass}
                    value={form.licenceKey ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, licenceKey: e.target.value }))}
                    placeholder="Auto-generated if empty"
                  />
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <SectionTitle>Tax authorities</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-3">
                <TaxChip
                  checked={Boolean(form.fbrEnabled)}
                  title="Show FBR"
                  description="Admin sees FBR section (they choose Active)"
                  onChange={(checked) => setForm((f) => ({ ...f, fbrEnabled: checked }))}
                />
                <TaxChip
                  checked={Boolean(form.praFakeEnabled)}
                  title="Show FPRA"
                  description="Admin sees FPRA section (they choose Active)"
                  onChange={(checked) =>
                    setForm((f) => ({
                      ...f,
                      praFakeEnabled: checked,
                    }))
                  }
                />
                <TaxChip
                  checked={Boolean(form.praRealEnabled)}
                  title="Show Real PRA"
                  description="Admin sees Real PRA section (they choose Active)"
                  onChange={(checked) =>
                    setForm((f) => ({
                      ...f,
                      praRealEnabled: checked,
                    }))
                  }
                />
              </div>
            </section>

            {error ? (
              <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
              <Button type="submit" disabled={createMut.isPending || Boolean(emailTakenBy)}>
                {createMut.isPending ? "Creating…" : "Create business + admin"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <input
          className={`${fieldInputClass} max-w-xs`}
          placeholder="Search name, admin, system, plan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={`${fieldInputClass} max-w-[10rem]`}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {businesses.isLoading ? (
        <p className={mutedClass}>Loading businesses…</p>
      ) : businesses.error ? (
        <p className="text-sm text-red-600">
          {businesses.error instanceof Error ? businesses.error.message : "Failed to load"}
        </p>
      ) : (
        <div className={saTableWrapClass}>
          <table className="min-w-full text-left text-sm">
            <thead className={saTableHeadClass}>
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3 font-medium">System</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Licence</th>
                <th className="px-4 py-3 font-medium">FBR / FPRA / Real PRA</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`px-4 py-8 text-center ${mutedClass}`}>
                    No businesses match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const expired =
                    b.licenceExpired === true ||
                    (b.licenceExpiresAt != null &&
                      new Date(b.licenceExpiresAt).getTime() < Date.now());
                  const pra = resolvePraFlags(b);
                  return (
                    <tr key={b.id}>
                      <td className="px-4 py-3">
                        <Link
                          to={`/super-admin/businesses/${b.id}`}
                          className={saLinkClass}
                        >
                          {b.name}
                        </Link>
                        <p className={`text-xs ${mutedClass}`}>{b.userCount ?? 0} users</p>
                      </td>
                      <td className="px-4 py-3">{SYSTEM_TYPE_LABELS[b.systemType]}</td>
                      <td className="px-4 py-3 capitalize">{b.status}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{licencePlanLabel(b.licencePlan, planMeta)}</p>
                        <p
                          className={`text-xs ${
                            expired ? "text-rose-600 dark:text-rose-400" : mutedClass
                          }`}
                        >
                          {b.licenceExpiresAt
                            ? `${expired ? "Expired" : "Expires"} ${new Date(
                                b.licenceExpiresAt,
                              ).toLocaleDateString()}`
                            : "No expiry"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 text-xs">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={Boolean(b.fbrEnabled)}
                              disabled={taxMut.isPending}
                              onChange={(e) =>
                                taxMut.mutate({
                                  id: b.id,
                                  fbrEnabled: e.target.checked,
                                  praFakeEnabled: pra.praFakeEnabled,
                                  praRealEnabled: pra.praRealEnabled,
                                })
                              }
                            />
                            <span>FBR</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={pra.praFakeEnabled}
                              disabled={taxMut.isPending}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                taxMut.mutate({
                                  id: b.id,
                                  fbrEnabled: Boolean(b.fbrEnabled),
                                  praFakeEnabled: checked,
                                  praRealEnabled: pra.praRealEnabled,
                                });
                              }}
                            />
                            <span className="font-medium text-teal-800">
                              FPRA
                            </span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5"
                              checked={pra.praRealEnabled}
                              disabled={taxMut.isPending}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                taxMut.mutate({
                                  id: b.id,
                                  fbrEnabled: Boolean(b.fbrEnabled),
                                  praFakeEnabled: pra.praFakeEnabled,
                                  praRealEnabled: checked,
                                });
                              }}
                            />
                            <span>Real PRA</span>
                          </label>
                        </div>
                      </td>
                      <td className="px-4 py-3">{b.adminEmail ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className={saBtnAccentClass}
                            onClick={() => {
                              setViewUser(null);
                              setViewBusiness(b);
                            }}
                          >
                            View
                          </button>
                          <Link
                            to={`/super-admin/businesses/${b.id}`}
                            className={saBtnGhostClass}
                          >
                            Manage
                          </Link>
                          {STATUS_ACTIONS.filter((a) => a.status !== b.status).map((a) => (
                            <button
                              key={a.status}
                              type="button"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                              disabled={updateMut.isPending}
                              onClick={() => updateMut.mutate({ id: b.id, status: a.status })}
                            >
                              {a.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
                            disabled={deleteMut.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete business “${b.name}”? It is archived (backup kept) and removed from live lists. Login emails can be reused.`)) {
                                deleteMut.mutate(b.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewBusiness && !viewUser ? (
        <SuperAdminBusinessUsersViewModal
          business={viewBusiness}
          users={(users.data ?? []).filter((u) => u.businessId === viewBusiness.id)}
          onClose={() => setViewBusiness(null)}
          onViewUser={(u) => setViewUser(u)}
        />
      ) : null}

      {viewUser ? (
        <SuperAdminUserViewModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          resetPending={resetUserMut.isPending}
          onResetPassword={(userId, password) => resetUserMut.mutate({ userId, password })}
        />
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {children}
    </h3>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function TaxChip({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
        checked
          ? "border-emerald-400/70 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-slate-200 dark:border-white/15"
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">{title}</span>
        <span className={`mt-0.5 block text-xs ${mutedClass}`}>{description}</span>
      </span>
    </label>
  );
}
