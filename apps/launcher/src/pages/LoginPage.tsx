import { Button } from "@platform/ui";
import { AuthClient } from "@platform/auth-client";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { decodeAccessToken } from "../lib/jwt";
import { getApiBaseUrl } from "../lib/apiBase";
import { getBusinessSystem, getErpEntryPath } from "../lib/businessSystems";
import { getLockedSystemId, isSingleSystemEdition } from "../lib/edition";
import {
  loginRolesForSystem,
  membershipMatchesLoginRole,
  parseLoginRoleParam,
  roleSelectPath,
} from "../lib/loginRoles";
import { useSystemStore } from "../stores/systemStore";
import { ThemeToggle } from "../components/ThemeToggle";
import { fieldInputClass, loginCardClass, mutedClass, subtleClass } from "../pops/lib/themeClasses";
import { useSessionStore } from "../stores/sessionStore";
import { usePopsStore } from "../stores/popsStore";
import { findUserIdByPin, isValidPin, loadBranchPinMap } from "../pops/lib/posPinAuth";
import { isPopsRole } from "../pops/lib/roleAccess";

type LoginMode = "password" | "pin";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const selectedRole = parseLoginRoleParam(params.get("role"));
  const setTokens = useSessionStore((s) => s.setTokens);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = usePopsStore((s) => s.branch);
  const setDisplayRole = usePopsStore((s) => s.setDisplayRole);
  const persistedSystemId = useSystemStore((s) => s.systemId);
  const systemId = persistedSystemId ?? getLockedSystemId();
  const system = systemId ? getBusinessSystem(systemId) : null;

  const roleMeta = useMemo(() => {
    if (!systemId || !selectedRole) return null;
    const { admin, staff } = loginRolesForSystem(systemId);
    if (admin.id === selectedRole) return { ...admin, kind: "admin" as const };
    const staffRole = staff.find((r) => r.id === selectedRole);
    return staffRole ? { ...staffRole, kind: "staff" as const } : null;
  }, [systemId, selectedRole]);

  const isAdminLogin = roleMeta?.kind === "admin";
  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [pinEmail, setPinEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!roleMeta) return;
    setEmail(roleMeta.demoEmail ?? "");
    setPinEmail(roleMeta.demoEmail ?? "");
    setPassword(roleMeta.kind === "admin" ? "changeme-please-01" : "changeme-please-01");
    setMode("password");
    setError(null);
  }, [roleMeta?.id, roleMeta?.kind, roleMeta?.demoEmail]);

  if (!systemId || !system) {
    return <Navigate to="/" replace />;
  }

  if (!selectedRole || !roleMeta) {
    return <Navigate to={systemId ? roleSelectPath(systemId) : "/"} replace />;
  }

  async function completeLogin(accessToken: string, refreshToken: string): Promise<void> {
    const claims = decodeAccessToken(accessToken);
    if (!membershipMatchesLoginRole(claims.role, selectedRole!)) {
      clearSession();
      const actual = claims.role ?? "unknown";
      throw new Error(
        `This account is role “${actual}”, but you chose “${roleMeta!.label}”. Go back and pick the matching role.`,
      );
    }
    setTokens(accessToken, refreshToken, claims);
    if (isPopsRole(claims.role) || claims.role === "owner") {
      setDisplayRole(selectedRole!);
    }
    navigate(getErpEntryPath(systemId!, false));
  }

  async function onSubmitPassword(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.login(email, password);
      await completeLogin(tokens.accessToken, tokens.refreshToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitPin(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!branch?.code) {
      setError("Select a branch before using PIN login (switch branch after first password login, or ask admin).");
      return;
    }
    if (!isValidPin(pin)) {
      setError("Enter a 4-digit PIN.");
      return;
    }
    const userId = findUserIdByPin(branch.code, pin);
    if (!userId) {
      setError("PIN not recognized for this branch.");
      return;
    }
    if (!pinEmail.trim()) {
      setError("Enter your staff email linked to this PIN.");
      return;
    }
    setLoading(true);
    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.login(pinEmail.trim(), password);
      await completeLogin(tokens.accessToken, tokens.refreshToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN login failed — verify email and password.");
    } finally {
      setLoading(false);
    }
  }

  const pinUsers = branch?.code ? Object.keys(loadBranchPinMap(branch.code)).length : 0;
  const accentRing = isAdminLogin
    ? "ring-1 ring-amber-500/40"
    : "ring-1 ring-sky-500/30";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(systemId ? roleSelectPath(systemId) : "/role")}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Change role
        </button>
        <div className="flex items-center gap-2">
          {!isSingleSystemEdition() ? (
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              System
            </button>
          ) : null}
          <ThemeToggle />
        </div>
      </div>

      <div className={`${loginCardClass} ${accentRing}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${system.accentClass}`}>
          {system.shortName}
        </p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {isAdminLogin ? "Admin login" : "Staff login"}
        </p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
          {roleMeta.label}
        </h1>
        <p className={`mt-1 text-sm ${mutedClass}`}>{roleMeta.description}</p>

        {!isAdminLogin ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                mode === "password"
                  ? "bg-sky-500 text-white"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
              onClick={() => setMode("password")}
            >
              Email &amp; password
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                mode === "pin"
                  ? "bg-sky-500 text-white"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
              onClick={() => setMode("pin")}
            >
              4-digit PIN
            </button>
          </div>
        ) : null}

        {isAdminLogin || mode === "password" ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmitPassword}>
            <label className={`block text-sm ${subtleClass}`}>
              Email
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="username"
              />
            </label>
            <label className={`block text-sm ${subtleClass}`}>
              Password
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Signing in…" : `Sign in as ${roleMeta.label}`}
            </Button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmitPin}>
            <p className={`text-xs ${mutedClass}`}>
              {pinUsers > 0
                ? `${pinUsers} staff PIN(s) configured for this branch. Enter PIN, email, and password.`
                : "Admin must configure staff PINs under Users & access first."}
            </p>
            <label className={`block text-sm ${subtleClass}`}>
              4-digit PIN
              <input
                className={`mt-1 w-full ${fieldInputClass} tracking-[0.5em]`}
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                value={pin}
                onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, 4))}
                autoComplete="one-time-code"
              />
            </label>
            <label className={`block text-sm ${subtleClass}`}>
              Staff email
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                value={pinEmail}
                onChange={(ev) => setPinEmail(ev.target.value)}
                autoComplete="username"
              />
            </label>
            <label className={`block text-sm ${subtleClass}`}>
              Password
              <input
                className={`mt-1 w-full ${fieldInputClass}`}
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                autoComplete="current-password"
              />
            </label>
            {error ? <div className="text-sm text-red-600 dark:text-red-400">{error}</div> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Signing in…" : `Sign in as ${roleMeta.label}`}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
