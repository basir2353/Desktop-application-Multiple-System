import { SYSTEM_TYPE_LABELS, type Business, type PlatformUser } from "@platform/contracts";
import { Link } from "react-router-dom";
import { headingClass, mutedClass } from "../pops/lib/themeClasses";

type Props = {
  business: Business;
  users: PlatformUser[];
  onClose: () => void;
  onViewUser: (user: PlatformUser) => void;
};

/** Super Admin: business snapshot + users list (open each user for password / full detail). */
export function SuperAdminBusinessUsersViewModal({
  business,
  users,
  onClose,
  onViewUser,
}: Props): JSX.Element {
  const initials = business.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sa-biz-users-view-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-white/15 dark:bg-[#111827]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-700 text-xl font-bold text-white shadow"
            aria-hidden
          >
            {initials || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="sa-biz-users-view-title" className={`text-lg font-semibold ${headingClass}`}>
              {business.name}
            </h3>
            <p className={`mt-0.5 text-sm ${mutedClass}`}>
              {SYSTEM_TYPE_LABELS[business.systemType]} · {business.status} ·{" "}
              {business.userCount ?? users.length} users
            </p>
            <p className={`mt-1 break-all text-xs ${mutedClass}`}>
              Admin: {business.adminEmail ?? "—"}
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

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={`/super-admin/businesses/${business.id}`}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-white/15 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Open Manage
          </Link>
        </div>

        <h4 className={`mt-6 text-sm font-semibold ${headingClass}`}>Users</h4>
        <p className={`mt-1 text-xs ${mutedClass}`}>
          View opens name, email, role, and present password (when stored). Logo on receipts is set
          inside each POS (Content) — not stored on the platform user record.
        </p>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/15">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-white/15">
              <tr>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Password</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`px-3 py-6 text-center ${mutedClass}`}>
                    No users in this business.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{u.name ?? u.email}</p>
                      <p className={`text-xs ${mutedClass}`}>{u.email}</p>
                    </td>
                    <td className="px-3 py-2 capitalize">{u.role.replaceAll("_", " ")}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {u.lastSetPassword?.trim() ? "Saved · View" : "Not stored"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="rounded-xl border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-900 hover:bg-teal-100"
                        onClick={() => onViewUser(u)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
