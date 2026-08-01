import { Navigate, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import {
  businessSystemIdFromSystemType,
  getErpEntryPath,
  type BusinessSystem,
  type BusinessSystemId,
} from "../lib/businessSystems";
import { getAvailableSystems, isSingleSystemEdition } from "../lib/edition";
import {
  clearDeviceInstall,
  getEffectiveSystemLock,
  getInstalledSystemId,
} from "../lib/deviceInstall";
import { mutedClass } from "../pops/lib/themeClasses";
import { erpEntryPathForRole } from "../pops/lib/roleAccess";
import { roleSelectPath } from "../lib/loginRoles";
import { isSuperAdminClaims } from "../lib/jwt";
import { useSessionStore } from "../stores/sessionStore";
import { usePopsStore } from "../stores/popsStore";
import { useSystemStore } from "../stores/systemStore";

function SystemIcon({ system }: { system: BusinessSystem }): JSX.Element {
  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${system.gradientClass} text-lg font-bold text-white shadow-lg`}
    >
      {system.iconLetter}
    </div>
  );
}

function SystemCard({
  system,
  onSelect,
}: {
  system: BusinessSystem;
  onSelect: (id: BusinessSystemId) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onSelect(system.id)}
      className="group flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-900"
    >
      <div className="flex items-start gap-4">
        <SystemIcon system={system} />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${system.accentClass}`}>
            {system.shortName}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{system.name}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{system.tagline}</p>
        </div>
      </div>
      <p className={`mt-4 text-sm leading-relaxed ${mutedClass}`}>{system.description}</p>
      <span className="mt-5 inline-flex items-center text-sm font-medium text-amber-700 transition group-hover:text-amber-800 dark:text-amber-400 dark:group-hover:text-amber-300">
        Open {system.shortName}
        <svg className="ml-1.5 h-4 w-4 transition group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    </button>
  );
}

export function SystemSelectPage(): JSX.Element {
  const [params] = useSearchParams();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const setSystem = useSystemStore((s) => s.setSystem);

  // Support/re-provisioning hatch: `/?reset-install=1` unbinds this machine.
  if (params.get("reset-install") === "1" && getInstalledSystemId()) {
    clearDeviceInstall();
  }

  const lockedSystemId = getEffectiveSystemLock();
  const availableSystems = getAvailableSystems();

  function entryPath(id: BusinessSystemId): string {
    if (!branch) return getErpEntryPath(id, false);
    return erpEntryPathForRole(id, displayRole);
  }

  // Authenticated Super Admin always lands on the control plane (suite only).
  if (accessToken && isSuperAdminClaims(claims)) {
    if (isSingleSystemEdition()) {
      return <Navigate to={roleSelectPath(lockedSystemId ?? "restaurant")} replace />;
    }
    return <Navigate to="/super-admin" replace />;
  }

  // System admins are permanently locked to their assigned system — no picker.
  const assignedSystemId = businessSystemIdFromSystemType(claims?.systemType);
  if (accessToken && assignedSystemId) {
    return <Navigate to={entryPath(assignedSystemId)} replace />;
  }

  // Single-system installers, and any machine that already has a system
  // installed, skip the picker entirely and boot into that system.
  if (lockedSystemId) {
    return (
      <Navigate
        to={accessToken ? entryPath(lockedSystemId) : roleSelectPath(lockedSystemId)}
        replace
      />
    );
  }

  function onSelect(id: BusinessSystemId): void {
    setSystem(id);
    const next = accessToken ? entryPath(id) : roleSelectPath(id);
    window.location.assign(next);
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            Platform launcher
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Choose your business system
          </h1>
          <p className={`mt-2 max-w-xl text-sm ${mutedClass}`}>
            Sign in to the system you administer. System admins cannot switch modules after login.
          </p>
        </div>
        <ThemeToggle compact />
      </header>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {availableSystems.map((system) => (
          <SystemCard key={system.id} system={system} onSelect={onSelect} />
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-slate-500 dark:text-slate-500">
        Offline-first · multi-tenant RBAC · strict system isolation
      </p>
    </div>
  );
}
