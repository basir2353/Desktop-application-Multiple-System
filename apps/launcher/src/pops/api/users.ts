import {
  accessControlSchema,
  inviteOrgUserResultSchema,
  invitePreviewSchema,
  orgUserSchema,
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
import { authFetch } from "../../lib/authFetch";
import { getApiBaseUrl } from "../../lib/apiBase";

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
  return json.map((row) => orgUserSchema.parse(row));
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
  return orgUserSchema.parse(json);
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
  const res = await authFetch(`/v1/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Update user failed: ${res.status}`);
  }
  const json: unknown = await res.json();
  return orgUserSchema.parse(json);
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
  const res = await fetch(`${getApiBaseUrl()}/v1/auth/invite?${params}`);
  if (!res.ok) throw new Error(`Invite not found or expired (${res.status})`);
  const json: unknown = await res.json();
  return invitePreviewSchema.parse(json);
}

export async function acceptInvite(token: string, password: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/v1/auth/accept-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Could not accept invite (${res.status})`);
  }
}
