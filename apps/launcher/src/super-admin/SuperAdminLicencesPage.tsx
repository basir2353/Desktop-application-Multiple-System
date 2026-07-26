import { Button } from "@platform/ui";
import { SYSTEM_TYPE_LABELS } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchPlatformBusinesses, updatePlatformBusiness } from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

export function SuperAdminLicencesPage(): JSX.Element {
  const qc = useQueryClient();
  const businesses = useQuery({ queryKey: ["platform", "businesses"], queryFn: fetchPlatformBusinesses });
  const [editing, setEditing] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [key, setKey] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const updateMut = useMutation({
    mutationFn: (businessId: string) =>
      updatePlatformBusiness(businessId, {
        licencePlan: plan || null,
        licenceKey: key || null,
        licenceExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      }),
    onSuccess: async () => {
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["platform", "businesses"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Licences & subscriptions</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Activate plans and set expiry dates for each client installation.
        </p>
      </div>

      {businesses.isLoading ? (
        <p className={mutedClass}>Loading…</p>
      ) : (
        <ul className="space-y-3">
          {(businesses.data ?? []).map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className={`text-sm ${mutedClass}`}>
                    {SYSTEM_TYPE_LABELS[b.systemType]} · {b.status}
                  </p>
                  <p className={`mt-1 text-sm ${mutedClass}`}>
                    Plan: {b.licencePlan ?? "—"} · Key: {b.licenceKey ?? "—"}
                    {b.licenceExpiresAt
                      ? ` · Expires ${new Date(b.licenceExpiresAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(b.id);
                    setPlan(b.licencePlan ?? "");
                    setKey(b.licenceKey ?? "");
                    setExpiresAt(
                      b.licenceExpiresAt ? b.licenceExpiresAt.slice(0, 10) : "",
                    );
                  }}
                >
                  Edit licence
                </Button>
              </div>

              {editing === b.id ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="text-sm">
                    <span className="mb-1 block">Plan</span>
                    <input className={fieldInputClass} value={plan} onChange={(e) => setPlan(e.target.value)} />
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
                  <div className="flex gap-2 sm:col-span-3">
                    <Button type="button" disabled={updateMut.isPending} onClick={() => updateMut.mutate(b.id)}>
                      Save
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
