import {
  businessSchema,
  licencePaymentSchema,
  licenceReminderResultSchema,
  monthlyLicenceStatusSchema,
  platformAnalyticsSchema,
  platformPublicInfoSchema,
  platformSettingsSchema,
  platformUserSchema,
  systemTypeSchema,
  type Business,
  type CreateBusiness,
  type CreateLicencePayment,
  type CreatePlatformUser,
  type GrantLicenceDays,
  type LicencePayment,
  type LicenceReminderResult,
  type MonthlyLicenceStatus,
  type PlatformAnalytics,
  type PlatformPublicInfo,
  type PlatformSettings,
  type PlatformUser,
  type SendLicenceReminders,
  type SystemType,
  type UpdateBusiness,
  type UpdatePlatformSettings,
  type UpdatePlatformUser,
  type ResetBusinessTransactionsResult,
  resetBusinessTransactionsResultSchema,
} from "@platform/contracts";
import { getApiBaseUrl } from "./apiBase";
import { authFetch } from "./authFetch";

async function readJson<T>(res: Response, parse: (json: unknown) => T): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (typeof parsed.message === "string") message = parsed.message;
      else if (Array.isArray(parsed.message)) message = parsed.message.join(", ");
    } catch {
      // keep raw text
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
  const json: unknown = await res.json();
  return parse(json);
}

export async function fetchPlatformPublicInfo(): Promise<PlatformPublicInfo> {
  const res = await fetch(`${getApiBaseUrl()}/v1/platform/public-info`);
  return readJson(res, (json) => platformPublicInfoSchema.parse(json));
}

export async function fetchPlatformAnalytics(): Promise<PlatformAnalytics> {
  const res = await authFetch("/v1/platform/analytics");
  return readJson(res, (json) => platformAnalyticsSchema.parse(json));
}

export async function fetchPlatformBusinesses(): Promise<Business[]> {
  const res = await authFetch("/v1/platform/businesses");
  return readJson(res, (json) => businessSchema.array().parse(json));
}

export async function fetchPlatformBusiness(businessId: string): Promise<Business> {
  const res = await authFetch(`/v1/platform/businesses/${businessId}`);
  return readJson(res, (json) => businessSchema.parse(json));
}

export async function createPlatformBusiness(input: CreateBusiness): Promise<Business> {
  const res = await authFetch("/v1/platform/businesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson(res, (json) => businessSchema.parse(json));
}

export async function updatePlatformBusiness(
  businessId: string,
  input: UpdateBusiness,
): Promise<Business> {
  const res = await authFetch(`/v1/platform/businesses/${businessId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson(res, (json) => businessSchema.parse(json));
}

export async function deletePlatformBusiness(businessId: string): Promise<void> {
  const res = await authFetch(`/v1/platform/businesses/${businessId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Delete failed (${res.status})`);
  }
}

/** Wipe all sales / journals / stock movements — dashboard & P&L go to zero. Keeps users & menu. */
export async function resetPlatformBusinessTransactions(
  businessId: string,
  confirmName: string,
): Promise<ResetBusinessTransactionsResult> {
  const res = await authFetch(`/v1/platform/businesses/${businessId}/reset-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmName }),
  });
  return readJson(res, (json) => resetBusinessTransactionsResultSchema.parse(json));
}

export async function grantPlatformLicence(
  businessId: string,
  input: GrantLicenceDays,
): Promise<Business> {
  const res = await authFetch(`/v1/platform/businesses/${businessId}/grant-licence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson(res, (json) => businessSchema.parse(json));
}

export async function fetchLicencePayments(businessId?: string): Promise<LicencePayment[]> {
  const q = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
  const res = await authFetch(`/v1/platform/licence-payments${q}`);
  return readJson(res, (json) => licencePaymentSchema.array().parse(json));
}

export async function fetchMonthlyLicenceStatus(
  year?: number,
  month?: number,
): Promise<MonthlyLicenceStatus> {
  const params = new URLSearchParams();
  if (year != null) params.set("year", String(year));
  if (month != null) params.set("month", String(month));
  const q = params.toString() ? `?${params}` : "";
  const res = await authFetch(`/v1/platform/licence-payments/monthly-status${q}`);
  return readJson(res, (json) => monthlyLicenceStatusSchema.parse(json));
}

export async function sendLicenceReminders(
  input: SendLicenceReminders = { mode: "all" },
): Promise<LicenceReminderResult> {
  const res = await authFetch("/v1/platform/licence-payments/send-reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson(res, (json) => licenceReminderResultSchema.parse(json));
}

export async function recordLicencePayment(
  businessId: string,
  input: CreateLicencePayment,
): Promise<{ payment: LicencePayment; business: Business }> {
  const res = await authFetch(`/v1/platform/businesses/${businessId}/licence-payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson(res, (json) => {
    const row = json as { payment?: unknown; business?: unknown };
    return {
      payment: licencePaymentSchema.parse(row.payment),
      business: businessSchema.parse(row.business),
    };
  });
}

export async function fetchPlatformUsers(): Promise<PlatformUser[]> {
  const res = await authFetch("/v1/platform/users");
  return readJson(res, (json) => platformUserSchema.array().parse(json));
}

export async function createPlatformUser(input: CreatePlatformUser): Promise<PlatformUser> {
  const res = await authFetch("/v1/platform/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson(res, (json) => platformUserSchema.parse(json));
}

export async function updatePlatformUser(
  userId: string,
  input: UpdatePlatformUser,
): Promise<PlatformUser> {
  const res = await authFetch(`/v1/platform/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson(res, (json) => platformUserSchema.parse(json));
}

export async function deletePlatformUser(userId: string): Promise<void> {
  const res = await authFetch(`/v1/platform/users/${userId}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Delete failed (${res.status})`);
  }
}

export async function resetPlatformUserPassword(userId: string, password: string): Promise<void> {
  const res = await authFetch(`/v1/platform/users/${userId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Reset failed (${res.status})`);
  }
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const res = await authFetch("/v1/platform/settings");
  return readJson(res, (json) => platformSettingsSchema.parse(json));
}

export async function updatePlatformSettings(
  input: UpdatePlatformSettings,
): Promise<PlatformSettings> {
  const res = await authFetch("/v1/platform/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson(res, (json) => platformSettingsSchema.parse(json));
}

export async function fetchPlatformSystemTypes(): Promise<{ id: SystemType; label: string }[]> {
  const res = await authFetch("/v1/platform/system-types");
  return readJson(res, (json) => {
    if (!Array.isArray(json)) throw new Error("Invalid system types response");
    return json.map((row) => {
      const item = row as { id?: unknown; label?: unknown };
      return {
        id: systemTypeSchema.parse(item.id),
        label: typeof item.label === "string" ? item.label : String(item.id),
      };
    });
  });
}
