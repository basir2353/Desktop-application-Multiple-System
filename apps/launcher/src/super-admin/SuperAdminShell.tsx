import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { fetchPlatformBusinesses, fetchPlatformSettings, fetchPlatformUsers } from "../lib/platformApi";
import { useSessionStore } from "../stores/sessionStore";
import { ThemeToggle } from "../components/ThemeToggle";
import { pageTitleForPath } from "./superAdminHelpers";
import { SuperAdminEnvSwitch } from "./SuperAdminEnvSwitch";
import { useSuperAdminEnvStore } from "../stores/superAdminEnvStore";
import { activateSyncEnv } from "../lib/syncAgent";
import {
  saBtnGhostClass,
  saHeaderClass,
  saInputClass,
  saMainClass,
  saMobileNavActiveClass,
  saMobileNavIdleClass,
  saNavActiveClass,
  saNavIdleClass,
  saPageTitleClass,
  saRootClass,
  saSidebarClass,
} from "./superAdminTheme";
import "./superAdmin.css";

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
    items: [{ to: "/super-admin/tax", label: "FBR / FPRA · Real PRA" }],
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

  const env = useSuperAdminEnvStore((s) => s.env);

  useEffect(() => {
    void activateSyncEnv(env);
  }, [env]);

  const settings = useQuery({
    queryKey: ["platform", "settings", env],
    queryFn: fetchPlatformSettings,
    staleTime: 60_000,
  });
  const businesses = useQuery({
    queryKey: ["platform", "businesses", env],
    queryFn: fetchPlatformBusinesses,
    staleTime: 30_000,
  });
  const users = useQuery({
    queryKey: ["platform", "users", env],
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
    isActive ? saNavActiveClass : saNavIdleClass;

  const sidebar = (
    <>
      <div className="border-b border-slate-200 px-5 py-5 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-700 text-sm font-bold text-white shadow-md shadow-teal-900/20">
            P
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-400/90">
              Control plane
            </p>
            <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              POPS Platform
            </h1>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
      <div className="space-y-3 border-t border-slate-200 px-4 py-4 dark:border-white/5">
        {supportEmail ? (
          <p className="truncate text-xs text-slate-500 dark:text-slate-500">{supportEmail}</p>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 text-xs font-bold text-teal-800 dark:text-teal-300">
            {userLabel.slice(0, 1).toUpperCase()}
          </div>
          <p
            className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200"
            title={userLabel}
          >
            {userLabel}
          </p>
        </div>
        <button type="button" className={`${saBtnGhostClass} w-full`} onClick={logout}>
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className={`${saRootClass} flex`}>
      <aside className={`hidden lg:flex ${saSidebarClass}`}>{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className={`relative z-10 flex h-full ${saSidebarClass} shadow-2xl`}>{sidebar}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={saHeaderClass}>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-6">
            <button
              type="button"
              className={`${saBtnGhostClass} lg:hidden`}
              onClick={() => setMobileOpen(true)}
            >
              Menu
            </button>
            <div className="min-w-0 flex-1">
              <h2 className={`truncate ${saPageTitleClass}`}>{title}</h2>
            </div>
            <ThemeToggle />
            <SuperAdminEnvSwitch />
            <div className="relative w-full sm:w-80">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Jump to business…"
                className={saInputClass}
              />
              {searchHits.length > 0 ? (
                <ul className="absolute left-0 right-0 z-30 mt-1.5 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#111827]">
                  {searchHits.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                        onClick={() => {
                          setSearch("");
                          navigate(`/super-admin/businesses/${b.id}`);
                        }}
                      >
                        <span className="font-medium text-slate-900 dark:text-slate-100">{b.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
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
          <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 lg:hidden dark:border-white/10">
            {NAV_GROUPS.flatMap((g) => g.items).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? saMobileNavActiveClass : saMobileNavIdleClass
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className={saMainClass}>
          <Outlet context={{ email: sessionEmail ?? userLabel }} />
        </main>
      </div>
    </div>
  );
}
