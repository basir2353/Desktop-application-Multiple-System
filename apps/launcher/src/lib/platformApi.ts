import {
  businessSchema,
  platformAnalyticsSchema,
  platformSettingsSchema,
  platformUserSchema,
  systemTypeSchema,
  type Business,
  type CreateBusiness,
  type PlatformAnalytics,
  type PlatformSettings,
  type PlatformUser,
  type SystemType,
  type UpdateBusiness,
  type UpdatePlatformSettings,
} from "@platform/contracts";
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

export async function fetchPlatformAnalytics(): Promise<PlatformAnalytics> {
  const res = await authFetch("/v1/platform/analytics");
  return readJson(res, (json) => platformAnalyticsSchema.parse(json));
}

export async function fetchPlatformBusinesses(): Promise<Business[]> {
  const res = await authFetch("/v1/platform/businesses");
  return readJson(res, (json) => businessSchema.array().parse(json));
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

export async function fetchPlatformUsers(): Promise<PlatformUser[]> {
  const res = await authFetch("/v1/platform/users");
  return readJson(res, (json) => platformUserSchema.array().parse(json));
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
