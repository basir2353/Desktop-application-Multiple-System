import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotificationsOverview,
  updateNotificationSettings,
} from "../../../api/notifications";
import { useNotificationsAccess } from "../../../hooks/useNotifications";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { SimpleTable } from "../../../ui/SimpleTable";
import { NotifyError, NotifyLoading } from "./NotifyUi";
import { usePopsStore } from "../../../../stores/popsStore";
import {
  loadWhatsAppShareSettings,
  saveWhatsAppShareSettings,
  type WhatsAppShareSettings,
} from "../../../lib/whatsappShare";
import { useEffect, useState } from "react";

type SettingKey = "smsEnabled" | "whatsappEnabled" | "printerAlertsEnabled";

const CHANNEL_CARDS: { key: SettingKey; label: string }[] = [
  { key: "smsEnabled", label: "SMS gateway" },
  { key: "whatsappEnabled", label: "WhatsApp Business" },
  { key: "printerAlertsEnabled", label: "Printer alerts" },
];

export function NotificationsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { canManage } = useNotificationsAccess();
  const branch = usePopsStore((state) => state.branch);
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppShareSettings>(() =>
    loadWhatsAppShareSettings(branch?.code),
  );
  const [whatsappNotice, setWhatsappNotice] = useState<string | null>(null);

  useEffect(() => {
    setWhatsappSettings(loadWhatsAppShareSettings(branch?.code));
  }, [branch?.code]);

  const overviewQuery = useQuery({
    queryKey: ["notifications", "overview"],
    refetchInterval: 15_000,
    queryFn: fetchNotificationsOverview,
  });

  const settingsMutation = useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (overviewQuery.isLoading) return <NotifyLoading label="Loading notifications…" />;
  if (overviewQuery.isError) return <NotifyError message={(overviewQuery.error as Error).message} />;

  const data = overviewQuery.data!;
  const settings = data.settings;

  function toggleSetting(key: SettingKey): void {
    if (!canManage) return;
    settingsMutation.mutate({ [key]: !settings[key] });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications & messaging"
        subtitle="SMS, WhatsApp, in-app alerts, templates, and delivery of invoices — linked to delivery and kitchen."
        actions={
          <Link
            to="/pops/notifications/templates"
            className="inline-flex items-center rounded-md px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
          >
            Template editor
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Sent today", value: String(data.stats.sentToday) },
          { label: "Skipped (disabled)", value: String(data.stats.skippedToday) },
          { label: "Templates", value: String(data.templates.length) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CHANNEL_CARDS.map((c) => (
          <label
            key={c.key}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
          >
            <span className="text-sm text-slate-200">{c.label}</span>
            <input
              type="checkbox"
              className="accent-amber-500"
              checked={settings[c.key]}
              disabled={!canManage || settingsMutation.isPending}
              onChange={() => toggleSetting(c.key)}
            />
          </label>
        ))}
      </div>

      {!canManage ? (
        <p className="text-xs text-slate-500">Channel toggles require admin or manager access.</p>
      ) : null}

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-sm font-medium text-white">WhatsApp QR sharing</div>
        <p className="mt-1 text-xs text-slate-500">
          The branch number is embedded in table QR links. Invoice sharing opens WhatsApp with a pre-filled message; it is not reported as sent by the server.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-xs text-slate-400">
            Branch WhatsApp number
            <input
              className="mt-1 block w-56 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              placeholder="0300 1234567"
              value={whatsappSettings.branchPhone}
              disabled={!canManage}
              onChange={(event) => setWhatsappSettings((current) => ({ ...current, branchPhone: event.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={whatsappSettings.enabled}
              disabled={!canManage}
              onChange={(event) => setWhatsappSettings((current) => ({ ...current, enabled: event.target.checked }))}
            />
            Enable browser WhatsApp sharing
          </label>
          {canManage ? (
            <button
              type="button"
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
              onClick={() => {
                if (branch?.code) saveWhatsAppShareSettings(branch.code, whatsappSettings);
                setWhatsappNotice("WhatsApp sharing settings saved.");
              }}
            >
              Save WhatsApp settings
            </button>
          ) : null}
        </div>
        {whatsappNotice ? <p className="mt-2 text-xs text-emerald-300">{whatsappNotice}</p> : null}
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <SimpleTable
          rowKey={(r) => String(r.id)}
          rows={data.recentLog as unknown as Record<string, unknown>[]}
          columns={[
            { key: "timeLabel", header: "Time" },
            {
              key: "channel",
              header: "Channel",
              render: (r) => <Badge tone="neutral">{String(r.channelLabel)}</Badge>,
            },
            { key: "recipientLabel", header: "Recipient" },
            { key: "templateName", header: "Template" },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={r.status === "sent" ? "success" : r.status === "skipped" ? "warning" : "neutral"}>
                  {String(r.status)}
                </Badge>
              ),
            },
          ]}
        />
      </div>

      <p className="text-xs text-slate-500">
        Assigning a rider on{" "}
        <Link to="/pops/delivery" className="text-amber-400/90 hover:text-amber-300">
          Delivery
        </Link>{" "}
        sends an SMS when the gateway is enabled. Header alerts remain live from kitchen and inventory.
      </p>
    </div>
  );
}
