import type { Business } from "@platform/contracts";
import { POPS_MODULE_ACCESS } from "@platform/contracts";

export type ModuleTemplateId = "full" | "pos" | "pos_inventory" | "accounting";

export const MODULE_TEMPLATES: {
  id: ModuleTemplateId;
  label: string;
  description: string;
  /** null = allow all modules */
  modules: string[] | null;
}[] = [
  {
    id: "full",
    label: "Full",
    description: "Every module unlocked",
    modules: null,
  },
  {
    id: "pos",
    label: "POS only",
    description: "ERP, menu, POS discount/void, kitchen, closing",
    modules: [
      "pops.read",
      "pops.menu.create",
      "pops.menu.manage",
      "pops.pos.discount",
      "pops.pos.void",
      "pops.kitchen.bump",
      "pops.closing.report",
      "pops.users.manage",
    ],
  },
  {
    id: "pos_inventory",
    label: "POS + Inventory",
    description: "POS pack plus stock and purchases",
    modules: [
      "pops.read",
      "pops.menu.create",
      "pops.menu.manage",
      "pops.pos.discount",
      "pops.pos.void",
      "pops.kitchen.bump",
      "pops.closing.report",
      "pops.inventory.manage",
      "pops.users.manage",
      "pops.delivery.manage",
    ],
  },
  {
    id: "accounting",
    label: "Accounting pack",
    description: "POS + inventory + accounting + HR",
    modules: [
      "pops.read",
      "pops.menu.create",
      "pops.menu.manage",
      "pops.pos.discount",
      "pops.pos.void",
      "pops.kitchen.bump",
      "pops.closing.report",
      "pops.inventory.manage",
      "pops.accounting.manage",
      "pops.hr.manage",
      "pops.users.manage",
      "pops.multi_branch.manage",
      "pops.notifications.manage",
      "pops.delivery.manage",
    ],
  },
];

export function allModuleIds(): string[] {
  return POPS_MODULE_ACCESS.map((m) => m.id);
}

export function businessNotesKey(businessId: string): string {
  return `business_notes_${businessId}`;
}

/** Resolve FPRA/Real PRA section flags from Business (Super Admin = Allowed). Both may be on. */
export function resolvePraFlags(b: {
  praEnabled?: boolean | null;
  praFakeEnabled?: boolean | null;
  praRealEnabled?: boolean | null;
}): { praFakeEnabled: boolean; praRealEnabled: boolean; praEnabled: boolean } {
  let praFakeEnabled = Boolean(b.praFakeEnabled);
  let praRealEnabled = Boolean(b.praRealEnabled);
  if (Boolean(b.praEnabled) && !praFakeEnabled && !praRealEnabled) {
    praRealEnabled = true;
  }
  return {
    praFakeEnabled,
    praRealEnabled,
    praEnabled: praFakeEnabled || praRealEnabled,
  };
}

export function exportBusinessesCsv(businesses: Business[]): void {
  const header = [
    "name",
    "systemType",
    "status",
    "licencePlan",
    "licenceExpiresAt",
    "fbrEnabled",
    "praEnabled",
    "praFakeEnabled",
    "praRealEnabled",
    "modules",
    "adminEmail",
    "id",
  ];
  const rows = businesses.map((b) => {
    const pra = resolvePraFlags(b);
    return [
      csvEscape(b.name),
      b.systemType,
      b.status,
      b.licencePlan ?? "",
      b.licenceExpiresAt ?? "",
      String(Boolean(b.fbrEnabled)),
      String(pra.praEnabled),
      String(pra.praFakeEnabled),
      String(pra.praRealEnabled),
      b.enabledModules == null ? "ALL" : String(b.enabledModules.length),
      b.adminEmail ?? "",
      b.id,
    ];
  });
  const body = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pops-businesses-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const SUPER_ADMIN_PAGE_TITLES: Record<string, string> = {
  "/super-admin": "Overview",
  "/super-admin/businesses": "Businesses",
  "/super-admin/users": "Users",
  "/super-admin/licences": "Licences & modules",
  "/super-admin/tax": "FBR / FPRA / Real PRA",
  "/super-admin/payments": "Payments",
  "/super-admin/health": "Health & API",
  "/super-admin/security": "Security",
  "/super-admin/broadcast": "Broadcast",
  "/super-admin/settings": "Global settings",
};

export function pageTitleForPath(pathname: string): string {
  if (pathname.startsWith("/super-admin/businesses/")) return "Business detail";
  return SUPER_ADMIN_PAGE_TITLES[pathname] ?? "Super Admin";
}
