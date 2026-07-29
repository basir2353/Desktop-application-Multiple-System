import { Button } from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchPlatformBusinesses, fetchPlatformSettings, fetchPlatformUsers } from "../lib/platformApi";
import { useSessionStore } from "../stores/sessionStore";
import { mutedClass } from "../pops/lib/themeClasses";
import { pageTitleForPath } from "./superAdminHelpers";

type NavItem = { to: string; end?: boolean; label: string };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operate",
    items: [
      { to: "/super-admin", end: true, label: "Overview" },
      { to: "/super-admin/businesses", label: "Businesses" },
      { to: "/super-admin/users", label: "Users" },
      { to: "/super-admin/security", label: "Security" },
    ],
  },
  {
    title: "Commerce",
    items: [
      { to: "/super-admin/licences", label: "Licences" },
      { to: "/super-admin/payments", label: "Payments" },
    ],
  },
  {
    title: "Compliance",
    items: [{ to: "/super-admin/tax", label: "Tax map" }],
  },
  {
    title: "System",
    items: [
      { to: "/super-admin/health", label: "Health" },
      { to: "/super-admin/broadcast", label: "Broadcast" },
      { to: "/super-admin/settings", label: "Settings" },
    ],
  },
];

export function SuperAdminShell(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const clear = useSessionStore((s) => s.clear);
  const claims = useSessionStore((s) => s.claims);
  const sessionEmail = useSessionStore((s) => s.email);
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const settings = useQuery({
    queryKey: ["platform", "settings"],
    queryFn: fetchPlatformSettings,
    staleTime: 60_000,
  });
  const businesses = useQuery({
    queryKey: ["platform", "businesses"],
    queryFn: fetchPlatformBusinesses,
    staleTime: 30_000,
  });
  const users = useQuery({
    queryKey: ["platform", "users"],
    queryFn: fetchPlatformUsers,
    staleTime: 60_000,
  });

  const supportEmail =
    typeof settings.data?.entries.support_email === "string"
      ? settings.data.entries.support_email.trim()
      : "";

  const userLabel = useMemo(() => {
    const me = (users.data ?? []).find((u) => u.id === claims?.sub);
    if (me?.name?.trim()) return me.name.trim();
    if (me?.email?.trim()) return me.email.trim();
    if (sessionEmail?.trim()) return sessionEmail.trim();
    return "Super Admin";
  }, [users.data, claims?.sub, sessionEmail]);

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return (businesses.data ?? [])
      .filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          (b.adminEmail ?? "").toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [businesses.data, search]);

  function logout(): void {
    clear();
    navigate("/login?role=super_admin", { replace: true });
  }

  const title = pageTitleForPath(location.pathname);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "block rounded-lg px-3 py-2 text-sm font-medium transition",
      isActive
        ? "bg-amber-500 text-slate-950 shadow-sm"
        : "text-slate-300 hover:bg-slate-800 hover:text-white",
    ].join(" ");

  const sidebar = (
    <>
      <div className="border-b border-slate-800 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400">
          Control plane
        </p>
        <h1 className="mt-1 text-lg font-semibold text-white">POPS Platform</h1>
        <p className={`mt-1 text-xs ${mutedClass}`}>Super Admin</p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-slate-800 px-4 py-4">
        {supportEmail ? <p className="truncate text-xs text-slate-500">{supportEmail}</p> : null}
        <p className="truncate text-sm font-medium text-slate-200" title={userLabel}>
          {userLabel}
        </p>
        <Button type="button" variant="ghost" onClick={logout}>
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 lg:flex">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col bg-slate-900 text-slate-100 shadow-xl">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium lg:hidden dark:border-slate-700"
              onClick={() => setMobileOpen(true)}
            >
              Menu
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold sm:text-lg">{title}</h2>
            </div>
            <div className="relative w-full sm:w-72">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Jump to business…"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950"
              />
              {searchHits.length > 0 ? (
                <ul className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {searchHits.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => {
                          setSearch("");
                          navigate(`/super-admin/businesses/${b.id}`);
                        }}
                      >
                        <span className="font-medium">{b.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {b.status}
                          {b.adminEmail ? ` · ${b.adminEmail}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden dark:border-slate-800">
            {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    isActive
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <Outlet context={{ email: sessionEmail ?? userLabel }} />
        </main>
      </div>
    </div>
  );
}
