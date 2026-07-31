import { Button } from "@platform/ui";
import { canManageOrgUsers } from "@platform/contracts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { useActiveSystemId } from "../../hooks/useActiveSystemId";
import { getBusinessSystem } from "../../lib/businessSystems";
import { PHARMACY_ROLE_LABELS } from "../../pharmacy/spec/nav";
import { STORE_ROLE_LABELS } from "../../store/spec/nav";
import { fetchPopsBranches } from "../api/operations";
import { isMonitoringBranch } from "../lib/branchScope";
import {
  erpEntryPathForRole,
  filterBranchesByScope,
} from "../lib/roleAccess";
import { canEnterErpWithoutBranch } from "../components/BranchGate";
import { normalizeMembershipRole } from "../../lib/loginRoles";
import { usePopsStore, type PopsBranch, type PopsRole } from "../../stores/popsStore";

const restaurantRoles: { id: PopsRole; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "manager", label: "Manager" },
  { id: "cashier", label: "Cashier" },
  { id: "waiter", label: "Waiter" },
  { id: "kitchen", label: "Pending orders" },
  { id: "accountant", label: "Accountant" },
  { id: "hr", label: "HR" },
  { id: "rider", label: "Rider" },
];

const pharmacyRoles: { id: PopsRole; label: string }[] = [
  { id: "admin", label: PHARMACY_ROLE_LABELS.admin! },
  { id: "manager", label: PHARMACY_ROLE_LABELS.manager! },
  { id: "cashier", label: PHARMACY_ROLE_LABELS.cashier! },
  { id: "accountant", label: PHARMACY_ROLE_LABELS.pharmacist! },
  { id: "hr", label: PHARMACY_ROLE_LABELS.inventory_manager! },
];

const storeRoles: { id: PopsRole; label: string }[] = [
  { id: "admin", label: STORE_ROLE_LABELS.super_admin! },
  { id: "manager", label: STORE_ROLE_LABELS.inventory_manager! },
  { id: "cashier", label: STORE_ROLE_LABELS.staff! },
  { id: "accountant", label: STORE_ROLE_LABELS.accountant! },
  { id: "hr", label: STORE_ROLE_LABELS.warehouse_manager! },
];

function toPopsBranch(row: { id: string; code: string; name: string; city: string }): PopsBranch {
  return { id: row.id, code: row.code, name: row.name, city: row.city };
}

/** First-time setup: admins land in Multi-branch to create the first location. */
const NO_BRANCH_SETUP_PATH = "/pops/multi-branch";

export function BranchSelectPage(): JSX.Element {
  const navigate = useNavigate();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const persistedBranch = usePopsStore((s) => s.branch);
  const setBranch = usePopsStore((s) => s.setBranch);
  const setDisplayRole = usePopsStore((s) => s.setDisplayRole);
  const setPinSession = usePopsStore((s) => s.setPinSession);
  const displayRole = usePopsStore((s) => s.displayRole);
  const pinSession = usePopsStore((s) => s.pinSession);
  const systemId = useActiveSystemId();
  const system = getBusinessSystem(systemId);
  const roles = systemId === "pharmacy" ? pharmacyRoles : systemId === "general-store" ? storeRoles : restaurantRoles;
  const permissions = claims?.permissions ?? [];
  const canManageUsers = canManageOrgUsers(permissions);
  const canSetupWithoutBranch = canEnterErpWithoutBranch(permissions);
  const assignedRole = normalizeMembershipRole(claims?.role) ?? displayRole;

  const branchesQuery = useQuery({
    queryKey: ["operations", "branches", accessToken],
    enabled: Boolean(accessToken),
    queryFn: () => fetchPopsBranches(),
  });

  const apiBranches = useMemo(
    () => filterBranchesByScope((branchesQuery.data ?? []).map(toPopsBranch), claims?.branchScope),
    [branchesQuery.data, claims?.branchScope],
  );

  const allBranches = apiBranches;
  const noBranchesYet = branchesQuery.isSuccess && apiBranches.length === 0;

  const [selected, setSelected] = useState<PopsBranch | null>(
    allBranches.find((b) => !isMonitoringBranch(b.code)) ?? allBranches[0] ?? null,
  );

  useEffect(() => {
    if (persistedBranch?.id.startsWith("custom-")) {
      setBranch(null);
      return;
    }
    if (
      persistedBranch &&
      branchesQuery.isSuccess &&
      !apiBranches.some((b) => b.code === persistedBranch.code)
    ) {
      setBranch(null);
    }
  }, [persistedBranch, setBranch, branchesQuery.isSuccess, apiBranches]);

  useEffect(() => {
    const role = normalizeMembershipRole(claims?.role);
    if (role) setDisplayRole(role);
  }, [claims?.role, setDisplayRole]);

  useEffect(() => {
    if (selected && !allBranches.some((b) => b.id === selected.id)) {
      setSelected(allBranches.find((b) => !isMonitoringBranch(b.code)) ?? allBranches[0] ?? null);
    }
  }, [allBranches, selected]);

  // Single-branch accounts (e.g. cashier locked to one store): auto-enter ERP.
  useEffect(() => {
    if (!branchesQuery.isSuccess || allBranches.length !== 1) return;
    const only = allBranches[0];
    if (!only || isMonitoringBranch(only.code)) return;
    if (persistedBranch?.code === only.code) {
      navigate(erpEntryPathForRole(systemId, assignedRole), { replace: true });
      return;
    }
    setBranch(only);
    setDisplayRole(assignedRole);
    navigate(erpEntryPathForRole(systemId, assignedRole), { replace: true });
  }, [
    branchesQuery.isSuccess,
    allBranches,
    persistedBranch?.code,
    assignedRole,
    systemId,
    setBranch,
    setDisplayRole,
    navigate,
  ]);

  // No branches yet: admins enter the main system to create/manage the first branch.
  useEffect(() => {
    if (!noBranchesYet || !canSetupWithoutBranch) return;
    setDisplayRole(assignedRole);
    navigate(NO_BRANCH_SETUP_PATH, { replace: true });
  }, [noBranchesYet, canSetupWithoutBranch, assignedRole, setDisplayRole, navigate]);

  function continueToDashboard(): void {
    if (noBranchesYet && canSetupWithoutBranch) {
      setDisplayRole(assignedRole);
      navigate(NO_BRANCH_SETUP_PATH);
      return;
    }
    if (!selected) return;
    setBranch(selected);
    navigate(erpEntryPathForRole(systemId, assignedRole));
  }

  if (noBranchesYet && canSetupWithoutBranch) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-lg text-center">
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${system.accentClass}`}>
            {system.shortName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Setting up your system</h1>
          <p className="mt-2 text-sm text-slate-400">
            No branches yet — opening the control panel so you can create the first branch and manage the business.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${system.accentClass}`}>
            {system.shortName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{system.name}</h1>
          <p className="mt-2 text-sm text-slate-400">Choose a branch to load permissions, pricing, and inventory scope.</p>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Branch</h2>
              {branchesQuery.isLoading ? (
                <p className="mt-3 text-xs text-slate-500">Loading branches from control plane…</p>
              ) : null}
              {branchesQuery.isError ? (
                <p className="mt-3 text-xs text-red-400/90">
                  Could not load branches from the control plane. {(branchesQuery.error as Error).message}
                </p>
              ) : null}
              {!branchesQuery.isLoading && !branchesQuery.isError && apiBranches.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No branches in your organization yet. An admin must create the first branch from Multi-branch.
                </p>
              ) : null}
              <div className="mt-4 space-y-2">
                {allBranches.map((b) => (
                  <label
                    key={b.id}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-3 text-sm transition ${
                      selected?.id === b.id
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium text-slate-100">{b.name}</span>
                      <span className="text-xs text-slate-500">
                        {b.city} · {b.code}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <input
                        type="radio"
                        name="branch"
                        className="accent-amber-500"
                        checked={selected?.id === b.id}
                        onChange={() => setSelected(b)}
                      />
                    </span>
                  </label>
                ))}
              </div>
              {claims?.branchScope && claims.branchScope.toLowerCase() !== "all" ? (
                <p className="mt-3 text-[11px] text-amber-200/90">
                  Your account is limited to branch <span className="font-semibold">{claims.branchScope}</span>.
                </p>
              ) : claims?.branchScope?.toLowerCase() === "all" ? (
                <p className="mt-3 text-[11px] text-slate-500">
                  Your account can access all branches — pick one to continue.
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="text-sm font-semibold text-slate-200">Signed-in role</h2>
              <p className="mt-1 text-xs text-slate-500">
                You signed in as this role. Menus and actions follow its permissions
                {canManageUsers ? ". Manage other users in Users & access." : ". Only an admin can change your role."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {roles.map((r) => {
                  const active = assignedRole === r.id || displayRole === r.id;
                  return (
                    <span
                      key={r.id}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        active
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-900 text-slate-600"
                      }`}
                    >
                      {r.label}
                    </span>
                  );
                })}
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="accent-amber-500"
                  checked={pinSession}
                  onChange={(e) => setPinSession(e.target.checked)}
                />
                PIN-based session (shorter re-auth prompts)
              </label>
              {canManageUsers ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-4 w-full"
                  onClick={() => {
                    if (selected) setBranch(selected);
                    navigate("/pops/auth");
                  }}
                >
                  Manage users & access
                </Button>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
              After you continue, your role and branch scope drive which menus and actions appear in the ERP shell.
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            type="button"
            className="min-w-[12rem]"
            disabled={!selected && !(noBranchesYet && canSetupWithoutBranch)}
            onClick={continueToDashboard}
          >
            {noBranchesYet && canSetupWithoutBranch ? "Open system setup" : "Open dashboard"}
          </Button>
          <button
            type="button"
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={() => navigate("/platform")}
          >
            Platform shell
          </button>
        </div>
      </div>
    </div>
  );
}
