import { useThemeStore } from "../stores/themeStore";
import type { ThemeMode } from "../lib/theme";

type Props = {
  compact?: boolean;
};

const options: { id: ThemeMode; label: string; icon: string }[] = [
  { id: "light", label: "Light", icon: "☀" },
  { id: "dark", label: "Dark", icon: "☾" },
];

export function ThemeToggle({ compact = false }: Props): JSX.Element {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div
      className="inline-flex rounded-md border border-slate-300 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900/60"
      role="group"
      aria-label="Theme"
    >
      {options.map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            title={`${option.label} mode`}
            onClick={() => setMode(option.id)}
            className={[
              "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition",
              active
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200",
            ].join(" ")}
          >
            <span aria-hidden>{option.icon}</span>
            {compact ? null : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
