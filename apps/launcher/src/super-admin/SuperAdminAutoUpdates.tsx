import { useQuery } from "@tanstack/react-query";
import launcherPkg from "../../package.json";
import mobilePkg from "../../../waiter-mobile/package.json";
import { fetchAutoUpdateStatus } from "../lib/autoUpdateFeeds";
import { getLiveApiUrl, describeLiveServer } from "../lib/apiBase";
import {
  saBadgeActiveClass,
  saCardClass,
  saMutedClass,
  saSuccessPanelClass,
  saTableBodyClass,
  saTableHeadClass,
  saTableWrapClass,
} from "./superAdminTheme";

function readPackageVersions(): { desktop: string; mobile: string } {
  return {
    desktop: launcherPkg.version,
    mobile: mobilePkg.version,
  };
}

/** Super Admin — auto-update feed status + release commands. */
export function SuperAdminAutoUpdates(): JSX.Element {
  const live = describeLiveServer();
  const versions = readPackageVersions();

  const feeds = useQuery({
    queryKey: ["auto-update-feeds", versions.desktop, versions.mobile],
    queryFn: () =>
      fetchAutoUpdateStatus({
        desktopVersion: versions.desktop,
        mobileVersion: versions.mobile,
      }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const allLive = feeds.data?.every((f) => f.ok) ?? false;

  return (
    <div className={saCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Auto-update (EXE + APK)</p>
          <p className={`mt-1 text-sm ${saMutedClass}`}>
            Builds bake Active server{" "}
            <span className="font-mono text-[11px]">{getLiveApiUrl()}</span> — restaurant EXE checks
            restaurant feed; universal checks suite feed.
          </p>
        </div>
        {feeds.isLoading ? (
          <span className="text-xs text-slate-500">Checking feeds…</span>
        ) : allLive ? (
          <span className={saBadgeActiveClass}>All feeds live</span>
        ) : (
          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
            Publish needed
          </span>
        )}
      </div>

      <div className={`${saTableWrapClass} mt-4`}>
        <table className="min-w-full text-sm">
          <thead className={saTableHeadClass}>
            <tr>
              <th className="px-4 py-2 text-left">Channel</th>
              <th className="px-4 py-2 text-left">Repo version</th>
              <th className="px-4 py-2 text-left">Published</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className={saTableBodyClass}>
            {feeds.isLoading ? (
              <tr>
                <td colSpan={4} className={`px-4 py-4 ${saMutedClass}`}>
                  Loading GitHub update feeds…
                </td>
              </tr>
            ) : (
              (feeds.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2">{row.label}</td>
                  <td className="px-4 py-2 font-mono text-xs">v{row.localVersion}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {row.publishedVersion ? `v${row.publishedVersion}` : "—"}
                    {row.error ? (
                      <div className="text-[10px] text-rose-600 dark:text-rose-300">{row.error}</div>
                    ) : null}
                  </td>
                    <td className="px-4 py-2">
                      {row.ok ? (
                        <span className={saBadgeActiveClass}>Live</span>
                      ) : row.publishedVersion && row.publishedUrl ? (
                        <a
                          href={row.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-700 underline dark:text-teal-300"
                        >
                          Download v{row.publishedVersion}
                        </a>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-300">Pending publish</span>
                      )}
                    </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {allLive && !feeds.isLoading ? (
        <div className={`${saSuccessPanelClass} mt-4`}>
          Installed apps will auto-update to v{versions.desktop} desktop / v{versions.mobile} mobile on
          next check ({live.label} API active).
        </div>
      ) : !feeds.isLoading && feeds.data?.some((r) => r.id.startsWith("desktop-") && r.publishedVersion === versions.desktop) ? (
        <div className={`${saSuccessPanelClass} mt-4`}>
          Desktop v{versions.desktop} is live on GitHub — installed EXE will auto-update, or download from
          the link in the table. Mobile APK still building / pending.
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-white/10 dark:bg-white/5">
        <p className="font-semibold text-slate-700 dark:text-slate-200">Fast release (~15 min warm)</p>
        <ol className={`mt-2 list-decimal space-y-1 pl-4 ${saMutedClass}`}>
          <li>Super Admin → set Active OLD or NEW (sync agent + builds follow this)</li>
          <li>
            Run{" "}
            <code className="rounded bg-slate-900/10 px-1 py-0.5 font-mono dark:bg-black/30">
              local\start-sync-agent.bat
            </code>{" "}
            (keep open)
          </li>
          <li>
            Run{" "}
            <code className="rounded bg-slate-900/10 px-1 py-0.5 font-mono dark:bg-black/30">
              local\auto-release-all.bat publish
            </code>
          </li>
        </ol>
        <p className={`mt-2 ${saMutedClass}`}>
          Build only (no GitHub upload):{" "}
          <code className="font-mono">local\auto-release-all.bat</code>
        </p>
      </div>
    </div>
  );
}
