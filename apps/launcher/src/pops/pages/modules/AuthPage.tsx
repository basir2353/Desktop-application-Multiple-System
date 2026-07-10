import { Button } from "@platform/ui";
import {
  POPS_ROLE_TEMPLATES,
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
};

const defaultForm = (): UserFormState => ({
  email: "",
  password: "",
  role: "cashier",
  branchScope: "all",
  pinRequired: true,
  staffPin: "",
});

function UserFormModal({
  title,
  initial,
  branchOptions,
  roleOptions,
  requirePassword,
  showPassword = true,
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
  emailHint?: string;
  submitLabel: string;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormState) => void;
}): JSX.Element {
  const [form, setForm] = useState<UserFormState>(initial);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/60">
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
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
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as PopsRole }))}
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
  const canManage =
    claims?.permissions.includes("*") || claims?.permissions.includes("pops.users.manage");

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
    return {
      email: user.email,
      password: "",
      role: roleId === "admin" ? "admin" : roleId,
      branchScope: user.branchScope === "All" ? "all" : user.branchScope,
      pinRequired: user.pinRequired,
      staffPin: branch?.code ? (getUserPin(branch.code, user.id) ?? "") : "",
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
          {(usersQuery.error as Error).message}
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
            void createOrgUser(input).then((user) => {
              if (branch?.code && values.staffPin) {
                setUserPin(branch.code, user.id, values.staffPin);
              }
              invalidate();
              setModal(null);
              setFormError(null);
            }).catch((err: Error) => setFormError(err.message));
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
          submitLabel="Save changes"
          error={formError}
          loading={updateMutation.isPending}
          onClose={() => { setModal(null); setSelected(null); }}
          onSubmit={(values) => {
            const input: UpdateOrgUser = {
              role: values.role,
              branchScope: values.branchScope,
              pinRequired: values.pinRequired,
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
