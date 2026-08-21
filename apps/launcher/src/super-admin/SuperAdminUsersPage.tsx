import { Button } from "@platform/ui";
import { SYSTEM_TYPE_LABELS } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createPlatformUser,
  fetchPlatformBusinesses,
  fetchPlatformUsers,
  resetPlatformUserPassword,
  updatePlatformUser,
  deletePlatformUser,
} from "../lib/platformApi";
import { SuperAdminAddUserModal } from "./SuperAdminAddUserModal";
import { SuperAdminUserViewModal } from "./SuperAdminUserViewModal";
import type { PlatformUser } from "@platform/contracts";
import {
  saBtnAccentClass,
  saBtnDangerClass,
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

export function SuperAdminUsersPage(): JSX.Element {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["platform", "users"], queryFn: fetchPlatformUsers });
  const businesses = useQuery({
    queryKey: ["platform", "businesses"],
    queryFn: fetchPlatformBusinesses,
  });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [viewUser, setViewUser] = useState<PlatformUser | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

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
      if (viewUser) {
        const next = await qc.fetchQuery({ queryKey: ["platform", "users"], queryFn: fetchPlatformUsers });
        const refreshed = next.find((u) => u.id === viewUser.id && u.businessId === viewUser.businessId);
        if (refreshed) setViewUser(refreshed);
      }
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

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deletePlatformUser(userId),
    onSuccess: async () => {
      setMessage("User deleted and archived. Login email can be reused.");
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Delete failed"),
  });

  const createMut = useMutation({
    mutationFn: createPlatformUser,
    onSuccess: async (created) => {
      setAddOpen(false);
      setMessage(`User ${created.email} added. Password saved — use Show password to view.`);
      await qc.invalidateQueries({ queryKey: ["platform", "users"] });
    },
    onError: (err) => setMessage(err instanceof Error ? err.message : "Create failed"),
  });

  function userKey(u: PlatformUser): string {
    return `${u.id}-${u.businessId ?? "platform"}`;
  }

  function togglePassword(u: PlatformUser): void {
    const key = userKey(u);
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${headingClass}`}>All users</h2>
          <p className={`mt-1 text-sm ${saPageSubClass}`}>
            Manage live accounts across every business — add users, view saved passwords, activate,
            suspend, or delete (archived backup; removed from this list).
          </p>
        </div>
        <button
          type="button"
          className={saBtnPrimaryClass}
          disabled={businesses.isLoading || (businesses.data?.length ?? 0) === 0}
          onClick={() => {
            setMessage(null);
            setAddOpen(true);
          }}
        >
          Add user
        </button>
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
        <div className={saTableWrapClass}>
          <table className="min-w-full text-left text-sm">
            <thead className={saTableHeadClass}>
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Business / system</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Password</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`px-4 py-8 text-center ${mutedClass}`}>
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
                          className={saLinkClass}
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
                      {u.lastSetPassword?.trim() ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-slate-800">
                            {revealed[userKey(u)] ? u.lastSetPassword : "••••••••"}
                          </code>
                          <button
                            type="button"
                            className="text-xs text-teal-700 hover:underline dark:text-teal-300"
                            onClick={() => togglePassword(u)}
                          >
                            {revealed[userKey(u)] ? "Hide" : "Show"}
                          </button>
                        </div>
                      ) : (
                        <span className={`text-xs ${mutedClass}`}>Not stored</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className={saBtnAccentClass}
                          onClick={() => {
                            setMessage(null);
                            setViewUser(u);
                          }}
                        >
                          View
                        </button>
                        {u.lastSetPassword?.trim() ? (
                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                            onClick={() => togglePassword(u)}
                          >
                            {revealed[userKey(u)] ? "Hide password" : "See password"}
                          </button>
                        ) : null}
                        {u.platformRole !== "super_admin" ? (
                          u.status !== "active" ? (
                            <button
                              type="button"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ userId: u.id, status: "active" })}
                            >
                              Activate
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                                disabled={statusMut.isPending}
                                onClick={() => statusMut.mutate({ userId: u.id, status: "inactive" })}
                              >
                                Deactivate
                              </button>
                              <button
                                type="button"
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
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
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
                            onClick={() => {
                              setMessage(null);
                              setResetFor(u.id);
                              setPassword("");
                            }}
                          >
                            Reset password
                          </button>
                        )}

                        {u.platformRole !== "super_admin" ? (
                          <button
                            type="button"
                            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
                            disabled={deleteMut.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete user “${u.email}”? They disappear from live lists (backup kept). Login email can be reused. Customer records are not affected.`,
                                )
                              ) {
                                setMessage(null);
                                deleteMut.mutate(u.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewUser ? (
        <SuperAdminUserViewModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          resetPending={resetMut.isPending}
          onResetPassword={(userId, pw) => resetMut.mutate({ userId, password: pw })}
        />
      ) : null}

      {addOpen && businesses.data && businesses.data.length > 0 ? (
        <SuperAdminAddUserModal
          businesses={businesses.data}
          pending={createMut.isPending}
          onClose={() => setAddOpen(false)}
          onCreate={(input) => createMut.mutate(input)}
        />
      ) : null}
    </div>
  );
}
