import { Button } from "@platform/ui";
import { SYSTEM_TYPE_LABELS } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchPlatformUsers,
  resetPlatformUserPassword,
  updatePlatformUser,
} from "../lib/platformApi";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

export function SuperAdminUsersPage(): JSX.Element {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["platform", "users"], queryFn: fetchPlatformUsers });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users.data ?? []).filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (roleFilter === "super_admin" && u.platformRole !== "super_admin") return false;
      if (roleFilter === "admin" && !["owner", "admin"].includes(u.role)) return false;
      if (roleFilter === "staff" && (u.platformRole === "super_admin" || ["owner", "admin", "none"].includes(u.role)))
        return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.businessName ?? "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users.data, search, statusFilter, roleFilter]);

  const resetMut = useMutation({
    mutationFn: ({ userId, password: pw }: { userId: string; password: string }) =>
      resetPlatformUserPassword(userId, pw),
    onSuccess: async () => {
      setResetFor(null);
      setPassword("");
      setMessage("Password updated and active sessions revoked.");
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Reset failed"),
  });

  const statusMut = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string;
      status: "active" | "inactive" | "suspended";
    }) => updatePlatformUser(userId, { status }),
    onSuccess: async () => {
      setMessage("User status updated.");
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Update failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-lg font-semibold ${headingClass}`}>All users</h2>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          Manage accounts across every business — activate, suspend, or reset passwords.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <input
          className={`${fieldInputClass} max-w-xs`}
          placeholder="Search name, email, business…"
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
        <select
          className={`${fieldInputClass} max-w-[10rem]`}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Business admin</option>
          <option value="staff">Staff</option>
        </select>
      </div>

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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`px-4 py-8 text-center ${mutedClass}`}>
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={`${u.id}-${u.businessId ?? "platform"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name ?? u.email}</p>
                      <p className={`text-xs ${mutedClass}`}>{u.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize">{u.role.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3">
                      {u.platformRole === "super_admin" ? (
                        <span>Platform</span>
                      ) : u.businessId ? (
                        <Link
                          to={`/super-admin/businesses/${u.businessId}`}
                          className="text-amber-700 hover:underline dark:text-amber-400"
                        >
                          {u.businessName ?? "—"}
                          {u.systemType ? ` · ${SYSTEM_TYPE_LABELS[u.systemType]}` : ""}
                        </Link>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{u.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.platformRole !== "super_admin" ? (
                          u.status !== "active" ? (
                            <button
                              type="button"
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ userId: u.id, status: "active" })}
                            >
                              Activate
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                disabled={statusMut.isPending}
                                onClick={() => statusMut.mutate({ userId: u.id, status: "inactive" })}
                              >
                                Deactivate
                              </button>
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                disabled={statusMut.isPending}
                                onClick={() => statusMut.mutate({ userId: u.id, status: "suspended" })}
                              >
                                Suspend
                              </button>
                            </>
                          )
                        ) : null}

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
                              onClick={() => {
                                if (window.confirm(`Reset password for ${u.email}? Active sessions will be revoked.`)) {
                                  resetMut.mutate({ userId: u.id, password });
                                }
                              }}
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
