import { Button } from "@platform/ui";
import { SYSTEM_TYPE_LABELS, type PlatformUser } from "@platform/contracts";
import { useState } from "react";
import { Link } from "react-router-dom";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";

function initials(name: string | null | undefined, email: string): string {
  const base = (name?.trim() || email.split("@")[0] || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

type Props = {
  user: PlatformUser;
  onClose: () => void;
  onResetPassword?: (userId: string, password: string) => void;
  resetPending?: boolean;
};

/** Super Admin: full login-user detail (name, email, role, last-set password). */
export function SuperAdminUserViewModal({
  user,
  onClose,
  onResetPassword,
  resetPending,
}: Props): JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const password = user.lastSetPassword?.trim() || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sa-user-view-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/15 dark:bg-[#111827]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-700 text-xl font-bold text-white shadow"
            aria-hidden
          >
            {initials(user.name, user.email)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="sa-user-view-title" className={`text-lg font-semibold ${headingClass}`}>
              {user.name?.trim() || "Unnamed user"}
            </h3>
            <p className={`mt-0.5 break-all text-sm ${mutedClass}`}>{user.email}</p>
            <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {user.status}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Name">{user.name?.trim() || "—"}</Row>
          <Row label="Login email">
            <span className="break-all">{user.email}</span>
          </Row>
          <Row label="Role">
            <span className="capitalize">{user.role.replaceAll("_", " ")}</span>
            {user.platformRole === "super_admin" ? " · Platform" : null}
          </Row>
          <Row label="Business">
            {user.platformRole === "super_admin" ? (
              "Platform (Super Admin)"
            ) : user.businessId ? (
              <Link
                to={`/super-admin/businesses/${user.businessId}`}
                className="text-teal-700 hover:underline dark:text-teal-300"
                onClick={onClose}
              >
                {user.businessName ?? "—"}
                {user.systemType ? ` · ${SYSTEM_TYPE_LABELS[user.systemType]}` : ""}
              </Link>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Created">
            {user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"}
          </Row>
          <Row label="Present password">
            {password ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-slate-100 px-2 py-1 font-mono text-xs dark:bg-slate-800">
                  {showPassword ? password : "••••••••••••"}
                </code>
                <button
                  type="button"
                  className="text-xs text-teal-700 hover:underline dark:text-teal-300"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:underline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(password);
                  }}
                >
                  Copy
                </button>
              </div>
            ) : (
              <span className={mutedClass}>
                Not stored yet (older account or self-changed). Reset below to save a password you can
                view later.
              </span>
            )}
          </Row>
        </dl>

        {onResetPassword && user.platformRole !== "super_admin" ? (
          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/15">
            {resetOpen ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className={`${fieldInputClass} !w-48`}
                  placeholder="New password (min 8)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  disabled={newPassword.length < 8 || resetPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Reset password for ${user.email}? Active sessions will be revoked.`,
                      )
                    ) {
                      onResetPassword(user.id, newPassword);
                      setResetOpen(false);
                      setNewPassword("");
                      setShowPassword(true);
                    }
                  }}
                >
                  Save password
                </Button>
                <button
                  type="button"
                  className="text-xs text-slate-500"
                  onClick={() => {
                    setResetOpen(false);
                    setNewPassword("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-white/15 dark:hover:bg-slate-800"
                onClick={() => setResetOpen(true)}
              >
                Reset / set password
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 sm:grid-cols-[9.5rem_1fr]">
      <dt className={`font-medium ${mutedClass}`}>{label}</dt>
      <dd className="min-w-0 text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}
