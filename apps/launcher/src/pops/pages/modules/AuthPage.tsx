import { Button } from "@platform/ui";
import {
  canManageOrgUsers,
  hasModuleAccess,
  permissionsForPopsRole,
  POPS_MODULE_ACCESS,
  POPS_ROLE_TEMPLATES,
  toggleModulePermission,
  type CreateOrgUser,
  type InviteOrgUser,
  type InviteOrgUserResult,
  type OrgUser,
  type PopsRole,
  type RoleTemplate,
  type UpdateOrgUser,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSessionStore } from "../../../stores/sessionStore";
import { fetchPopsBranches } from "../../api/operations";
import {
  createOrgUser,
  fetchAccessControl,
  fetchOrgUsers,
  fetchPendingInvites,
  inviteOrgUser,
  resetOrgUserPassword,
  updateOrgUser,
} from "../../api/users";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import { usePopsStore } from "../../../stores/popsStore";
import { getUserPin, setUserPin } from "../../lib/posPinAuth";
import { popsNavItems } from "../../spec/modules";
import {
  allRestaurantNavPaths,
  primaryPermissionForNavPath,
} from "../../lib/roleAccess";

function formatLastActivity(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "Now";
  if (diffMs < 3_600_000) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function capabilityCell(access: "allow" | "pin" | "deny" | undefined): JSX.Element {
  if (access === "allow") return <span className="text-emerald-400">✓</span>;
  if (access === "pin") return <span className="text-amber-400">PIN</span>;
  return <span className="text-slate-600">—</span>;
}

type UserFormState = {
  email: string;
  password: string;
  role: PopsRole;
  branchScope: string;
  pinRequired: boolean;
  staffPin: string;
  active: boolean;
  permissions: string[];
  /** null = all pages allowed by module permissions. */
  navAllowlist: string[] | null;
};

const defaultForm = (): UserFormState => ({
  email: "",
  password: "",
  role: "cashier",
  branchScope: "all",
  pinRequired: true,
  staffPin: "",
  active: true,
  permissions: permissionsForPopsRole("cashier"),
  navAllowlist: null,
});

function pathIsOn(allowlist: string[] | null, path: string): boolean {
  if (allowlist == null) return true;
  return allowlist.includes(path);
}

function materializeAllowlist(current: string[] | null): string[] {
  if (current != null) return [...current];
  return allRestaurantNavPaths(popsNavItems);
}

function toggleNavPath(
  form: UserFormState,
  path: string,
  enabled: boolean,
): Pick<UserFormState, "navAllowlist" | "permissions"> {
  let next = materializeAllowlist(form.navAllowlist);
  if (enabled) {
    if (!next.includes(path)) next.push(path);
  } else {
    next = next.filter((p) => p !== path);
  }
  let permissions = form.permissions;
  if (enabled) {
    const needed = primaryPermissionForNavPath(path);
    if (!hasModuleAccess(permissions, needed) && needed !== "*") {
      permissions = toggleModulePermission(permissions, needed, true);
    }
  }
  return { navAllowlist: next, permissions };
}

function toggleNavGroup(
  form: UserFormState,
  paths: string[],
  enabled: boolean,
): Pick<UserFormState, "navAllowlist" | "permissions"> {
  let next = materializeAllowlist(form.navAllowlist);
  let permissions = form.permissions;
  if (enabled) {
    for (const path of paths) {
      if (!next.includes(path)) next.push(path);
      const needed = primaryPermissionForNavPath(path);
      if (!hasModuleAccess(permissions, needed) && needed !== "*") {
        permissions = toggleModulePermission(permissions, needed, true);
      }
    }
  } else {
    const remove = new Set(paths);
    next = next.filter((p) => !remove.has(p));
  }
  return { navAllowlist: next, permissions };
}

function UserFormModal({
  title,
  initial,
  branchOptions,
  roleOptions,
  requirePassword,
  showPassword = true,
  showAccessControls = false,
  emailHint,
  submitLabel,
  error,
  loading,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: UserFormState;
  branchOptions: { value: string; label: string }[];
  roleOptions: { id: PopsRole; label: string }[];
  requirePassword: boolean;
  showPassword?: boolean;
  /** Account on/off + module permission toggles (edit / add). */
  showAccessControls?: boolean;
  emailHint?: string;
  submitLabel: string;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormState) => void;
}): JSX.Element {
  const [form, setForm] = useState<UserFormState>(initial);
  const isAdminAccount = form.role === "admin" || form.permissions.includes("*");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/60">
      <div
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl ${
          showAccessControls ? "max-w-2xl max-h-[90vh] overflow-y-auto" : "max-w-md"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
      >
        <h2 id="user-form-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <label className="block text-xs text-slate-400">
            Email
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={!requirePassword && title.includes("Edit")}
              autoComplete="username"
              required
            />
            {emailHint ? <span className="mt-1 block text-slate-500">{emailHint}</span> : null}
          </label>
          {showPassword ? (
            <label className="block text-xs text-slate-400">
              {requirePassword ? "Password" : "New password (optional)"}
              <input
                type="password"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete={requirePassword ? "new-password" : "off"}
                required={requirePassword}
                minLength={8}
              />
            </label>
          ) : null}
          <label className="block text-xs text-slate-400">
            Role
            <select
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as PopsRole;
                setForm((f) => ({
                  ...f,
                  role,
                  permissions: permissionsForPopsRole(role),
                  navAllowlist: null,
                }));
              }}
            >
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Branch scope
            <select
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              value={form.branchScope}
              onChange={(e) => setForm((f) => ({ ...f, branchScope: e.target.value }))}
            >
              {branchOptions.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="accent-amber-500"
              checked={form.pinRequired}
              onChange={(e) => setForm((f) => ({ ...f, pinRequired: e.target.checked }))}
            />
            Require PIN for sensitive actions
          </label>
          <label className="block text-xs text-slate-400">
            POS login PIN (4 digits)
            <input
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm tracking-[0.4em] text-white outline-none focus:border-amber-500/50"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              value={form.staffPin}
              onChange={(e) =>
                setForm((f) => ({ ...f, staffPin: e.target.value.replace(/\D/g, "").slice(0, 4) }))
              }
              placeholder="••••"
            />
          </label>

          {showAccessControls ? (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-100">System access</div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Modules control API capabilities. Menu pages control what appears in the sidebar. Changing role
                    resets both to that role&apos;s defaults.
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    className="accent-amber-500"
                    checked={form.active}
                    disabled={isAdminAccount}
                    title={isAdminAccount ? "Admin accounts stay active" : undefined}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  Account enabled
                </label>
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Modules</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {POPS_MODULE_ACCESS.map((mod) => {
                    const on = hasModuleAccess(form.permissions, mod.id);
                    const lockAdminManage = isAdminAccount && mod.id === "pops.users.manage";
                    return (
                      <label
                        key={mod.id}
                        className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                          on
                            ? "border-amber-500/40 bg-amber-500/10 text-slate-100"
                            : "border-slate-800 bg-slate-900/60 text-slate-400"
                        } ${lockAdminManage ? "opacity-60" : ""}`}
                        title={mod.description}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-amber-500"
                          checked={on}
                          disabled={lockAdminManage}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              permissions: toggleModulePermission(f.permissions, mod.id, e.target.checked),
                            }))
                          }
                        />
                        <span>
                          <span className="block font-medium">{mod.label}</span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">{mod.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Menu pages</div>
                  <button
                    type="button"
                    className="text-[11px] text-sky-400 hover:text-sky-300"
                    onClick={() => setForm((f) => ({ ...f, navAllowlist: null }))}
                  >
                    Allow all pages for modules
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  {popsNavItems.map((item) => {
                    if (item.type === "link") {
                      const on = pathIsOn(form.navAllowlist, item.path);
                      return (
                        <label
                          key={item.path}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${
                            on
                              ? "border-sky-500/40 bg-sky-500/10 text-slate-100"
                              : "border-slate-800 bg-slate-900/60 text-slate-400"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-sky-500"
                            checked={on}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, ...toggleNavPath(f, item.path, e.target.checked) }))
                            }
                          />
                          <span className="font-medium">{item.label}</span>
                        </label>
                      );
                    }

                    const childPaths = item.children.map((c) => c.path);
                    const allOn = childPaths.every((p) => pathIsOn(form.navAllowlist, p));
                    const someOn = childPaths.some((p) => pathIsOn(form.navAllowlist, p));
                    return (
                      <div key={item.label} className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-100">
                          <input
                            type="checkbox"
                            className="accent-sky-500"
                            checked={allOn}
                            ref={(el) => {
                              if (el) el.indeterminate = someOn && !allOn;
                            }}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, ...toggleNavGroup(f, childPaths, e.target.checked) }))
                            }
                          />
                          {item.label}
                          <span className="font-normal text-slate-500">
                            ({childPaths.filter((p) => pathIsOn(form.navAllowlist, p)).length}/{childPaths.length})
                          </span>
                        </label>
                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          {item.children.map((child) => {
                            const on = pathIsOn(form.navAllowlist, child.path);
                            return (
                              <label
                                key={child.path}
                                className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-[11px] ${
                                  on
                                    ? "border-sky-500/30 bg-sky-500/5 text-slate-200"
                                    : "border-slate-800/80 text-slate-500"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="accent-sky-500"
                                  checked={on}
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      ...toggleNavPath(f, child.path, e.target.checked),
                                    }))
                                  }
                                />
                                {child.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" className="text-xs" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="text-xs" disabled={loading}>
              {loading ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AuthPage(): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage = canManageOrgUsers(claims?.permissions ?? []);

  const [modal, setModal] = useState<"add" | "invite" | "edit" | "reset" | null>(null);
  const [selected, setSelected] = useState<OrgUser | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteOrgUserResult | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users", "list"],
    queryFn: fetchOrgUsers,
    enabled: canManage,
  });

  const accessQuery = useQuery({
    queryKey: ["users", "access-control"],
    queryFn: fetchAccessControl,
    enabled: canManage,
  });

  const branchesQuery = useQuery({
    queryKey: ["operations", "branches"],
    queryFn: fetchPopsBranches,
    enabled: canManage,
  });

  const invitesQuery = useQuery({
    queryKey: ["users", "invites"],
    queryFn: fetchPendingInvites,
    enabled: canManage,
  });

  const branchOptions = useMemo(() => {
    const opts = [{ value: "all", label: "All branches" }];
    for (const b of branchesQuery.data ?? []) {
      opts.push({ value: b.code, label: `${b.name} (${b.code})` });
    }
    return opts;
  }, [branchesQuery.data]);

  const roleOptions = useMemo(
    () => POPS_ROLE_TEMPLATES.map((r) => ({ id: r.id, label: r.label })),
    [],
  );

  const matrixRoles: RoleTemplate[] = accessQuery.data?.roles ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateOrgUser) => createOrgUser(input),
    onSuccess: () => {
      invalidate();
      setModal(null);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: (input: InviteOrgUser) => inviteOrgUser(input),
    onSuccess: (result) => {
      invalidate();
      setModal(null);
      setFormError(null);
      setInviteResult(result);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOrgUser }) => updateOrgUser(id, input),
    onSuccess: () => {
      invalidate();
      setModal(null);
      setSelected(null);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetOrgUserPassword(id, password),
    onSuccess: () => {
      invalidate();
      setModal(null);
      setSelected(null);
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function openEdit(user: OrgUser): void {
    setSelected(user);
    setFormError(null);
    setModal("edit");
  }

  function userToForm(user: OrgUser): UserFormState {
    const roleId =
      POPS_ROLE_TEMPLATES.find((r) => r.label === user.role)?.id ??
      (user.role.toLowerCase() as PopsRole);
    const role = roleId === "admin" ? "admin" : roleId;
    return {
      email: user.email,
      password: "",
      role,
      branchScope: user.branchScope === "All" ? "all" : user.branchScope,
      pinRequired: user.pinRequired,
      staffPin: branch?.code ? (getUserPin(branch.code, user.id) ?? "") : "",
      active: user.active !== false,
      permissions:
        user.permissions?.length > 0 ? [...user.permissions] : permissionsForPopsRole(role),
      navAllowlist: user.navAllowlist ?? null,
    };
  }

  if (!canManage) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Users & access"
          subtitle="You need the pops.users.manage permission to administer users."
        />
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Sign out and sign in again if you were just granted admin access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users & access"
        subtitle="Roles, branch scope, PIN policy, device allow list, and session control."
        actions={
          <>
            <Button
              variant="ghost"
              className="text-xs"
              disabled={!selected}
              onClick={() => {
                if (selected) {
                  setFormError(null);
                  setModal("reset");
                }
              }}
            >
              Password reset
            </Button>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => {
                setFormError(null);
                setModal("add");
              }}
            >
              Add user
            </Button>
            <Button
              className="text-xs"
              onClick={() => {
                setFormError(null);
                setModal("invite");
              }}
            >
              Invite user
            </Button>
          </>
        }
      />

      {usersQuery.isLoading ? <p className="text-sm text-slate-400">Loading users…</p> : null}
      {usersQuery.isError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Could not load users. Check your connection and try again.
          <span className="mt-1 block text-[11px] opacity-70">
            {(usersQuery.error as Error).message?.slice(0, 180)}
          </span>
        </p>
      ) : null}

      {inviteResult ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-medium">
            {inviteResult.emailSent
              ? `Invitation email sent to ${inviteResult.email}`
              : `Invitation created for ${inviteResult.email} (SMTP not configured — share link below)`}
          </p>
          <p className="mt-2 break-all text-xs text-emerald-200/90">{inviteResult.inviteUrl}</p>
          <Button
            variant="ghost"
            className="mt-2 text-xs"
            onClick={() => void navigator.clipboard.writeText(inviteResult.inviteUrl)}
          >
            Copy invite link
          </Button>
        </div>
      ) : null}

      {(invitesQuery.data?.length ?? 0) > 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
          <div className="text-sm font-medium text-white">Pending invitations</div>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {invitesQuery.data?.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 rounded-md bg-slate-950/50 px-3 py-2">
                <span className="font-medium text-slate-100">{inv.email}</span>
                <Badge tone="neutral">{inv.role}</Badge>
                <span className="text-xs text-slate-500">{inv.branchScope}</span>
                <span className="text-xs text-slate-600">expires {formatLastActivity(inv.expiresAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="text-sm font-medium text-white">Permission matrix</div>
        <p className="mt-1 text-xs text-slate-500">Capabilities by role template (stored permissions sync on save).</p>
        <div className="mt-3 overflow-x-auto text-xs">
          <table className="w-full border-collapse text-left">
            <thead className="text-slate-500">
              <tr>
                <th className="border border-slate-800 p-2">Capability</th>
                {matrixRoles.map((r) => (
                  <th key={r.id} className="border border-slate-800 p-2">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {(accessQuery.data?.capabilities ?? []).map((cap) => (
                <tr key={cap.id}>
                  <td className="border border-slate-800 p-2">{cap.label}</td>
                  {matrixRoles.map((r) => (
                    <td key={r.id} className="border border-slate-800 p-2 text-center">
                      {capabilityCell(r.capabilities[cap.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SimpleTable
        rowKey={(r) => r.id}
        columns={[
          {
            key: "email",
            header: "User",
            render: (r) => (
              <button
                type="button"
                className={`text-left ${selected?.id === r.id ? "font-medium text-amber-300" : "text-slate-200 hover:text-white"}`}
                onClick={() => setSelected(r)}
              >
                {r.email}
              </button>
            ),
          },
          { key: "role", header: "Role", render: (r) => <Badge tone="neutral">{r.role}</Badge> },
          { key: "branchScope", header: "Branch scope" },
          {
            key: "active",
            header: "Access",
            render: (r) =>
              r.active ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>,
          },
          {
            key: "pinRequired",
            header: "PIN",
            id: "pin",
            render: (r) =>
              r.pinRequired ? <Badge tone="success">On</Badge> : <Badge tone="neutral">Off</Badge>,
          },
          {
            key: "lastActivityAt",
            header: "Last activity",
            render: (r) => formatLastActivity(r.lastActivityAt),
          },
          {
            key: "actions",
            header: "",
            id: "actions",
            render: (r) => (
              <Button
                variant="ghost"
                className="text-xs"
                onClick={() => openEdit(r)}
              >
                Edit
              </Button>
            ),
          },
        ]}
        rows={usersQuery.data ?? []}
      />

      {modal === "add" ? (
        <UserFormModal
          title="Add user"
          initial={defaultForm()}
          branchOptions={branchOptions}
          roleOptions={roleOptions}
          requirePassword
          showPassword
          showAccessControls
          emailHint="Creates the account immediately with this password."
          submitLabel="Create user"
          error={formError}
          loading={createMutation.isPending}
          onClose={() => setModal(null)}
          onSubmit={(values) => {
            const input: CreateOrgUser = {
              email: values.email,
              password: values.password,
              role: values.role,
              branchScope: values.branchScope,
              pinRequired: values.pinRequired,
              ...(values.staffPin ? { staffPin: values.staffPin } : {}),
            };
            void createOrgUser(input)
              .then(async (user) => {
                await updateOrgUser(user.id, {
                  permissions: values.permissions,
                  active: values.active,
                  navAllowlist: values.navAllowlist,
                });
                if (branch?.code && values.staffPin) {
                  setUserPin(branch.code, user.id, values.staffPin);
                }
                invalidate();
                setModal(null);
                setFormError(null);
              })
              .catch((err: Error) => setFormError(err.message));
          }}
        />
      ) : null}

      {modal === "invite" ? (
        <UserFormModal
          title="Invite user"
          initial={{ ...defaultForm(), password: "" }}
          branchOptions={branchOptions}
          roleOptions={roleOptions}
          requirePassword={false}
          showPassword={false}
          emailHint="Sends an email with a link to set their password (7-day expiry)."
          submitLabel="Send invitation"
          error={formError}
          loading={inviteMutation.isPending}
          onClose={() => setModal(null)}
          onSubmit={(values) => {
            const input: InviteOrgUser = {
              email: values.email,
              role: values.role,
              branchScope: values.branchScope,
              pinRequired: values.pinRequired,
            };
            inviteMutation.mutate(input);
          }}
        />
      ) : null}

      {modal === "edit" && selected ? (
        <UserFormModal
          title={`Edit — ${selected.email}`}
          initial={userToForm(selected)}
          branchOptions={branchOptions}
          roleOptions={roleOptions}
          requirePassword={false}
          showAccessControls
          submitLabel="Save changes"
          error={formError}
          loading={updateMutation.isPending}
          onClose={() => { setModal(null); setSelected(null); }}
          onSubmit={(values) => {
            const input: UpdateOrgUser = {
              role: values.role,
              branchScope: values.branchScope,
              pinRequired: values.pinRequired,
              permissions: values.permissions,
              active: values.active,
              navAllowlist: values.navAllowlist,
            };
            if (values.password.trim()) input.password = values.password;
            if (values.staffPin) input.staffPin = values.staffPin;
            if (branch?.code && values.staffPin) {
              setUserPin(branch.code, selected.id, values.staffPin);
            }
            updateMutation.mutate({ id: selected.id, input });
          }}
        />
      ) : null}

      {modal === "reset" && selected ? (
        <UserFormModal
          title={`Reset password — ${selected.email}`}
          initial={{ ...userToForm(selected), password: "" }}
          branchOptions={branchOptions}
          roleOptions={roleOptions}
          requirePassword
          submitLabel="Reset password"
          error={formError}
          loading={resetMutation.isPending}
          onClose={() => { setModal(null); setSelected(null); }}
          onSubmit={(values) => {
            resetMutation.mutate({ id: selected.id, password: values.password });
          }}
        />
      ) : null}
    </div>
  );
}
