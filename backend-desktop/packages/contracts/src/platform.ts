import { z } from "zod";

/**
 * Canonical business system types.
 * New modules (hospital, hotel, …) are added here without changing auth/RBAC core.
 */
export const SYSTEM_TYPES = [
  "restaurant",
  "pharmacy",
  "general_store",
  "grocery",
  "retail",
] as const;

export const systemTypeSchema = z.enum(SYSTEM_TYPES);
export type SystemType = z.infer<typeof systemTypeSchema>;

export const SYSTEM_TYPE_LABELS: Record<SystemType, string> = {
  restaurant: "Restaurant POS",
  pharmacy: "Pharmacy POS",
  general_store: "General Store POS",
  grocery: "Grocery POS",
  retail: "Retail POS",
};

/** Frontend edition / route IDs use hyphens; DB / JWT use underscores. */
export function systemTypeToFrontendId(systemType: SystemType): string {
  if (systemType === "general_store") return "general-store";
  return systemType;
}

export function frontendIdToSystemType(id: string): SystemType | null {
  if (id === "general-store") return "general_store";
  const parsed = systemTypeSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export const BUSINESS_STATUSES = ["active", "inactive", "suspended", "deleted"] as const;
export const businessStatusSchema = z.enum(BUSINESS_STATUSES);
export type BusinessStatus = z.infer<typeof businessStatusSchema>;

export const PLATFORM_ROLES = ["super_admin"] as const;
export const platformRoleSchema = z.enum(PLATFORM_ROLES);
export type PlatformRole = z.infer<typeof platformRoleSchema>;

/** Permissions granted exclusively to the platform Super Admin. */
export const PLATFORM_PERMISSIONS = [
  "*",
  "platform.businesses.manage",
  "platform.licences.manage",
  "platform.settings.manage",
  "platform.users.manage",
  "platform.analytics.read",
  "platform.permissions.manage",
] as const;

export function permissionsForPlatformRole(role: PlatformRole): string[] {
  if (role === "super_admin") return [...PLATFORM_PERMISSIONS];
  return [];
}

export const businessSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  systemType: systemTypeSchema,
  status: businessStatusSchema,
  licenceKey: z.string().nullable(),
  licencePlan: z.string().nullable(),
  licenceExpiresAt: z.string().nullable(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  adminEmail: z.string().nullable().optional(),
  userCount: z.number().int().nonnegative().optional(),
});

export const createBusinessSchema = z.object({
  name: z.string().min(2).max(200),
  systemType: systemTypeSchema,
  adminName: z.string().min(1).max(200),
  adminEmail: z.string().email().max(320),
  adminPassword: z.string().min(8).max(128),
  licenceKey: z.string().min(4).max(128).optional(),
  licencePlan: z.string().min(1).max(64).optional(),
  licenceExpiresAt: z.string().datetime().optional(),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  status: businessStatusSchema.optional(),
  licenceKey: z.string().min(4).max(128).nullable().optional(),
  licencePlan: z.string().min(1).max(64).nullable().optional(),
  licenceExpiresAt: z.string().datetime().nullable().optional(),
});

export const platformUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.string(),
  platformRole: platformRoleSchema.nullable(),
  businessId: z.string().uuid().nullable(),
  businessName: z.string().nullable(),
  systemType: systemTypeSchema.nullable(),
  status: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
});

export const resetPlatformUserPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export const platformSettingsSchema = z.object({
  entries: z.record(z.string(), z.unknown()),
});

export const updatePlatformSettingsSchema = z.object({
  entries: z.record(z.string(), z.unknown()),
});

export const platformAnalyticsSchema = z.object({
  totalBusinesses: z.number().int().nonnegative(),
  activeBusinesses: z.number().int().nonnegative(),
  suspendedBusinesses: z.number().int().nonnegative(),
  inactiveBusinesses: z.number().int().nonnegative(),
  totalUsers: z.number().int().nonnegative(),
  bySystemType: z.array(
    z.object({
      systemType: systemTypeSchema,
      count: z.number().int().nonnegative(),
    }),
  ),
  recentBusinesses: z.array(businessSchema).max(20),
});

export type Business = z.infer<typeof businessSchema>;
export type CreateBusiness = z.infer<typeof createBusinessSchema>;
export type UpdateBusiness = z.infer<typeof updateBusinessSchema>;
export type PlatformUser = z.infer<typeof platformUserSchema>;
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;
export type UpdatePlatformSettings = z.infer<typeof updatePlatformSettingsSchema>;
export type PlatformAnalytics = z.infer<typeof platformAnalyticsSchema>;
