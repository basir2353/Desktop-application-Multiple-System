import { useEffect } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { useSystemReady } from "../hooks/useSystemReady";
import { getBusinessSystem, isBusinessSystemId } from "../lib/businessSystems";
import { clearDeviceInstall, getEffectiveSystemLock } from "../lib/deviceInstall";
import { loginPathForRole, loginRolesForSystem } from "../lib/loginRoles";
import { mutedClass, screenCenterClass } from "../pops/lib/themeClasses";
import { useSystemStore } from "../stores/systemStore";
import { useSessionStore } from "../stores/sessionStore";
import type { PopsRole } from "../stores/popsStore";

export function RoleSelectPage(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const systemReady = useSystemReady();
  const accessToken = useSessionStore((s) => s.accessToken);
  const windowUnlocked = useSessionStore((s) => s.windowUnlocked);
  const setSystem = useSystemStore((s) => s.setSystem);
  const persistedSystemId = useSystemStore((s) => s.systemId);
  const querySystem = params.get("system");
  const lockedId = getEffectiveSystemLock();
  const systemId =
    lockedId ??
    (querySystem && isBusinessSystemId(querySystem) ? querySystem : null) ??
    persistedSystemId;
  const system = systemId ? getBusinessSystem(systemId) : null;

  useEffect(() => {
    if (querySystem && isBusinessSystemId(querySystem) && querySystem !== persistedSystemId) {
      setSystem(querySystem);
    }
  }, [querySystem, persistedSystemId, setSystem]);

  // Only skip role/login when THIS window has signed in (not just hydrated tokens).
  if (accessToken && windowUnlocked) {
    return <Navigate to="/pops" replace />;
  }

  if (!systemReady && !systemId) {
    return <div className={screenCenterClass}>Loading…</div>;
  }

  if (!systemId || !system) {
    return <Navigate to="/" replace />;
  }

  const { admin, staff } = loginRolesForSystem(systemId);

  function choose(role: PopsRole): void {
    navigate(loginPathForRole(role));
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              clearDeviceInstall();
              useSystemStore.getState().clearSystem();
              useSessionStore.getState().clear();
              window.location.assign("/?reset-install=1");
            }}
            className="text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            ← Change system
          </button>
          <ThemeToggle />
        </div>

        <header className="text-center">
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${system.accentClass}`}>
            {system.shortName}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold text-slate-900 dark:text-white">Choose how you sign in</h1>
          <p className={`mt-1.5 text-sm ${mutedClass}`}>
            Select your role, then sign in. Each login opens only that role&apos;s modules.
          </p>
        </header>

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Administration</h2>
          <button
            type="button"
            onClick={() => choose(admin.id)}
            className="mt-2 flex w-full items-start gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-slate-900/5 p-4 text-left transition hover:border-amber-400/70 dark:from-amber-500/20 dark:to-slate-900/40"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-lg font-bold text-slate-950">
              A
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold text-slate-900 dark:text-white">{admin.label}</span>
              <span className={`mt-0.5 block text-sm ${mutedClass}`}>{admin.description}</span>
              <span className="mt-2 inline-flex text-xs font-medium text-amber-700 dark:text-amber-300">
                Continue to {admin.label} login →
              </span>
            </span>
          </button>
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Staff &amp; operations</h2>
          <div className="mt-2 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => choose(role.id)}
                className="rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-slate-700"
              >
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{role.label}</span>
                <span className={`mt-1 block text-xs leading-snug ${mutedClass}`}>{role.description}</span>
                <span className="mt-2.5 inline-flex text-xs font-medium text-sky-700 dark:text-sky-300">
                  Continue to {role.label} login →
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
