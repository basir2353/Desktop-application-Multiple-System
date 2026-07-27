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

/** Preset subscription plans sold by Super Admin. */
export const LICENCE_PLANS = ["trial_5", "monthly_30", "standard", "demo", "custom"] as const;
export const licencePlanSchema = z.enum(LICENCE_PLANS);
export type LicencePlan = z.infer<typeof licencePlanSchema>;

export const LICENCE_PLAN_LABELS: Record<LicencePlan, string> = {
  trial_5: "5-day trial",
  monthly_30: "Monthly (30 days)",
  standard: "Standard",
  demo: "Demo",
  custom: "Custom",
};

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
  /** null = all modules; otherwise Super Admin ceiling. */
  enabledModules: z.array(z.string()).nullable().optional(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  adminEmail: z.string().nullable().optional(),
  userCount: z.number().int().nonnegative().optional(),
  /** Days remaining until licenceExpiresAt (negative if expired). */
  licenceDaysLeft: z.number().int().optional(),
  licenceExpired: z.boolean().optional(),
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
  enabledModules: z.array(z.string()).nullable().optional(),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  status: businessStatusSchema.optional(),
  licenceKey: z.string().min(4).max(128).nullable().optional(),
  licencePlan: z.string().min(1).max(64).nullable().optional(),
  licenceExpiresAt: z.string().datetime().nullable().optional(),
  enabledModules: z.array(z.string()).nullable().optional(),
});

export const grantLicenceDaysSchema = z.object({
  days: z.union([z.literal(5), z.literal(30), z.number().int().min(1).max(366)]),
  plan: z.string().min(1).max(64).optional(),
  /** If true, also insert a payment row. */
  recordPayment: z.boolean().optional(),
  amount: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).max(8).optional(),
  paidByLabel: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
});

export const licencePaymentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  periodDays: z.number().int(),
  amount: z.number().int(),
  currency: z.string(),
  paidByLabel: z.string().nullable(),
  note: z.string().nullable(),
  paidAt: z.string(),
  recordedBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  businessName: z.string().optional(),
});

export const createLicencePaymentSchema = z.object({
  periodDays: z.number().int().min(1).max(366),
  amount: z.number().int().nonnegative().default(0),
  currency: z.string().min(1).max(8).default("PKR"),
  paidByLabel: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  paidAt: z.string().datetime().optional(),
  /** Also extend licenceExpiresAt by periodDays when true (default true). */
  extendLicence: z.boolean().optional(),
});

export const monthlyLicenceRowSchema = z.object({
  organizationId: z.string().uuid(),
  businessName: z.string(),
  systemType: systemTypeSchema,
  status: businessStatusSchema,
  adminEmail: z.string().nullable(),
  licencePlan: z.string().nullable(),
  licenceExpiresAt: z.string().nullable(),
  licenceDaysLeft: z.number().int().nullable(),
  licenceExpired: z.boolean(),
  paidThisMonth: z.boolean(),
  payment: z
    .object({
      id: z.string().uuid(),
      amount: z.number().int(),
      currency: z.string(),
      periodDays: z.number().int(),
      paidAt: z.string(),
      paidByLabel: z.string().nullable(),
      note: z.string().nullable(),
    })
    .nullable(),
  lastReminderAt: z.string().nullable().optional(),
});

export const monthlyLicenceStatusSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  timezone: z.string(),
  periodLabel: z.string(),
  paidCount: z.number().int().nonnegative(),
  unpaidCount: z.number().int().nonnegative(),
  totalCollected: z.number().int().nonnegative(),
  currency: z.string(),
  paid: z.array(monthlyLicenceRowSchema),
  unpaid: z.array(monthlyLicenceRowSchema),
});

export const sendLicenceRemindersSchema = z.object({
  /** month_end = unpaid this month; due = expiry within 5 days / already expired; all = both */
  mode: z.enum(["month_end", "due", "all"]).default("month_end"),
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
  organizationIds: z.array(z.string().uuid()).optional(),
  /** Skip idempotency and re-send even if already reminded this period. */
  force: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const licenceReminderResultSchema = z.object({
  sent: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  dryRun: z.boolean(),
  results: z.array(
    z.object({
      organizationId: z.string().uuid(),
      businessName: z.string(),
      adminEmail: z.string().nullable(),
      /** sent = in-app admin alert created */
      status: z.enum(["sent", "logged", "skipped", "failed", "dry_run"]),
      reason: z.string().optional(),
    }),
  ),
});

export const orgAlertSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  kind: z.enum(["licence_month_end", "licence_due"]),
  periodKey: z.string(),
  title: z.string(),
  message: z.string(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
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
export type GrantLicenceDays = z.infer<typeof grantLicenceDaysSchema>;
export type LicencePayment = z.infer<typeof licencePaymentSchema>;
export type CreateLicencePayment = z.infer<typeof createLicencePaymentSchema>;
export type MonthlyLicenceRow = z.infer<typeof monthlyLicenceRowSchema>;
export type MonthlyLicenceStatus = z.infer<typeof monthlyLicenceStatusSchema>;
export type SendLicenceReminders = z.infer<typeof sendLicenceRemindersSchema>;
export type LicenceReminderResult = z.infer<typeof licenceReminderResultSchema>;
export type OrgAlert = z.infer<typeof orgAlertSchema>;
export type PlatformUser = z.infer<typeof platformUserSchema>;
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;
export type UpdatePlatformSettings = z.infer<typeof updatePlatformSettingsSchema>;
export type PlatformAnalytics = z.infer<typeof platformAnalyticsSchema>;

/** Clamp membership permissions to Super Admin org module ceiling. */
export function applyOrgModuleCeiling(
  permissions: readonly string[],
  enabledModules: readonly string[] | null | undefined,
): string[] {
  if (enabledModules == null) return [...permissions];
  const allowed = new Set(enabledModules);
  allowed.add("pops.read");
  if (permissions.includes("*")) {
    return [...allowed];
  }
  return permissions.filter((p) => allowed.has(p) || p.startsWith("platform."));
}
