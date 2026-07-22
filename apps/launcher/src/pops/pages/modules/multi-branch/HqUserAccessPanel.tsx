import {
  canManageOrgUsers,
  hasModuleAccess,
  POPS_MODULE_ACCESS,
  toggleModulePermission,
  type OrgUser,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOrgUsers, updateOrgUser } from "../../../api/users";
import { isMonitoringBranch } from "../../../lib/branchScope";
import { useSessionStore } from "../../../../stores/sessionStore";
import { usePopsStore } from "../../../../stores/popsStore";
import { Badge } from "../../../ui/Badge";

export function HqUserAccessPanel(): JSX.Element | null {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage = canManageOrgUsers(claims?.permissions ?? []);
  const onHq = isMonitoringBranch(branch?.code);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users", "list"],
    queryFn: fetchOrgUsers,
    enabled: canManage && onHq,
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: { active?: boolean; permissions?: string[] } }) =>
      updateOrgUser(userId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      setError(null);
      setNotice("Access updated. Users must re-login for JWT changes to apply.");
    },
    onError: (err: Error) => {
      setNotice(null);
      setError(err.message);
    },
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  if (!canManage) return null;

  if (!onHq) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="text-sm font-medium text-amber-100">Head Office user access</div>
        <p className="mt-1 text-xs text-slate-400">
          Switch to <span className="font-medium text-slate-200">Head Office (monitoring)</span> to turn module access
          on or off for other users across the network.
        </p>
        <Link
          to="/pops/branches"
          className="mt-3 inline-flex text-xs font-medium text-sky-400 hover:text-sky-300"
        >
          Switch branch →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-white">Head Office · User access</div>
          <p className="mt-1 text-xs text-slate-500">
            Turn account and module access on or off for each user. Changes apply on their next login.
          </p>
        </div>
        <Link to="/pops/auth" className="text-xs font-medium text-sky-400 hover:text-sky-300">
          Full users & access →
        </Link>
      </div>

      {notice ? (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      {usersQuery.isLoading ? (
        <p className="mt-4 text-xs text-slate-500">Loading users…</p>
      ) : usersQuery.isError ? (
        <p className="mt-4 text-xs text-red-400">{(usersQuery.error as Error).message}</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-800">
          {users.map((user) => (
            <UserAccessRow
              key={user.id}
              user={user}
              expanded={expandedId === user.id}
              busy={updateMutation.isPending}
              isSelf={user.id === claims?.sub}
              onToggleExpand={() => setExpandedId((id) => (id === user.id ? null : user.id))}
              onToggleActive={(active) => updateMutation.mutate({ userId: user.id, patch: { active } })}
              onToggleModule={(moduleId, enabled) => {
                const permissions = toggleModulePermission(user.permissions, moduleId, enabled);
                updateMutation.mutate({ userId: user.id, patch: { permissions } });
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function UserAccessRow({
  user,
  expanded,
  busy,
  isSelf,
  onToggleExpand,
  onToggleActive,
  onToggleModule,
}: {
  user: OrgUser;
  expanded: boolean;
  busy: boolean;
  isSelf: boolean;
  onToggleExpand: () => void;
  onToggleActive: (active: boolean) => void;
  onToggleModule: (moduleId: string, enabled: boolean) => void;
}): JSX.Element {
  const isAdminRole = user.role === "Admin" || user.permissions.includes("*");

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onToggleExpand}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate text-sm font-medium text-slate-100">{user.email}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{user.role}</span>
            <span>·</span>
            <span>{user.branchScope}</span>
            <Badge tone={user.active ? "success" : "neutral"}>{user.active ? "Active" : "Off"}</Badge>
          </div>
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <span>Account</span>
          <input
            type="checkbox"
            className="accent-amber-500"
            checked={user.active}
            disabled={busy || isSelf || isAdminRole}
            title={
              isSelf
                ? "You cannot deactivate your own account"
                : isAdminRole
                  ? "Admin / owner accounts stay active"
                  : undefined
            }
            onChange={(e) => onToggleActive(e.target.checked)}
          />
        </label>
        <button
          type="button"
          onClick={onToggleExpand}
          className="text-xs text-sky-400 hover:text-sky-300"
        >
          {expanded ? "Hide modules" : "Modules"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {POPS_MODULE_ACCESS.map((mod) => {
            const on = hasModuleAccess(user.permissions, mod.id);
            const lockAdminManage = isAdminRole && mod.id === "pops.users.manage";
            return (
              <label
                key={mod.id}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                  on
                    ? "border-amber-500/40 bg-amber-500/10 text-slate-100"
                    : "border-slate-800 bg-slate-950/50 text-slate-400"
                } ${busy || lockAdminManage ? "opacity-60" : ""}`}
                title={mod.description}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 accent-amber-500"
                  checked={on}
                  disabled={busy || lockAdminManage}
                  onChange={(e) => onToggleModule(mod.id, e.target.checked)}
                />
                <span>
                  <span className="block font-medium">{mod.label}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{mod.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}
