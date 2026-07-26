import { Button } from "@platform/ui";
import { SYSTEM_TYPE_LABELS } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchPlatformUsers, resetPlatformUserPassword } from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

export function SuperAdminUsersPage(): JSX.Element {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["platform", "users"], queryFn: fetchPlatformUsers });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const resetMut = useMutation({
    mutationFn: ({ userId, password: pw }: { userId: string; password: string }) =>
      resetPlatformUserPassword(userId, pw),
    onSuccess: async () => {
      setResetFor(null);
      setPassword("");
      setMessage("Password updated.");
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Reset failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>All users</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Every account across every business system. Reset administrator passwords here.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}

      {users.isLoading ? (
        <p className={mutedClass}>Loading users…</p>
      ) : users.error ? (
        <p className="text-sm text-red-600">
          {users.error instanceof Error ? users.error.message : "Failed to load"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Business / system</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(users.data ?? []).map((u) => (
                <tr key={`${u.id}-${u.businessId ?? "platform"}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.name ?? u.email}</p>
                    <p className={`text-xs ${mutedClass}`}>{u.email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{u.role.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">
                    {u.platformRole === "super_admin" ? (
                      <span>Platform</span>
                    ) : (
                      <span>
                        {u.businessName ?? "—"}
                        {u.systemType ? ` · ${SYSTEM_TYPE_LABELS[u.systemType]}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{u.active ? "active" : "inactive"}</td>
                  <td className="px-4 py-3">
                    {resetFor === u.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="password"
                          className={`${fieldInputClass} !w-40`}
                          placeholder="New password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          minLength={8}
                        />
                        <Button
                          type="button"
                          disabled={password.length < 8 || resetMut.isPending}
                          onClick={() => resetMut.mutate({ userId: u.id, password })}
                        >
                          Save
                        </Button>
                        <button
                          type="button"
                          className="text-xs text-slate-500"
                          onClick={() => setResetFor(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        onClick={() => {
                          setMessage(null);
                          setResetFor(u.id);
                          setPassword("");
                        }}
                      >
                        Reset password
                      </button>
                    )}
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
