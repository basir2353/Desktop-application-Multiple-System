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
  lastActivityAt: z.string().nullable(),
});

export const createOrgUserSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(8).max(128),
  role: popsRoleSchema,
  branchScope: z.string().min(1).max(64),
  pinRequired: z.boolean().default(false),
});

export const updateOrgUserSchema = z.object({
  role: popsRoleSchema.optional(),
  branchScope: z.string().min(1).max(64).optional(),
  pinRequired: z.boolean().optional(),
  password: z.string().min(8).max(128).optional(),
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8).max(128),
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
    permissions: ["pops.read"],
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
