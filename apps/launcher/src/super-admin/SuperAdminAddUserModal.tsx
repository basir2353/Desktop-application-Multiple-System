import { SYSTEM_TYPE_LABELS, type Business, type CreatePlatformUser } from "@platform/contracts";
import { useState } from "react";
import { fieldInputClass, headingClass, mutedClass } from "../pops/lib/themeClasses";
import { saBtnPrimaryClass } from "./superAdminTheme";

const ROLES: CreatePlatformUser["role"][] = [
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "accountant",
  "hr",
  "rider",
];

type Props = {
  businesses: Business[];
  onClose: () => void;
  onCreate: (input: CreatePlatformUser) => void;
  pending?: boolean;
};

export function SuperAdminAddUserModal({
  businesses,
  onClose,
  onCreate,
  pending,
}: Props): JSX.Element {
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreatePlatformUser["role"]>("cashier");
  const [showPassword, setShowPassword] = useState(true);

  function submit(): void {
    if (!businessId || email.trim().length < 3 || password.length < 8) return;
    onCreate({
      businessId,
      name: name.trim() || undefined,
      email: email.trim(),
      password,
      role,
      branchScope: "All",
      pinRequired: false,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sa-add-user-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/15 dark:bg-[#111827]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="sa-add-user-title" className={`text-lg font-semibold ${headingClass}`}>
              Add user
            </h3>
            <p className={`mt-1 text-sm ${mutedClass}`}>
              New login for a business. Password is saved so Super Admin can view it later.
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

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className={`font-medium ${mutedClass}`}>Business</span>
            <select
              className={`${fieldInputClass} mt-1 w-full`}
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {SYSTEM_TYPE_LABELS[b.systemType]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className={`font-medium ${mutedClass}`}>Name</span>
            <input
              className={`${fieldInputClass} mt-1 w-full`}
              placeholder="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className={`font-medium ${mutedClass}`}>Login email</span>
            <input
              type="email"
              className={`${fieldInputClass} mt-1 w-full`}
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className={`font-medium ${mutedClass}`}>Password</span>
            <div className="mt-1 flex gap-2">
              <input
                type={showPassword ? "text" : "password"}
                className={`${fieldInputClass} w-full`}
                placeholder="Min 8 characters"
                value={password}
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="shrink-0 rounded-xl border border-slate-200 px-3 text-xs dark:border-white/15"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label className="block text-sm">
            <span className={`font-medium ${mutedClass}`}>Role</span>
            <select
              className={`${fieldInputClass} mt-1 w-full capitalize`}
              value={role}
              onChange={(e) => setRole(e.target.value as CreatePlatformUser["role"])}
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-white/15"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={saBtnPrimaryClass}
            disabled={!businessId || email.trim().length < 3 || password.length < 8 || pending}
            onClick={submit}
          >
            {pending ? "Creating…" : "Add user"}
          </button>
        </div>
      </div>
    </div>
  );
}
