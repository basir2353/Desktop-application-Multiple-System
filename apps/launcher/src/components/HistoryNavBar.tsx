import { useLocation, useNavigate } from "react-router-dom";
import { useNavigationHistory } from "../hooks/useNavigationHistory";
import { useSessionStore } from "../stores/sessionStore";
import { ThemeToggle } from "./ThemeToggle";

const navBtnClass =
  "inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1.5 text-xs font-medium transition enabled:text-slate-700 enabled:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:enabled:text-slate-200 dark:enabled:hover:bg-slate-800";

export function HistoryNavBar(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { canGoBack, canGoForward, goBack, goForward } = useNavigationHistory();

  const isSuperAdminLogin =
    location.pathname === "/login" &&
    new URLSearchParams(location.search).get("role") === "super_admin";
  const isSuperAdminArea = location.pathname.startsWith("/super-admin");

  const showSuperAdminLogin = !accessToken && !isSuperAdminLogin && !isSuperAdminArea;

  return (
    <header className="sticky top-0 z-[100] flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800/90 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/80">
      <button type="button" className={navBtnClass} onClick={goBack} disabled={!canGoBack} aria-label="Go back">
        ← Back
      </button>
      <button
        type="button"
        className={navBtnClass}
        onClick={goForward}
        disabled={!canGoForward}
        aria-label="Go forward"
      >
        Forward →
      </button>
      <div className="ml-auto flex items-center gap-2">
        {showSuperAdminLogin ? (
          <button
            type="button"
            className={`${navBtnClass} font-semibold text-amber-700 dark:text-amber-400`}
            onClick={() => navigate("/login?role=super_admin")}
          >
            Super Admin Login
          </button>
        ) : null}
        <ThemeToggle compact />
        <span className="hidden max-w-[50%] truncate text-xs text-slate-500 sm:inline" title={location.pathname}>
          {location.pathname}
        </span>
      </div>
    </header>
  );
}
