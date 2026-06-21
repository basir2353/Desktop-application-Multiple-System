import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NotificationTemplate } from "@platform/contracts";
import {
  fetchNotificationTemplates,
  sendTestNotification,
  updateNotificationTemplate,
} from "../../../api/notifications";
import { notifyInputClass, useNotificationsAccess } from "../../../hooks/useNotifications";
import { Badge } from "../../../ui/Badge";
import { PageHeader } from "../../../ui/PageHeader";
import { NotifyError, NotifyLoading } from "./NotifyUi";

export function NotificationTemplatesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const { canManage } = useNotificationsAccess();
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [body, setBody] = useState("");
  const [testRecipient, setTestRecipient] = useState("");

  const templatesQuery = useQuery({
    queryKey: ["notifications", "templates"],
    queryFn: fetchNotificationTemplates,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, body: b }: { id: string; body: string }) =>
      updateNotificationTemplate(id, { body: b }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setEditing(null);
    },
  });

  const testMutation = useMutation({
    mutationFn: sendTestNotification,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setTestRecipient("");
    },
  });

  if (templatesQuery.isLoading) return <NotifyLoading />;
  if (templatesQuery.isError) return <NotifyError message={(templatesQuery.error as Error).message} />;

  const templates = templatesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Template editor"
        subtitle="Edit SMS, WhatsApp, and in-app message templates. Use {{variable}} placeholders."
        actions={
          <Link to="/pops/notifications" className="text-xs text-slate-400 hover:text-white">
            ← Notifications
          </Link>
        }
      />

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium text-white">{t.name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone="neutral">{t.channel.toUpperCase()}</Badge>
                  <span className="font-mono text-xs text-slate-500">{t.templateKey}</span>
                </div>
                {t.description ? <p className="mt-1 text-xs text-slate-500">{t.description}</p> : null}
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="text-xs text-sky-400 hover:text-sky-300"
                  onClick={() => {
                    setEditing(t);
                    setBody(t.body);
                  }}
                >
                  Edit
                </button>
              ) : null}
            </div>

            {editing?.id === t.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  className={`${notifyInputClass} min-h-[5rem] w-full`}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ id: t.id, body })}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="text-xs text-slate-400">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950/60 p-3 text-xs text-slate-300">
                {t.body}
              </pre>
            )}

            {canManage ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
                <input
                  className={`${notifyInputClass} max-w-xs flex-1`}
                  placeholder="Test recipient label"
                  value={editing?.id === t.id ? testRecipient : ""}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  onFocus={() => {
                    if (editing?.id !== t.id) setEditing(t);
                  }}
                />
                <button
                  type="button"
                  disabled={testMutation.isPending || !testRecipient.trim()}
                  onClick={() =>
                    testMutation.mutate({
                      templateKey: t.templateKey,
                      recipientLabel: testRecipient.trim(),
                    })
                  }
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 disabled:opacity-50"
                >
                  Send test
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
