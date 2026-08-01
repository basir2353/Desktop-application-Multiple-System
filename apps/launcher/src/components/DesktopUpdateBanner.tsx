import { useEffect, useState } from "react";

type BannerState =
  | { kind: "hidden" }
  | { kind: "available"; version: string; notes: string }
  | { kind: "downloading"; version: string; percent: number | null }
  | { kind: "error"; message: string };

function isTauriShell(): boolean {
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    isTauri?: boolean;
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri);
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err || "Update failed.");
}

/**
 * Top banner: checks GitHub Releases feed on launch and installs signed updates.
 * No-op in browser / Vite web preview.
 */
export function DesktopUpdateBanner(): JSX.Element | null {
  const [state, setState] = useState<BannerState>({ kind: "hidden" });
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriShell()) return;

    let cancelled = false;

    async function runCheck(): Promise<void> {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (cancelled) return;
        if (!update) {
          // Already latest — keep quiet unless we were showing an error.
          setState((prev) => (prev.kind === "error" ? { kind: "hidden" } : prev.kind === "available" || prev.kind === "downloading" ? prev : { kind: "hidden" }));
          return;
        }
        setState({
          kind: "available",
          version: update.version,
          notes: (update.body ?? "").trim(),
        });
      } catch (err) {
        if (cancelled) return;
        const message = errMessage(err);
        // Surface real failures (404 / network) so users aren't stuck silent.
        if (/404|Not Found|failed|network|timed out|download/i.test(message)) {
          setState({ kind: "error", message });
        } else {
          console.debug("[updater] check skipped", err);
        }
      }
    }

    void runCheck();
    const timer = window.setInterval(() => void runCheck(), 30 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function installUpdate(): Promise<void> {
    if (state.kind !== "available" && state.kind !== "error") return;
    const versionHint =
      state.kind === "available" ? state.version : dismissedVersion ?? "update";
    setState({ kind: "downloading", version: versionHint, percent: null });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();
      if (!update) {
        setState({ kind: "error", message: "Update no longer available. Try again later." });
        return;
      }
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          downloaded = 0;
          setState({ kind: "downloading", version: update.version, percent: total ? 0 : null });
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const percent = total > 0 ? Math.min(99, Math.round((downloaded / total) * 100)) : null;
          setState({ kind: "downloading", version: update.version, percent });
        } else if (event.event === "Finished") {
          setState({ kind: "downloading", version: update.version, percent: 100 });
        }
      });
      await relaunch();
    } catch (err) {
      setState({ kind: "error", message: errMessage(err) });
    }
  }

  if (state.kind === "hidden") return null;
  if (state.kind === "available" && dismissedVersion === state.version) return null;

  if (state.kind === "downloading") {
    const label =
      state.percent == null
        ? `Downloading update v${state.version}…`
        : `Downloading update v${state.version}… ${state.percent}%`;
    return (
      <div
        role="status"
        className="border-b border-sky-500/40 bg-sky-500/15 px-4 py-2 text-center text-xs font-medium text-sky-950 dark:text-sky-50"
      >
        {label} App will restart when finished.
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-center gap-3 border-b border-rose-500/40 bg-rose-500/15 px-4 py-2 text-center text-xs font-medium text-rose-950 dark:text-rose-50"
      >
        <span>Update failed: {state.message}</span>
        <button
          type="button"
          className="rounded bg-rose-700 px-2.5 py-1 text-white hover:bg-rose-800"
          onClick={() => void installUpdate()}
        >
          Retry
        </button>
        <button
          type="button"
          className="underline opacity-80"
          onClick={() => setState({ kind: "hidden" })}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-3 border-b border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-center text-xs font-medium text-emerald-950 dark:text-emerald-50"
    >
      <span>
        New update available: v{state.version}
        {state.notes ? ` — ${state.notes.slice(0, 120)}` : ""}
      </span>
      <button
        type="button"
        className="rounded bg-emerald-700 px-2.5 py-1 text-white hover:bg-emerald-800"
        onClick={() => void installUpdate()}
      >
        Update &amp; Restart
      </button>
      <button
        type="button"
        className="underline opacity-80"
        onClick={() => setDismissedVersion(state.version)}
      >
        Later
      </button>
    </div>
  );
}
