import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchPlatformUsers,
  resetPlatformUserPassword,
  updatePlatformUser,
} from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

export function SuperAdminSecurityPage(): JSX.Element {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["platform", "users"], queryFn: fetchPlatformUsers });
  const [filter, setFilter] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (users.data ?? []).filter(
      (u) =>
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.businessName ?? "").toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q),
    );
  }, [users.data, filter]);

  const inactive = (users.data ?? []).filter((u) => u.status !== "active" || u.active === false);
  const byBusiness = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users.data ?? []) {
      const key = u.businessName ?? u.businessId ?? "Platform";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [users.data]);

  const toggleMut = useMutation({
    mutationFn: (args: { userId: string; status: "active" | "inactive" }) =>
      updatePlatformUser(args.userId, { status: args.status }),
    onSuccess: async () => {
      setMessage("User access updated.");
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const resetMut = useMutation({
    mutationFn: () => resetPlatformUserPassword(resetFor!, password),
    onSuccess: async () => {
      setMessage("Password reset. User must sign in again.");
      setResetFor(null);
      setPassword("");
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>Security</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Cross-business user access. After Super Admin module or tax changes, business users must
          refresh / re-login so JWT permissions update.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total users" value={users.data?.length ?? 0} />
        <Stat label="Inactive / disabled" value={inactive.length} warn={inactive.length > 0} />
        <Stat label="Businesses with users" value={byBusiness.length} />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        Tip: Module ceiling and FBR/PRA flags apply on next login or token refresh. Ask the business
        admin to sign out and back in after you change access.
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <h3 className="text-sm font-semibold">Users per business</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {byBusiness.map(([name, count]) => (
            <li
              key={name}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800"
            >
              <span className="truncate pr-2">{name}</span>
              <span className="font-semibold">{count}</span>
            </li>
          ))}
        </ul>
      </section>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter users…"
        className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
      />

      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/60">
        {rows.slice(0, 80).map((u) => {
          const active = u.status === "active" && u.active !== false;
          return (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{u.email}</p>
                <p className={`text-xs ${mutedClass}`}>
                  {u.name ?? "—"} · {u.businessName ?? "Platform"} ·{" "}
                  {active ? "active" : "disabled"}
                </p>
                {u.businessId ? (
                  <Link
                    to={`/super-admin/businesses/${u.businessId}`}
                    className="text-xs text-amber-700 hover:underline dark:text-amber-400"
                  >
                    Open business
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={toggleMut.isPending}
                  onClick={() =>
                    toggleMut.mutate({
                      userId: u.id,
                      status: active ? "inactive" : "active",
                    })
                  }
                >
                  {active ? "Disable" : "Enable"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setResetFor(u.id)}>
                  Reset password
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {resetFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-semibold">Reset password</h3>
            <input
              type="password"
              className={fieldInputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (min 8)"
              minLength={8}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setResetFor(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={password.length < 8 || resetMut.isPending}
                onClick={() => resetMut.mutate()}
              >
                Save password
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}): JSX.Element {
  return (
    <div
      className={`rounded-xl border p-4 ${
        warn
          ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
      }`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
