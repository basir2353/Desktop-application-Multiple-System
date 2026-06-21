export type OrganizationId = string;
export type UserId = string;
export type DeviceId = string;
export type ModuleSlug = string;

export type SessionContext = {
  userId: UserId;
  organizationId: OrganizationId;
  permissions: string[];
};

export type OutboxStatus = "pending" | "syncing" | "failed" | "completed";
