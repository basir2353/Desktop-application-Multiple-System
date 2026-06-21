import { Button } from "@platform/ui";
import { AuthClient } from "@platform/auth-client";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { decodeAccessToken } from "../lib/jwt";
import { getApiBaseUrl } from "../lib/apiBase";
import { ThemeToggle } from "../components/ThemeToggle";
import { fieldInputClass, loginCardClass, mutedClass, subtleClass } from "../pops/lib/themeClasses";
import { useSessionStore } from "../stores/sessionStore";

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const setTokens = useSessionStore((s) => s.setTokens);
  const [email, setEmail] = useState("admin@platform.local");
  const [password, setPassword] = useState("changeme-please-01");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.login(email, password);
      const claims = decodeAccessToken(tokens.accessToken);
      setTokens(tokens.accessToken, tokens.refreshToken, claims);
      navigate("/pops", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <div className="mb-4 flex justify-end">
        <ThemeToggle />
      </div>
      <div className={loginCardClass}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400/90">POPS</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Restaurant ERP</h1>
        <p className={`mt-1 text-sm ${mutedClass}`}>Sign in for branch selection, POS, inventory, and compliance workflows.</p>
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
