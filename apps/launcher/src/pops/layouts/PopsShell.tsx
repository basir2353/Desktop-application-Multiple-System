import { Button } from "@platform/ui";
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { ThemeToggle } from "../../components/ThemeToggle";
import { PopsAlertCenter } from "../components/PopsAlertCenter";
import { PopsMobileNav, PopsSidebarNav } from "./PopsNavMenu";

const SIDEBAR_STORAGE_KEY = "pops-sidebar-visible";

function CloseIcon(): JSX.Element {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function MenuIcon(): JSX.Element {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function readSidebarVisible(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function PopsShell(): JSX.Element {
  const navigate = useNavigate();
  const clearSession = useSessionStore((s) => s.clear);
  const clearBranch = usePopsStore((s) => s.clearBranch);
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarVisible);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarOpen));
    } catch {
      // ignore storage errors
    }
  }, [sidebarOpen]);

  function signOut(): void {
    clearSession();
    clearBranch();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {sidebarOpen ? (
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-600 bg-slate-700 text-slate-100 md:flex">
          <div className="shrink-0 border-b border-slate-600 bg-slate-800 px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-sm font-bold text-slate-950 shadow-md shadow-amber-500/30">
                  P
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400">
                    POPS
                  </div>
                  <div className="truncate text-sm font-bold text-white">Restaurant ERP</div>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                aria-label="Close sidebar"
                title="Close sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <PopsSidebarNav />
          </nav>
          <div className="shrink-0 border-t border-slate-600 bg-slate-800 px-4 py-3">
            <div className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] font-semibold text-slate-100">Offline-ready</span>
              </div>
              <p className="mt-1 text-[10px] font-medium leading-relaxed text-slate-300">
                SQLite · sync outbox
              </p>
            </div>
          </div>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/30 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {!sidebarOpen ? (
              <button
                type="button"
                className="hidden rounded-md border border-slate-300 bg-white p-2 text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white md:inline-flex"
                aria-label="Open sidebar"
                title="Open sidebar"
                onClick={() => setSidebarOpen(true)}
              >
                <MenuIcon />
              </button>
            ) : null}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{branch?.name ?? "—"}</div>
              <div className="text-xs text-slate-500">
                {branch?.city} · Role: <span className="text-slate-700 dark:text-slate-300">{displayRole}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle compact />
            <PopsAlertCenter />
            <Button variant="ghost" className="text-xs" onClick={() => navigate("/pops/branches")}>
              Switch branch
            </Button>
            <Button variant="ghost" className="text-xs" onClick={() => navigate("/")}>
              Platform shell
            </Button>
            <Button variant="ghost" className="text-xs" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>

        <div className="border-b border-slate-200 bg-slate-100 px-2 py-2 md:hidden dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex gap-1 overflow-x-auto pb-1">
            <PopsMobileNav />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
