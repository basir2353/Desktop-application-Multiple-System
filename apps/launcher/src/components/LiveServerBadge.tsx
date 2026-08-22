import { describeApiServer } from "../lib/apiBase";

type Props = {
  compact?: boolean;
  showUrl?: boolean;
};

/** Shows which API server the app uses. */
export function LiveServerBadge({ compact = false, showUrl = false }: Props): JSX.Element | null {
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

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 font-semibold text-teal-900 ring-1 ring-teal-600/30 dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-500/40 ${size}`}
        title={info.url}
      >
        Live API
      </span>
      {showUrl ? (
        <span className="max-w-[14rem] truncate text-[10px] text-slate-500 dark:text-slate-400" title={info.url}>
          {info.url}
        </span>
      ) : null}
    </div>
  );
}
