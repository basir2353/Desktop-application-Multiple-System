import { Button } from "@platform/ui";
import {
  LICENCE_PLANS,
  SYSTEM_TYPE_LABELS,
  type BusinessStatus,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deletePlatformBusiness,
  fetchPlatformBusiness,
  fetchPlatformSettings,
  fetchPlatformUsers,
  resetPlatformUserPassword,
  updatePlatformBusiness,
  updatePlatformSettings,
  updatePlatformUser,
} from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";
import { businessNotesKey } from "./superAdminHelpers";

const STATUS_ACTIONS: { status: BusinessStatus; label: string }[] = [
  { status: "active", label: "Activate" },
  { status: "inactive", label: "Deactivate" },
  { status: "suspended", label: "Suspend" },
];

export function SuperAdminBusinessDetailPage(): JSX.Element {
  const { businessId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const business = useQuery({
    queryKey: ["platform", "businesses", businessId],
    queryFn: () => fetchPlatformBusiness(businessId),
    enabled: Boolean(businessId),
  });
  const users = useQuery({ queryKey: ["platform", "users"], queryFn: fetchPlatformUsers });

  const [name, setName] = useState("");
  const [plan, setPlan] = useState("");
  const [key, setKey] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [fbrEnabled, setFbrEnabled] = useState(false);
  const [praEnabled, setPraEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [notesMsg, setNotesMsg] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: fetchPlatformSettings,
  });

  useEffect(() => {
    if (!business.data) return;
    setName(business.data.name);
    setPlan(business.data.licencePlan ?? "standard");
    setKey(business.data.licenceKey ?? "");
    setExpiresAt(business.data.licenceExpiresAt ? business.data.licenceExpiresAt.slice(0, 10) : "");
    setFbrEnabled(Boolean(business.data.fbrEnabled));
    setPraEnabled(Boolean(business.data.praEnabled));
  }, [business.data]);

  useEffect(() => {
    if (!settings.data || !businessId) return;
    const raw = settings.data.entries[businessNotesKey(businessId)];
    setNotes(typeof raw === "string" ? raw : raw != null ? String(raw) : "");
  }, [settings.data, businessId]);

  const businessUsers = useMemo(
    () => (users.data ?? []).filter((u) => u.businessId === businessId),
    [users.data, businessId],
  );

  const saveMut = useMutation({
    mutationFn: () =>
      updatePlatformBusiness(businessId, {
        name: name.trim(),
        licencePlan: plan || null,
        licenceKey: key.trim() || null,
        licenceExpiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.000Z`).toISOString() : null,
        fbrEnabled,
        praEnabled,
      }),
    onSuccess: async (saved) => {
      setFbrEnabled(Boolean(saved.fbrEnabled));
      setPraEnabled(Boolean(saved.praEnabled));
      const applied =
        Boolean(saved.fbrEnabled) === Boolean(fbrEnabled) &&
        Boolean(saved.praEnabled) === Boolean(praEnabled);
      if (!applied) {
        setMessage(
          "Tax settings were not applied by the server. Redeploy backend-desktop, then try again.",
        );
      } else {
        setMessage(
          `Saved. FBR ${saved.fbrEnabled ? "ON" : "OFF"} · PRA ${saved.praEnabled ? "ON" : "OFF"} — business admins can open Tax & compliance after refresh.`,
        );
      }
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Save failed"),
  });

  const saveTaxMut = useMutation({
    mutationFn: () => updatePlatformBusiness(businessId, { fbrEnabled, praEnabled }),
    onSuccess: async (saved) => {
      const applied =
        Boolean(saved.fbrEnabled) === Boolean(fbrEnabled) &&
        Boolean(saved.praEnabled) === Boolean(praEnabled);
      setFbrEnabled(Boolean(saved.fbrEnabled));
      setPraEnabled(Boolean(saved.praEnabled));
      if (!applied) {
        setMessage(
          "Tax settings were not applied by the server. Hosted API is outdated — redeploy backend-desktop.",
        );
      } else {
        setMessage(
          `Tax settings saved. FBR ${saved.fbrEnabled ? "ON" : "OFF"} · PRA ${saved.praEnabled ? "ON" : "OFF"}`,
        );
      }
      await qc.invalidateQueries({ queryKey: ["platform", "businesses", businessId] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Tax settings save failed"),
  });

  const statusMut = useMutation({
    mutationFn: (status: BusinessStatus) => updatePlatformBusiness(businessId, { status }),
    onSuccess: async () => {
      setMessage("Status updated.");
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePlatformBusiness(businessId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["platform"] });
      navigate("/super-admin/businesses", { replace: true });
    },
  });

  const userStatusMut = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "active" | "inactive" | "suspended" }) =>
      updatePlatformUser(userId, { status }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
  });

  const resetMut = useMutation({
    mutationFn: ({ userId, password: pw }: { userId: string; password: string }) =>
      resetPlatformUserPassword(userId, pw),
    onSuccess: async () => {
      setResetFor(null);
      setPassword("");
      setMessage("Password updated and sessions revoked.");
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Reset failed"),
  });

  const notesMut = useMutation({
    mutationFn: () =>
      updatePlatformSettings({
        entries: { [businessNotesKey(businessId)]: notes },
      }),
    onSuccess: async () => {
      setNotesMsg("Support notes saved.");
      await qc.invalidateQueries({ queryKey: ["platform", "settings"] });
    },
    onError: (err) => setNotesMsg(err instanceof Error ? err.message : "Notes save failed"),
  });

  if (business.isLoading) return <p className={mutedClass}>Loading business…</p>;
  if (business.error || !business.data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">
          {business.error instanceof Error ? business.error.message : "Business not found"}
        </p>
        <Link to="/super-admin/businesses" className="text-sm text-amber-700 hover:underline">
          ← Back to businesses
        </Link>
      </div>
    );
  }

  const b = business.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/super-admin/businesses"
            className={`text-xs font-medium ${mutedClass} hover:text-slate-800 dark:hover:text-slate-200`}
          >
            ← All businesses
          </Link>
          <h2 className={`mt-2 text-xl font-semibold ${headingClass}`}>{b.name}</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            {SYSTEM_TYPE_LABELS[b.systemType]} · <span className="capitalize">{b.status}</span> ·{" "}
            {b.userCount ?? 0} users · Admin {b.adminEmail ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_ACTIONS.filter((a) => a.status !== b.status).map((a) => (
            <button
              key={a.status}
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              disabled={statusMut.isPending}
              onClick={() => statusMut.mutate(a.status)}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            disabled={deleteMut.isPending}
            onClick={() => {
              if (window.confirm(`Delete business “${b.name}”?`)) deleteMut.mutate();
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {message ? (
        <p
          className={`text-sm ${
            /fail|error|denied|required|not applied|outdated/i.test(message)
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {message}
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className={`text-base font-semibold ${headingClass}`}>Business & licence</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block">Name</span>
            <input className={fieldInputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">Licence plan</span>
            <select className={fieldInputClass} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {LICENCE_PLANS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              {plan && !LICENCE_PLANS.includes(plan as (typeof LICENCE_PLANS)[number]) ? (
                <option value={plan}>{plan}</option>
              ) : null}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block">Licence key</span>
            <input className={fieldInputClass} value={key} onChange={(e) => setKey(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block">Expires</span>
            <input
              type="date"
              className={fieldInputClass}
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
        </div>
        <Button type="button" disabled={saveMut.isPending || name.trim().length < 2} onClick={() => saveMut.mutate()}>
          {saveMut.isPending ? "Saving…" : "Save changes"}
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className={`text-base font-semibold ${headingClass}`}>Tax authority (FBR / PRA)</h3>
        <p className={`text-sm ${mutedClass}`}>
          Enable integrations for this business. Branch admins can only connect credentials when enabled here.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={fbrEnabled}
              onChange={(e) => setFbrEnabled(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Enable FBR</span>
              <span className={`text-xs ${mutedClass}`}>
                Federal Board of Revenue e-invoicing for this business
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={praEnabled}
              onChange={(e) => setPraEnabled(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Enable PRA</span>
              <span className={`text-xs ${mutedClass}`}>
                Punjab Revenue Authority e-invoicing for this business
              </span>
            </span>
          </label>
        </div>
        <Button type="button" disabled={saveTaxMut.isPending} onClick={() => saveTaxMut.mutate()}>
          {saveTaxMut.isPending ? "Saving…" : "Save tax settings"}
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className={`text-base font-semibold ${headingClass}`}>Support notes</h3>
        <p className={`text-sm ${mutedClass}`}>
          Operator-only notes for this business (stored in platform settings, not visible to the client).
        </p>
        <textarea
          className={`${fieldInputClass} min-h-[120px]`}
          placeholder="e.g. Called owner about overdue licence; prefers WhatsApp…"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesMsg(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={notesMut.isPending} onClick={() => notesMut.mutate()}>
            {notesMut.isPending ? "Saving…" : "Save notes"}
          </Button>
          {notesMsg ? (
            <p
              className={`text-sm ${
                /fail|error/i.test(notesMsg)
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {notesMsg}
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className={`text-base font-semibold ${headingClass}`}>Users in this business</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {businessUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`px-4 py-6 text-center ${mutedClass}`}>
                    No users found for this business.
                  </td>
                </tr>
              ) : (
                businessUsers.map((u) => (
                  <tr key={`${u.id}-${u.businessId}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name ?? u.email}</p>
                      <p className={`text-xs ${mutedClass}`}>{u.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{u.role.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 capitalize">{u.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.status !== "active" ? (
                          <button
                            type="button"
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            disabled={userStatusMut.isPending}
                            onClick={() => userStatusMut.mutate({ userId: u.id, status: "active" })}
                          >
                            Activate
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                              disabled={userStatusMut.isPending}
                              onClick={() => userStatusMut.mutate({ userId: u.id, status: "inactive" })}
                            >
                              Deactivate
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                              disabled={userStatusMut.isPending}
                              onClick={() => userStatusMut.mutate({ userId: u.id, status: "suspended" })}
                            >
                              Suspend
                            </button>
                          </>
                        )}
                        {resetFor === u.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="password"
                              className={`${fieldInputClass} !w-36`}
                              placeholder="New password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              minLength={8}
                            />
                            <Button
                              type="button"
                              disabled={password.length < 8 || resetMut.isPending}
                              onClick={() => {
                                if (window.confirm(`Reset password for ${u.email}?`)) {
                                  resetMut.mutate({ userId: u.id, password });
                                }
                              }}
                            >
                              Save
                            </Button>
                            <button type="button" className="text-xs text-slate-500" onClick={() => setResetFor(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              setResetFor(u.id);
                              setPassword("");
                            }}
                          >
                            Reset password
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
