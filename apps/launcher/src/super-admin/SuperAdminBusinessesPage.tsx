import { Button } from "@platform/ui";
import { SYSTEM_TYPE_LABELS, type BusinessStatus, type CreateBusiness, type SystemType } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createPlatformBusiness,
  deletePlatformBusiness,
  fetchPlatformBusinesses,
  fetchPlatformSystemTypes,
  updatePlatformBusiness,
} from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

const STATUS_ACTIONS: { status: BusinessStatus; label: string }[] = [
  { status: "active", label: "Activate" },
  { status: "inactive", label: "Deactivate" },
  { status: "suspended", label: "Suspend" },
];

export function SuperAdminBusinessesPage(): JSX.Element {
  const qc = useQueryClient();
  const businesses = useQuery({ queryKey: ["platform", "businesses"], queryFn: fetchPlatformBusinesses });
  const systemTypes = useQuery({ queryKey: ["platform", "system-types"], queryFn: fetchPlatformSystemTypes });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateBusiness>({
    name: "",
    systemType: "restaurant",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    licencePlan: "standard",
  });

  const createMut = useMutation({
    mutationFn: createPlatformBusiness,
    onSuccess: async () => {
      setShowForm(false);
      setError(null);
      setForm({
        name: "",
        systemType: "restaurant",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        licencePlan: "standard",
      });
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

  const deleteMut = useMutation({
    mutationFn: deletePlatformBusiness,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${headingClass}`}>Businesses</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>
            Create client installations and assign each to a single business system.
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New business"}
        </Button>
      </div>

      {showForm ? (
        <form
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            createMut.mutate(form);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Business name">
              <input
                className={fieldInputClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
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
                {(systemTypes.data ?? Object.entries(SYSTEM_TYPE_LABELS).map(([id, label]) => ({ id: id as SystemType, label }))).map(
                  (opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ),
                )}
              </select>
            </Field>
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
                className={fieldInputClass}
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                required
              />
            </Field>
            <Field label="Admin password">
              <input
                type="password"
                className={fieldInputClass}
                value={form.adminPassword}
                onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                minLength={8}
                required
              />
            </Field>
            <Field label="Licence plan">
              <input
                className={fieldInputClass}
                value={form.licencePlan ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, licencePlan: e.target.value }))}
              />
            </Field>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={createMut.isPending}>
            {createMut.isPending ? "Creating…" : "Create business + system admin"}
          </Button>
        </form>
      ) : null}

      {businesses.isLoading ? (
        <p className={mutedClass}>Loading businesses…</p>
      ) : businesses.error ? (
        <p className="text-sm text-red-600">
          {businesses.error instanceof Error ? businesses.error.message : "Failed to load"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">System</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(businesses.data ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.name}</p>
                    <p className={`text-xs ${mutedClass}`}>{b.userCount ?? 0} users</p>
                  </td>
                  <td className="px-4 py-3">{SYSTEM_TYPE_LABELS[b.systemType]}</td>
                  <td className="px-4 py-3 capitalize">{b.status}</td>
                  <td className="px-4 py-3">{b.adminEmail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {STATUS_ACTIONS.filter((a) => a.status !== b.status).map((a) => (
                        <button
                          key={a.status}
                          type="button"
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          disabled={updateMut.isPending}
                          onClick={() => updateMut.mutate({ id: b.id, status: a.status })}
                        >
                          {a.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                        disabled={deleteMut.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete business “${b.name}”?`)) {
                            deleteMut.mutate(b.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}
