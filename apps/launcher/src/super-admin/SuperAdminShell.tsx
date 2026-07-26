import { Button } from "@platform/ui";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { useSessionStore } from "../stores/sessionStore";
import { headingClass, mutedClass } from "../pops/lib/themeClasses";

const NAV = [
  { to: "/super-admin", end: true, label: "Overview" },
  { to: "/super-admin/businesses", end: false, label: "Businesses" },
  { to: "/super-admin/users", end: false, label: "Users" },
  { to: "/super-admin/licences", end: false, label: "Licences" },
  { to: "/super-admin/settings", end: false, label: "Global settings" },
] as const;

export function SuperAdminShell(): JSX.Element {
  const navigate = useNavigate();
  const clear = useSessionStore((s) => s.clear);
  const claims = useSessionStore((s) => s.claims);

  function logout(): void {
    clear();
    navigate("/login?role=super_admin", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
              Platform control plane
            </p>
            <h1 className={`text-xl font-semibold ${headingClass}`}>Super Admin</h1>
            <p className={`text-sm ${mutedClass}`}>
              Manage every business system and client installation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button type="button" variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet context={{ email: claims?.sub }} />
      </main>
    </div>
  );
}
