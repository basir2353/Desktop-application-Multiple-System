import { describeApiServer } from "../lib/apiBase";
import { useSuperAdminEnvStore } from "../stores/superAdminEnvStore";

type Props = {
  compact?: boolean;
  showUrl?: boolean;
};

/** Shows which live Railway server the whole app uses (OLD or NEW). */
export function LiveServerBadge({ compact = false, showUrl = false }: Props): JSX.Element | null {
  const env = useSuperAdminEnvStore((s) => s.env);
  const info = describeApiServer();
  const size = compact ? "text-[10px]" : "text-xs";

  if (info.preset === "local") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 font-semibold text-violet-800 ring-1 ring-violet-600/25 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/30 ${size}`}
        title={info.url}
      >
        Local API
      </span>
    );
  }

  if (info.preset === "custom") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-400/30 dark:bg-slate-500/15 dark:text-slate-200 dark:ring-slate-500/30 ${size}`}
        title={info.url}
      >
        Custom API
      </span>
    );
  }

  const label = env === "new" ? "NEW" : "OLD";
  const active = env === "new";

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold ring-1 ${size} ${
          active
            ? "bg-teal-100 text-teal-900 ring-teal-600/30 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-500/40"
            : "bg-amber-100 text-amber-950 ring-amber-600/30 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/40"
        }`}
        title={`Active server: ${label} · ${info.url}`}
      >
        Server · {label} Active
      </span>
      {showUrl ? (
        <span className="max-w-[14rem] truncate text-[10px] text-slate-500 dark:text-slate-400" title={info.url}>
          {info.url}
        </span>
      ) : null}
    </div>
  );
}
