import { Button } from "@platform/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isOnline, subscribeConnectivity } from "@platform/connectivity";
import { getApiBaseUrl } from "../../../lib/apiBase";
import { countPendingOutbox, flushAllOfflineData } from "../../../lib/offlineSync";
import { loadOfflineQueue } from "../../../store/lib/storePosSync";
import { countOfflinePopsOrders } from "../../lib/popsOfflineOrders";
import { useDataModeStore, type DataMode } from "../../../stores/dataModeStore";
import { useSessionStore } from "../../../stores/sessionStore";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleString();
}

export function SyncPage(): JSX.Element {
  const queryClient = useQueryClient();
  const accessToken = useSessionStore((s) => s.accessToken);
  const dataMode = useDataModeStore((s) => s.dataMode);
  const cloudApiUrl = useDataModeStore((s) => s.cloudApiUrl);
  const lastSyncedAt = useDataModeStore((s) => s.lastSyncedAt);
  const setDataMode = useDataModeStore((s) => s.setDataMode);
  const setCloudApiUrl = useDataModeStore((s) => s.setCloudApiUrl);

  const [online, setOnline] = useState(isOnline());
  const [apiUrlDraft, setApiUrlDraft] = useState(cloudApiUrl || getApiBaseUrl());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeConnectivity(setOnline), []);

  const pendingQuery = useQuery({
    queryKey: ["sync", "pending"],
    queryFn: async () => ({
      sales: loadOfflineQueue().length,
      outbox: await countPendingOutbox(),
      popsOrders: countOfflinePopsOrders(),
    }),
    refetchInterval: 5000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Sign in to sync with the cloud database.");
      return flushAllOfflineData(accessToken);
    },
    onSuccess: (summary) => {
      setNotice(
        `Synced ${summary.salesSynced} sale(s), ${summary.popsOrdersSynced} POS order(s), ${summary.outboxPushed} outbox batch(es)` +
          (summary.salesFailed + summary.popsOrdersFailed > 0
            ? ` — ${summary.salesFailed + summary.popsOrdersFailed} failed`
            : ""),
      );
      setError(null);
      void pendingQuery.refetch();
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => {
      setError(e.message);
      setNotice(null);
    },
  });

  function applyCloudUrl(): void {
    setCloudApiUrl(apiUrlDraft);
    setNotice("Cloud API URL saved.");
    setError(null);
  }

  function onModeChange(mode: DataMode): void {
    setDataMode(mode);
    setNotice(mode === "cloud" ? "Cloud mode — new data goes to the hosted database." : "Local mode — data stays on this device until you sync.");
    setError(null);
  }

  const pendingSales = pendingQuery.data?.sales ?? 0;
  const pendingOutbox = pendingQuery.data?.outbox ?? 0;
  const pendingPops = pendingQuery.data?.popsOrders ?? 0;
  const pendingTotal = pendingSales + pendingOutbox + pendingPops;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sync & data mode"
        subtitle="Cloud mode updates Railway Postgres. Local mode keeps sales on this device until you push."
        actions={
          <Button
            className="text-xs"
            disabled={syncMutation.isPending || !accessToken || pendingTotal === 0}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? "Syncing…" : "Push to cloud"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm">
        <Badge tone={online ? "success" : "warning"}>{online ? "Online" : "Offline"}</Badge>
        <Badge tone={dataMode === "cloud" ? "info" : "neutral"}>
          {dataMode === "cloud" ? "Cloud database" : "Local only"}
        </Badge>
        <span className="text-slate-400">Last sync · {formatRelativeTime(lastSyncedAt)}</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">
          Pending · {pendingTotal} ({pendingSales} sales, {pendingPops} POS, {pendingOutbox} outbox)
        </span>
      </div>

      {notice ? <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-300">{notice}</div> : null}
      {error ? <div className="rounded-lg border border-red-800/60 bg-red-950/30 px-4 py-2 text-sm text-red-300">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
          <div className="text-sm font-medium text-white">Where should data go?</div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700/80 bg-slate-950/50 p-3">
            <input
              type="radio"
              name="data-mode"
              className="mt-1 accent-amber-500"
              checked={dataMode === "cloud"}
              onChange={() => onModeChange("cloud")}
            />
            <span>
              <span className="block text-sm font-medium text-white">Cloud (Railway)</span>
              <span className="block text-xs text-slate-400">
                Sales and changes go to the hosted API / PostgreSQL. Temporary offline sales auto-sync when back online.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700/80 bg-slate-950/50 p-3">
            <input
              type="radio"
              name="data-mode"
              className="mt-1 accent-amber-500"
              checked={dataMode === "local"}
              onChange={() => onModeChange("local")}
            />
            <span>
              <span className="block text-sm font-medium text-white">Local device</span>
              <span className="block text-xs text-slate-400">
                Data is stored on this computer. Use &quot;Push to cloud&quot; when you want to upload to Railway.
              </span>
            </span>
          </label>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="text-sm font-medium text-white">Cloud API URL</div>
          <p className="text-xs text-slate-400">
            Your Railway API domain (not the Postgres URL). Use the private Postgres URL only on the Railway API service — not here.
          </p>
          <input
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="https://your-api.up.railway.app"
            value={apiUrlDraft}
            onChange={(e) => setApiUrlDraft(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="text-xs" onClick={applyCloudUrl}>
              Save URL
            </Button>
            <span className="self-center text-xs text-slate-500">Active: {getApiBaseUrl()}</span>
          </div>
          {!accessToken ? (
            <p className="text-xs text-amber-400">Sign in to push local data to the cloud database.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
