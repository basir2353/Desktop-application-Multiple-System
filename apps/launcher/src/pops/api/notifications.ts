import {
  notificationLogEntrySchema,
  notificationSettingsSchema,
  notificationsOverviewSchema,
  notificationTemplateSchema,
  updateNotificationSettingsSchema,
  updateNotificationTemplateSchema,
  type NotificationLogEntry,
  type NotificationSettings,
  type NotificationsOverview,
  type NotificationTemplate,
  type SendTestNotification,
  type UpdateNotificationSettings,
  type UpdateNotificationTemplate,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

export async function fetchNotificationsOverview(): Promise<NotificationsOverview> {
  const res = await authFetch("/v1/notifications/overview");
  if (!res.ok) throw new Error(await readError(res));
  return notificationsOverviewSchema.parse(await res.json());
}

export async function updateNotificationSettings(
  input: UpdateNotificationSettings,
): Promise<NotificationSettings> {
  const body = updateNotificationSettingsSchema.parse(input);
  const res = await authFetch("/v1/notifications/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return notificationSettingsSchema.parse(await res.json());
}

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  const res = await authFetch("/v1/notifications/templates");
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { templates: unknown[] };
  return notificationTemplateSchema.array().parse(json.templates);
}

export async function updateNotificationTemplate(
  templateId: string,
  input: UpdateNotificationTemplate,
): Promise<NotificationTemplate> {
  const body = updateNotificationTemplateSchema.parse(input);
  const res = await authFetch(`/v1/notifications/templates/${templateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return notificationTemplateSchema.parse(await res.json());
}

export async function fetchNotificationLog(limit = 100): Promise<NotificationLogEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await authFetch(`/v1/notifications/log?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { entries: unknown[] };
  return notificationLogEntrySchema.array().parse(json.entries);
}

export async function sendTestNotification(input: SendTestNotification) {
  const res = await authFetch("/v1/notifications/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return notificationLogEntrySchema.parse(await res.json());
}

async function readError(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { message?: string } | null;
  return err?.message ?? `Request failed: ${res.status}`;
}
