import {
  accessControlSchema,
  inviteOrgUserResultSchema,
  invitePreviewSchema,
  pendingInviteSchema,
  type AccessControl,
  type CreateOrgUser,
  type InviteOrgUser,
  type InviteOrgUserResult,
  type InvitePreview,
  type OrgUser,
  type PendingInvite,
  type UpdateOrgUser,
} from "@platform/contracts";
import { platformFetch } from "@platform/auth-client";
import { authFetch } from "../../lib/authFetch";
import { getApiBaseUrl } from "../../lib/apiBase";

/**
 * Live Railway API may omit newer fields (`active`, `navAllowlist`).
 * Never throw Zod "Required" errors for those — normalize for every page.
 */
export function normalizeOrgUser(row: unknown): OrgUser {
  const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const permissions = Array.isArray(r.permissions)
    ? r.permissions.filter((p): p is string => typeof p === "string")
    : [];
  const navRaw = r.navAllowlist;
  const navAllowlist = Array.isArray(navRaw)
    ? navRaw.filter((p): p is string => typeof p === "string")
    : null;
  return {
    id: typeof r.id === "string" ? r.id : String(r.id ?? ""),
    email: typeof r.email === "string" ? r.email : "",
    role: typeof r.role === "string" ? r.role : "",
    branchScope: typeof r.branchScope === "string" ? r.branchScope : "all",
    pinRequired: Boolean(r.pinRequired),
    permissions,
    active: r.active !== false,
    navAllowlist,
    lastActivityAt: typeof r.lastActivityAt === "string" ? r.lastActivityAt : null,
  };
}

export async function fetchAccessControl(): Promise<AccessControl> {
  const res = await authFetch("/v1/users/access-control");
  if (!res.ok) throw new Error(`Access control failed: ${res.status}`);
  const json: unknown = await res.json();
  return accessControlSchema.parse(json);
}

export async function fetchOrgUsers(): Promise<OrgUser[]> {
  const res = await authFetch("/v1/users");
  if (!res.ok) throw new Error(`Users failed: ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid users response");
  return json.map((row) => normalizeOrgUser(row));
}

export async function fetchPendingInvites(): Promise<PendingInvite[]> {
  const res = await authFetch("/v1/users/invites");
  if (!res.ok) throw new Error(`Invites failed: ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("Invalid invites response");
  return json.map((row) => pendingInviteSchema.parse(row));
}

export async function createOrgUser(input: CreateOrgUser): Promise<OrgUser> {
  const res = await authFetch("/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Create user failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return normalizeOrgUser(json);
}

export async function inviteOrgUser(input: InviteOrgUser): Promise<InviteOrgUserResult> {
  const res = await authFetch("/v1/users/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Invite failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return inviteOrgUserResultSchema.parse(json);
}

export async function updateOrgUser(userId: string, input: UpdateOrgUser): Promise<OrgUser> {
  // Older live APIs ignore unknown fields; only send defined keys.
  const body: Record<string, unknown> = {};
  if (input.role !== undefined) body.role = input.role;
  if (input.branchScope !== undefined) body.branchScope = input.branchScope;
  if (input.pinRequired !== undefined) body.pinRequired = input.pinRequired;
  if (input.password !== undefined) body.password = input.password;
  if (input.staffPin !== undefined) body.staffPin = input.staffPin;
  if (input.permissions !== undefined) body.permissions = input.permissions;
  if (input.active !== undefined) body.active = input.active;
  if (input.navAllowlist !== undefined) body.navAllowlist = input.navAllowlist;

  const res = await authFetch(`/v1/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Update user failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return normalizeOrgUser(json);
}

export async function resetOrgUserPassword(userId: string, password: string): Promise<void> {
  const res = await authFetch(`/v1/users/${userId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Password reset failed: ${res.status}`);
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const params = new URLSearchParams({ token });
  const res = await platformFetch(`${getApiBaseUrl()}/v1/auth/invite?${params}`);
  if (!res.ok) throw new Error(`Invite not found or expired (${res.status})`);
  const json: unknown = await res.json();
  return invitePreviewSchema.parse(json);
}

export async function acceptInvite(token: string, password: string): Promise<void> {
  const res = await platformFetch(`${getApiBaseUrl()}/v1/auth/accept-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Could not accept invite (${res.status})`);
  }
}
