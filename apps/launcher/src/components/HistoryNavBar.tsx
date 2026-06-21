import { Button } from "@platform/ui";
import { useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";

export function HistoryNavBar(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800/90 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/80">
      <Button type="button" variant="ghost" className="shrink-0 px-2 py-1.5 text-xs" onClick={() => navigate(-1)} aria-label="Go back">
        ← Back
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="shrink-0 px-2 py-1.5 text-xs"
        onClick={() => navigate(1)}
        aria-label="Go forward"
      >
        Forward →
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle compact />
        <span className="hidden max-w-[50%] truncate text-xs text-slate-500 sm:inline" title={location.pathname}>
          {location.pathname}
        </span>
      </div>
    </header>
  );
}
