import { authFetch } from "../lib/authFetch";

export type OrgUser = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  branchScope?: string;
  permissions?: string[];
  lastActivityAt?: string | null;
};

export type TaxFeatures = { fbrEnabled: boolean; praEnabled: boolean };

export type SecurityOverview = {
  failedLogins24h: number;
  policyViolations24h: number;
  activeDevices: number;
  auditTrail: Array<{
    id: string;
    time: string;
    user: string;
    action: string;
    detail: string;
    module: string;
    severity: string;
  }>;
};

export type AccessControlRole = {
  id: string;
  label: string;
  permissions: string[];
};

export type AccessControl = {
  roles: AccessControlRole[];
  capabilities: Array<{ id: string; label: string }>;
};

export type CreateOrgUserInput = {
  email: string;
  password: string;
  role: string;
  branchScope: string;
  pinRequired?: boolean;
  staffPin?: string;
};

export const ADMIN_ROLES = [
  { id: "admin", label: "Admin" },
  { id: "manager", label: "Incharge" },
  { id: "cashier", label: "Cashier" },
  { id: "waiter", label: "Waiter" },
  { id: "kitchen", label: "Kitchen" },
  { id: "accountant", label: "Accountant" },
  { id: "hr", label: "HR" },
  { id: "rider", label: "Rider" },
] as const;

function normalizeOrgUser(row: unknown): OrgUser {
  const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  return {
    id: typeof r.id === "string" ? r.id : String(r.id ?? ""),
    email: typeof r.email === "string" ? r.email : "",
    role: typeof r.role === "string" ? r.role : "",
    active: r.active !== false,
    branchScope: typeof r.branchScope === "string" ? r.branchScope : undefined,
    permissions: Array.isArray(r.permissions)
      ? r.permissions.filter((p): p is string => typeof p === "string")
      : undefined,
    lastActivityAt: typeof r.lastActivityAt === "string" ? r.lastActivityAt : null,
  };
}

export function roleLabel(role: string): string {
  const found = ADMIN_ROLES.find((r) => r.id === role);
  if (found) return found.label;
  if (role === "manager") return "Incharge";
  return role;
}

export async function fetchOrgUsers(): Promise<OrgUser[]> {
  const res = await authFetch("/v1/users");
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Failed to load users (${res.status})`);
  }
  const raw = (await res.json()) as unknown;
  return Array.isArray(raw) ? raw.map(normalizeOrgUser) : [];
}

export async function fetchAccessControl(): Promise<AccessControl> {
  const res = await authFetch("/v1/users/access-control");
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Failed to load access control (${res.status})`);
  }
  const raw = (await res.json()) as {
    roles?: AccessControlRole[];
    capabilities?: Array<{ id: string; label: string }>;
  };
  return {
    roles: Array.isArray(raw.roles)
      ? raw.roles
      : ADMIN_ROLES.map((r) => ({ id: r.id, label: r.label, permissions: [] as string[] })),
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
  };
}

export async function createOrgUser(input: CreateOrgUserInput): Promise<OrgUser> {
  const res = await authFetch("/v1/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
      role: input.role,
      branchScope: input.branchScope.trim() || "ALL",
      pinRequired: Boolean(input.pinRequired),
      ...(input.staffPin ? { staffPin: input.staffPin } : {}),
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Could not create user (${res.status})`);
  }
  return normalizeOrgUser(await res.json());
}

export async function fetchSecurityOverview(branchCode?: string): Promise<SecurityOverview> {
  const q = branchCode ? `?branchCode=${encodeURIComponent(branchCode)}` : "";
  const res = await authFetch(`/v1/security/overview${q}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Failed to load activity (${res.status})`);
  }
  const raw = (await res.json()) as {
    metrics?: {
      failedLogins24h?: number;
      activeDevices?: number;
      policyViolations?: number;
    };
    auditTrail?: SecurityOverview["auditTrail"];
  };
  return {
    failedLogins24h: raw.metrics?.failedLogins24h ?? 0,
    activeDevices: raw.metrics?.activeDevices ?? 0,
    policyViolations24h: raw.metrics?.policyViolations ?? 0,
    auditTrail: Array.isArray(raw.auditTrail) ? raw.auditTrail : [],
  };
}

export async function fetchTaxFeatures(): Promise<TaxFeatures> {
  const res = await authFetch("/v1/tax-authority/features");
  if (res.status === 404) {
    // Older Railway builds may not expose this route yet.
    return { fbrEnabled: false, praEnabled: false };
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Failed to load tax features (${res.status})`);
  }
  return (await res.json()) as TaxFeatures;
}

export async function updateTaxFeatures(patch: {
  praEnabled?: boolean;
  fbrEnabled?: boolean;
}): Promise<TaxFeatures> {
  const res = await authFetch("/v1/tax-authority/features", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    if (res.status === 404) {
      throw new Error(
        "PRA toggle API is not deployed on this server yet. Redeploy backend-desktop to enable it.",
      );
    }
    if (res.status === 403) {
      throw new Error(err?.message ?? "Only Admin / Incharge can change PRA settings.");
    }
    throw new Error(err?.message ?? `Could not update tax features (${res.status})`);
  }
  return (await res.json()) as TaxFeatures;
}

export async function updateOrgUser(
  userId: string,
  patch: { active?: boolean; role?: string; branchScope?: string },
): Promise<OrgUser> {
  const res = await authFetch(`/v1/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Could not update user (${res.status})`);
  }
  return normalizeOrgUser(await res.json());
}

export async function resetOrgUserPassword(userId: string, password: string): Promise<void> {
  const res = await authFetch(`/v1/users/${userId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(err?.message ?? `Could not reset password (${res.status})`);
  }
}
