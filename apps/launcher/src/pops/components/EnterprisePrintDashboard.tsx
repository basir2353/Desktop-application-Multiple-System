/** Clean Branch Print Server panel — less clutter, clearer actions. */

import { Button } from "@platform/ui";
import { useCallback, useEffect, useState } from "react";
import {
  BRANCH_PRINT_QUEUE_CHANGED_EVENT,
  branchPrintQueueAction,
  discoverBranchPrintServers,
  ensureBranchPrintWorker,
  ensureCloudPrintPoller,
  getBranchPrintServerStatus,
  listBranchPrintQueue,
  loadBranchPrintSettings,
  loadPreferredBranchServer,
  saveBranchPrintSettings,
  savePreferredBranchServer,
  startBranchPrintServer,
  stopBranchPrintServer,
  type BranchQueueJob,
  type BranchPrintServerSettings,
  type BranchServerStatus,
  type DiscoveredBranchServer,
} from "../lib/branchPrintClient";
import { isDesktopAppRuntime } from "../lib/systemPrinters";
import { authFetch } from "../../lib/authFetch";
import {
  IconAlert,
  IconCheck,
  IconPlay,
  IconSearch,
  IconServer,
  IconStop,
  IconWifi,
} from "./printerUiIcons";

export function EnterprisePrintDashboard({
  branchCode,
  branchName,
  onCustomizeReceipt,
}: {
  branchCode: string;
  branchName: string;
  onCustomizeReceipt?: () => void;
}): JSX.Element {
  const [settings, setSettings] = useState<BranchPrintServerSettings>(() =>
    loadBranchPrintSettings(branchCode),
  );
  const [status, setStatus] = useState<BranchServerStatus | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredBranchServer[]>([]);
  const [queue, setQueue] = useState<BranchQueueJob[]>([]);
  const [preferred, setPreferred] = useState<DiscoveredBranchServer | null>(() =>
    loadPreferredBranchServer(),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [cloudOk, setCloudOk] = useState(false);
  const desktop = isDesktopAppRuntime();

  const refresh = useCallback(async () => {
    const [st, q] = await Promise.all([
      getBranchPrintServerStatus(),
      listBranchPrintQueue(branchCode),
    ]);
    setStatus(st);
    setQueue(q);
  }, [branchCode]);

  useEffect(() => {
    setSettings(loadBranchPrintSettings(branchCode));
    ensureBranchPrintWorker();
    void refresh();
    const onQueue = () => void refresh();
    window.addEventListener(BRANCH_PRINT_QUEUE_CHANGED_EVENT, onQueue);
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      window.removeEventListener(BRANCH_PRINT_QUEUE_CHANGED_EVENT, onQueue);
      window.clearInterval(timer);
    };
  }, [branchCode, refresh]);

  useEffect(() => {
    if (!desktop || !settings.cloudHeartbeat) return;
    ensureCloudPrintPoller(settings.branchCode || branchCode);
    const beat = async () => {
      const st = await getBranchPrintServerStatus();
      if (!st?.running) return;
      try {
        await authFetch(`/v1/printing/branch-servers/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serverId: settings.serverId,
            branchCode: settings.branchCode || branchCode,
            localIp: st.localIp,
            port: st.port,
            printerCount: st.printerCount,
            queuePending: st.queuePending,
            queueFailed: st.queueFailed,
            at: new Date().toISOString(),
          }),
        });
        setCloudOk(true);
      } catch {
        setCloudOk(false);
      }
    };
    void beat();
    const id = window.setInterval(() => void beat(), 30_000);
    return () => window.clearInterval(id);
  }, [desktop, settings.cloudHeartbeat, settings.serverId, settings.branchCode, branchCode]);

  async function onStart(): Promise<void> {
    const next = {
      ...settings,
      branchCode,
      branchName: branchName || settings.branchName,
      enabled: true,
      useQueue: true,
    };
    saveBranchPrintSettings(next);
    setSettings(next);
    const st = await startBranchPrintServer(next);
    if (st && "error" in st) {
      setNotice(st.error);
      await refresh();
      return;
    }
    setStatus(st);
    ensureBranchPrintWorker();
    try {
      const { importLegacyPrinterRouting } = await import("../lib/branchPrintClient");
      const imported = await importLegacyPrinterRouting(branchCode);
      if (imported > 0 && st?.running) {
        setNotice(`Server online · ${st.localIp}:${st.port} · ${imported} printers imported`);
        return;
      }
    } catch {
      // ignore
    }
    setNotice(st?.running ? `Server online · ${st.localIp}:${st.port}` : "Could not start server");
  }

  async function onStop(): Promise<void> {
    await stopBranchPrintServer();
    await refresh();
    setNotice("Server stopped");
  }

  async function onDiscover(): Promise<void> {
    const found = await discoverBranchPrintServers(2000);
    setDiscovered(found);
    setNotice(found.length ? `${found.length} server(s) found on LAN` : "No servers on LAN yet");
  }

  function persistSettings(patch: Partial<BranchPrintServerSettings>): void {
    const next = { ...settings, ...patch, branchCode };
    saveBranchPrintSettings(next);
    setSettings(next);
  }

  const running = Boolean(status?.running);
  const pending = queue.filter((j) =>
    ["pending", "retrying", "printing"].includes(j.status),
  ).length;
  const failed = queue.filter((j) => j.status === "failed").length;

  return (
    <div className="space-y-4">
      {!desktop ? (
        <div className="flex gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
          <div>
            <div className="font-semibold text-sky-50">Desktop app required for LAN server</div>
            <p className="mt-1 text-xs leading-relaxed text-sky-100/80">
              Browser mode mein Start disable hai. Silent mobile printing ke liye Windows{" "}
              <span className="font-medium text-white">.exe</span> se launcher kholo, phir Start dabao.
            </p>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {notice}
        </div>
      ) : null}

      {/* Hero status */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                running ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"
              }`}
            >
              <IconServer className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Branch Print Server</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    running
                      ? "bg-emerald-500/20 text-emerald-300"
                      : desktop
                        ? "bg-slate-700/80 text-slate-300"
                        : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {running ? "Online" : desktop ? "Stopped" : "Browser"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {running && status?.localIp
                  ? `${status.localIp}:${status.port}`
                  : "Mobile & POS yahan se silent print jobs bhejte hain"}
                {cloudOk ? " · Cloud synced" : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs"
              onClick={() => void onStart()}
            >
              <IconPlay className="h-3.5 w-3.5" />
              Start / Restart
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="inline-flex items-center gap-1.5 text-xs"
              disabled={!desktop || !running}
              onClick={() => void onStop()}
            >
              <IconStop className="h-3.5 w-3.5" />
              Stop
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="inline-flex items-center gap-1.5 text-xs"
              onClick={() => void onDiscover()}
            >
              <IconSearch className="h-3.5 w-3.5" />
              Discover
            </Button>
            {onCustomizeReceipt ? (
              <Button
                type="button"
                variant="ghost"
                className="inline-flex items-center gap-1.5 text-xs text-amber-300"
                onClick={onCustomizeReceipt}
              >
                Customize receipt
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-px bg-slate-800 sm:grid-cols-3">
          <Metric label="Queue" value={String(pending)} ok={pending === 0} />
          <Metric label="Failed" value={String(failed)} ok={failed === 0} danger={failed > 0} />
          <Metric
            label="Port"
            value={String(settings.port)}
            ok
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-xs text-slate-300">
          <Toggle
            checked={settings.enabled}
            onChange={(v) => persistSettings({ enabled: v })}
            label="Enabled"
          />
          <Toggle
            checked={settings.useQueue}
            onChange={(v) => persistSettings({ useQueue: v })}
            label="Use queue"
          />
          <Toggle
            checked={settings.cloudHeartbeat}
            onChange={(v) => persistSettings({ cloudHeartbeat: v })}
            label="Cloud heartbeat"
          />
          <label className="inline-flex items-center gap-2">
            <span className="text-slate-500">Port</span>
            <input
              type="number"
              className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
              value={settings.port}
              onChange={(e) => persistSettings({ port: Number(e.target.value) || 9740 })}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <IconWifi className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-white">LAN servers</h3>
          </div>
          {preferred ? (
            <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs">
              <div>
                <div className="flex items-center gap-1.5 font-medium text-emerald-200">
                  <IconCheck className="h-3.5 w-3.5" />
                  Preferred
                </div>
                <div className="mt-0.5 text-emerald-100/80">
                  {preferred.serverName} · {preferred.localIp}:{preferred.port}
                </div>
              </div>
              <button
                type="button"
                className="text-emerald-300/80 underline"
                onClick={() => {
                  savePreferredBranchServer(null);
                  setPreferred(null);
                }}
              >
                Clear
              </button>
            </div>
          ) : null}
          <div className="space-y-2">
            {discovered.length === 0 ? (
              <p className="text-xs text-slate-500">Discover dabao — network pe servers dhoondhega.</p>
            ) : (
              discovered.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-100">{s.serverName || s.id}</div>
                    <div className="text-[11px] text-slate-500">
                      {s.branchName || s.branchCode} · {s.localIp}:{s.port}
                      {s.pingMs != null ? ` · ${s.pingMs}ms` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 text-[11px]"
                    onClick={() => {
                      savePreferredBranchServer(s);
                      setPreferred(s);
                      setNotice(`Preferred → ${s.localIp}`);
                    }}
                  >
                    Prefer
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Live queue</h3>
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {queue.length === 0 ? (
              <p className="text-xs text-slate-500">Queue empty — prints yahan dikhenge jab queue on ho.</p>
            ) : (
              queue.slice(0, 30).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 px-2.5 py-2 text-[11px]"
                >
                  <div className="min-w-0">
                    <span
                      className={`mr-2 inline-block rounded-full px-1.5 py-0.5 font-medium ${
                        job.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : job.status === "failed"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {job.status}
                    </span>
                    <span className="text-slate-300">{job.printerName ?? "—"}</span>
                    <span className="text-slate-500"> · {job.orderId ?? "—"}</span>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {(["retry", "pause", "cancel"] as const).map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="rounded px-1 text-amber-300/90 hover:bg-amber-500/10"
                        onClick={() => void branchPrintQueueAction(job.id, action).then(() => refresh())}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  ok,
  danger,
}: {
  label: string;
  value: string;
  ok?: boolean;
  danger?: boolean;
}): JSX.Element {
  return (
    <div className="bg-slate-950/80 px-5 py-3">
      <div
        className={`text-xl font-semibold tabular-nums ${
          danger ? "text-red-400" : ok ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}): JSX.Element {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        className="rounded border-slate-600"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
