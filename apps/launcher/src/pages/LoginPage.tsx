import { Button } from "@platform/ui";
import { AuthClient } from "@platform/auth-client";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { decodeAccessToken } from "../lib/jwt";
import { getApiBaseUrl } from "../lib/apiBase";
import { getBusinessSystem, getErpEntryPath } from "../lib/businessSystems";
import { useSystemStore } from "../stores/systemStore";
import { ThemeToggle } from "../components/ThemeToggle";
import { fieldInputClass, loginCardClass, mutedClass, subtleClass } from "../pops/lib/themeClasses";
import { useSessionStore } from "../stores/sessionStore";
import { usePopsStore } from "../stores/popsStore";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const setTokens = useSessionStore((s) => s.setTokens);
  const branch = usePopsStore((s) => s.branch);
  const systemId = useSystemStore((s) => s.systemId);
  const system = systemId ? getBusinessSystem(systemId) : null;
  const [email, setEmail] = useState("admin@platform.local");
  const [password, setPassword] = useState("changeme-please-01");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!systemId || !system) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.login(email, password);
      const claims = decodeAccessToken(tokens.accessToken);
      setTokens(tokens.accessToken, tokens.refreshToken, claims);
      navigate(getErpEntryPath(systemId!, Boolean(branch)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Change system
        </button>
        <ThemeToggle />
      </div>
      <div className={loginCardClass}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${system.accentClass}`}>
          {system.shortName}
        </p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{system.name}</h1>
        <p className={`mt-1 text-sm ${mutedClass}`}>{system.tagline}. Sign in to continue.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
