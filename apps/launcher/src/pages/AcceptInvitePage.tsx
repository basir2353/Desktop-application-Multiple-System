import { Button } from "@platform/ui";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { acceptInvite, fetchInvitePreview } from "../pops/api/users";
import type { InvitePreview } from "@platform/contracts";

export function AcceptInvitePage(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("Missing invitation token.");
      return;
    }
    void fetchInvitePreview(token)
      .then(setPreview)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Invalid invite"));
  }, [token]);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitError(null);
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setSubmitError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await acceptInvite(token, password);
      navigate("/role", { replace: true, state: { message: "Account created. Sign in with your new password." } });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not activate account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">POPS</p>
        <h1 className="mt-1 text-lg font-semibold text-white">Accept invitation</h1>

        {loadError ? (
          <p className="mt-4 text-sm text-red-400">{loadError}</p>
        ) : preview ? (
          <>
            <p className="mt-2 text-sm text-slate-400">
              Join <span className="text-slate-200">{preview.organizationName}</span> as{" "}
              <span className="text-slate-200">{preview.role}</span>
              {preview.branchScope !== "All" ? (
                <>
                  {" "}
                  · branch <span className="text-slate-200">{preview.branchScope}</span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-slate-500">Account: {preview.email}</p>
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              <label className="block text-sm text-slate-300">
                Password
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              <label className="block text-sm text-slate-300">
                Confirm password
                <input
                  type="password"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </label>
              {submitError ? <p className="text-sm text-red-400">{submitError}</p> : null}
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Activating…" : "Activate account"}
              </Button>
            </form>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Loading invitation…</p>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link to="/role" className="text-amber-400/90 hover:text-amber-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
