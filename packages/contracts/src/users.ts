import { z } from "zod";

export const popsRoleSchema = z.enum([
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "accountant",
  "hr",
  "rider",
]);

export const capabilityAccessSchema = z.enum(["allow", "pin", "deny"]);

export const popsCapabilitySchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const roleTemplateSchema = z.object({
  id: popsRoleSchema,
  label: z.string(),
  permissions: z.array(z.string()),
  capabilities: z.record(z.string(), capabilityAccessSchema),
});

export const orgUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: z.string(),
  branchScope: z.string(),
  pinRequired: z.boolean(),
  permissions: z.array(z.string()),
  /** When false, the user cannot sign in. */
  active: z.boolean(),
  /**
   * Allowed ERP nav paths (e.g. `pos`, `inventory/stock`).
   * `null` = all paths allowed by the user's permissions.
   */
  navAllowlist: z.array(z.string()).nullable(),
  lastActivityAt: z.string().nullable(),
});

export const createOrgUserSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(8).max(128),
  role: popsRoleSchema,
  branchScope: z.string().min(1).max(64),
  pinRequired: z.boolean().default(false),
  staffPin: z.string().regex(/^\d{4}$/).optional(),
});

export const updateOrgUserSchema = z.object({
  role: popsRoleSchema.optional(),
  branchScope: z.string().min(1).max(64).optional(),
  pinRequired: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
  staffPin: z.string().regex(/^\d{4}$/).optional(),
  /** Replace membership permissions (module access). */
  permissions: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  /** Pass `null` to clear and allow all permission-gated paths. */
  navAllowlist: z.array(z.string()).nullable().optional(),
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

/** Self-service PIN management — a staff member creating/updating/removing their own PIN. */
export const setOwnPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/).nullable(),
});

export const inviteOrgUserSchema = z.object({
  email: z.string().min(3).max(320),
  role: popsRoleSchema,
  branchScope: z.string().min(1).max(64),
  pinRequired: z.boolean().default(false),
});

export const inviteOrgUserResultSchema = z.object({
  email: z.string(),
  emailSent: z.boolean(),
  inviteUrl: z.string().url(),
  expiresAt: z.string(),
});

export const pendingInviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  role: z.string(),
  branchScope: z.string(),
  pinRequired: z.boolean(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const invitePreviewSchema = z.object({
  email: z.string(),
  role: z.string(),
  branchScope: z.string(),
  organizationName: z.string(),
  expiresAt: z.string(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export const accessControlSchema = z.object({
  capabilities: z.array(popsCapabilitySchema),
  roles: z.array(roleTemplateSchema),
});

export type PopsRole = z.infer<typeof popsRoleSchema>;
export type OrgUser = z.infer<typeof orgUserSchema>;
export type CreateOrgUser = z.infer<typeof createOrgUserSchema>;
export type UpdateOrgUser = z.infer<typeof updateOrgUserSchema>;
export type SetOwnPin = z.infer<typeof setOwnPinSchema>;
export type InviteOrgUser = z.infer<typeof inviteOrgUserSchema>;
export type InviteOrgUserResult = z.infer<typeof inviteOrgUserResultSchema>;
export type PendingInvite = z.infer<typeof pendingInviteSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
export type AcceptInvite = z.infer<typeof acceptInviteSchema>;
export type RoleTemplate = z.infer<typeof roleTemplateSchema>;
export type AccessControl = z.infer<typeof accessControlSchema>;

export const POPS_CAPABILITIES: { id: string; label: string }[] = [
  { id: "pops.pos.void", label: "Void line" },
  { id: "pops.pos.discount", label: "Discount override" },
  { id: "pops.closing.report", label: "Z-report" },
  { id: "pops.kitchen.bump", label: "KOT bump" },
];

const CAP_KEYS = ["pops.pos.void", "pops.pos.discount", "pops.closing.report", "pops.kitchen.bump"] as const;

export const POPS_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "admin",
    label: "Admin",
    permissions: [
      "*",
      "pops.users.manage",
      "pops.menu.manage",
      "pops.inventory.manage",
      "pops.hr.manage",
      "pops.multi_branch.manage",
      "pops.notifications.manage",
      "pops.accounting.manage",
      "pops.read",
      "catalog.read",
      "sync.push",
      "modules.sample.use",
    ],
    capabilities: {
      "pops.pos.void": "allow",
      "pops.pos.discount": "allow",
      "pops.closing.report": "allow",
      "pops.kitchen.bump": "allow",
    },
  },
  {
    id: "manager",
    label: "Manager",
    permissions: [
      "pops.read",
      "pops.menu.manage",
      "pops.inventory.manage",
      "pops.hr.manage",
      "pops.multi_branch.manage",
      "pops.notifications.manage",
      "pops.accounting.manage",
      "pops.pos.void",
      "pops.pos.discount",
      "pops.closing.report",
      "pops.kitchen.bump",
      "catalog.read",
    ],
    capabilities: {
      "pops.pos.void": "pin",
      "pops.pos.discount": "pin",
      "pops.closing.report": "allow",
      "pops.kitchen.bump": "allow",
    },
  },
  {
    id: "cashier",
    label: "Cashier",
    permissions: ["pops.read", "pops.pos.void", "pops.pos.discount", "pops.closing.report"],
    capabilities: {
      "pops.pos.void": "pin",
      "pops.pos.discount": "pin",
      "pops.closing.report": "pin",
      "pops.kitchen.bump": "deny",
    },
  },
  {
    id: "waiter",
    label: "Waiter",
    permissions: ["pops.read", "pops.kitchen.bump"],
    capabilities: {
      "pops.pos.void": "deny",
      "pops.pos.discount": "deny",
      "pops.closing.report": "deny",
      "pops.kitchen.bump": "pin",
    },
  },
  {
    id: "kitchen",
    label: "Kitchen",
    permissions: ["pops.read", "pops.kitchen.bump"],
    capabilities: {
      "pops.pos.void": "deny",
      "pops.pos.discount": "deny",
      "pops.closing.report": "deny",
      "pops.kitchen.bump": "allow",
    },
  },
  {
    id: "accountant",
    label: "Accountant",
    permissions: ["pops.read", "pops.accounting.manage", "pops.closing.report"],
    capabilities: {
      "pops.pos.void": "deny",
      "pops.pos.discount": "deny",
      "pops.closing.report": "allow",
      "pops.kitchen.bump": "deny",
    },
  },
  {
    id: "hr",
    label: "HR",
    permissions: ["pops.read", "pops.hr.manage"],
    capabilities: Object.fromEntries(CAP_KEYS.map((k) => [k, "deny" as const])) as Record<string, "deny">,
  },
  {
    id: "rider",
    label: "Rider",
    permissions: ["pops.read", "pops.delivery.manage"],
    capabilities: Object.fromEntries(CAP_KEYS.map((k) => [k, "deny" as const])) as Record<string, "deny">,
  },
];

export function permissionsForPopsRole(role: string): string[] {
  const template = POPS_ROLE_TEMPLATES.find((r) => r.id === role);
  return template?.permissions ?? ["pops.read"];
}

export function canManageOrgUsers(permissions: readonly string[]): boolean {
  return permissions.includes("*") || permissions.includes("pops.users.manage");
}

/** Module toggles for Head Office access control (maps to JWT permission strings). */
export const POPS_MODULE_ACCESS: { id: string; label: string; description: string }[] = [
  { id: "pops.read", label: "ERP access", description: "Sign in and use basic restaurant modules" },
  { id: "pops.users.manage", label: "Users & access", description: "Create and edit other users" },
  { id: "pops.menu.manage", label: "Menu", description: "Edit menu, categories, and pricing" },
  { id: "pops.inventory.manage", label: "Inventory", description: "Stock, purchases, and adjustments" },
  { id: "pops.accounting.manage", label: "Accounting", description: "Ledgers, expenses, and finance reports" },
  { id: "pops.hr.manage", label: "HR & payroll", description: "Employees, attendance, and payroll" },
  { id: "pops.multi_branch.manage", label: "Multi-branch", description: "Network monitoring, transfers, pricing" },
  { id: "pops.notifications.manage", label: "Notifications", description: "Templates and notification settings" },
  { id: "pops.closing.report", label: "Day closing", description: "Z-report and business day close" },
  { id: "pops.pos.void", label: "POS void", description: "Void lines on the register" },
  { id: "pops.pos.discount", label: "POS discount", description: "Apply discounts on the register" },
  { id: "pops.kitchen.bump", label: "Kitchen / waiter", description: "KOT bump and floor service tools" },
  { id: "pops.delivery.manage", label: "Delivery", description: "Riders and delivery orders" },
];

export function hasModuleAccess(permissions: readonly string[], moduleId: string): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(moduleId);
}

export function toggleModulePermission(
  permissions: readonly string[],
  moduleId: string,
  enabled: boolean,
): string[] {
  const next = new Set(permissions.filter((p) => p !== "*"));
  if (enabled) next.add(moduleId);
  else next.delete(moduleId);
  if (!next.has("pops.read") && enabled) next.add("pops.read");
  return [...next];
}

