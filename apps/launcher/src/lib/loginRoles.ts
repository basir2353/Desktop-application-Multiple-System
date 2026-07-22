import { POPS_ROLE_TEMPLATES, type PopsRole } from "@platform/contracts";
import type { BusinessSystemId } from "./businessSystems";

export type LoginRoleOption = {
  id: PopsRole;
  label: string;
  description: string;
  /** Suggested demo email for local seeds (optional). */
  demoEmail?: string;
};

const POPS_ROLES: readonly PopsRole[] = [
  "admin",
  "manager",
  "cashier",
  "waiter",
  "kitchen",
  "accountant",
  "hr",
  "rider",
];

function isPopsRole(value: string | undefined | null): value is PopsRole {
  return Boolean(value && (POPS_ROLES as readonly string[]).includes(value));
}

const STAFF_DESCRIPTIONS: Record<Exclude<PopsRole, "admin">, string> = {
  manager: "Branch operations, inventory, and floor oversight",
  cashier: "POS checkout, payments, and cash drawer",
  waiter: "Table service and kitchen tickets",
  kitchen: "Pending orders / KOT display",
  accountant: "Accounting, ledgers, and closing reports",
  hr: "Employees, attendance, and payroll",
  rider: "Delivery orders and rider mobile access",
};

const DEMO_EMAIL: Partial<Record<PopsRole, string>> = {
  admin: "admin@platform.local",
  manager: "manager1@platform.local",
  cashier: "cashier1@platform.local",
  waiter: "waiter1@platform.local",
  kitchen: "kitchen1@platform.local",
  accountant: "accountant1@platform.local",
  hr: "hr1@platform.local",
  rider: "rider1@platform.local",
};

function restaurantStaff(): LoginRoleOption[] {
  const byId = Object.fromEntries(POPS_ROLE_TEMPLATES.map((r) => [r.id, r.label])) as Record<
    PopsRole,
    string
  >;
  return (["manager", "cashier", "waiter", "kitchen", "accountant", "hr", "rider"] as const).map(
    (id) => ({
      id,
      label: id === "kitchen" ? "Pending orders" : (byId[id] ?? id),
      description: STAFF_DESCRIPTIONS[id],
      demoEmail: DEMO_EMAIL[id],
    }),
  );
}

export function loginRolesForSystem(systemId: BusinessSystemId): {
  admin: LoginRoleOption;
  staff: LoginRoleOption[];
} {
  if (systemId === "pharmacy") {
    return {
      admin: {
        id: "admin",
        label: "Admin",
        description: "Full pharmacy control, users, and inventory",
        demoEmail: DEMO_EMAIL.admin,
      },
      staff: [
        {
          id: "manager",
          label: "Manager",
          description: STAFF_DESCRIPTIONS.manager,
          demoEmail: DEMO_EMAIL.manager,
        },
        {
          id: "cashier",
          label: "Cashier",
          description: STAFF_DESCRIPTIONS.cashier,
          demoEmail: DEMO_EMAIL.cashier,
        },
        {
          id: "accountant",
          label: "Pharmacist",
          description: "Dispensing and clinical pharmacy workflows",
          demoEmail: DEMO_EMAIL.accountant,
        },
        {
          id: "hr",
          label: "Inventory manager",
          description: "Stock, purchases, and expiry",
          demoEmail: DEMO_EMAIL.hr,
        },
      ],
    };
  }

  if (systemId === "general-store") {
    return {
      admin: {
        id: "admin",
        label: "Super admin",
        description: "Full store control and user management",
        demoEmail: DEMO_EMAIL.admin,
      },
      staff: [
        {
          id: "manager",
          label: "Inventory manager",
          description: STAFF_DESCRIPTIONS.manager,
          demoEmail: DEMO_EMAIL.manager,
        },
        {
          id: "cashier",
          label: "Staff",
          description: STAFF_DESCRIPTIONS.cashier,
          demoEmail: DEMO_EMAIL.cashier,
        },
        {
          id: "accountant",
          label: "Accountant",
          description: STAFF_DESCRIPTIONS.accountant,
          demoEmail: DEMO_EMAIL.accountant,
        },
        {
          id: "hr",
          label: "Warehouse manager",
          description: STAFF_DESCRIPTIONS.hr,
          demoEmail: DEMO_EMAIL.hr,
        },
      ],
    };
  }

  return {
    admin: {
      id: "admin",
      label: "Admin",
      description: "Head office, users & access, and full ERP control",
      demoEmail: DEMO_EMAIL.admin,
    },
    staff: restaurantStaff(),
  };
}

/** Normalize JWT membership role for comparison with the selected login role. */
export function normalizeMembershipRole(role: string | undefined | null): PopsRole | null {
  if (!role) return null;
  if (role === "owner") return "admin";
  if (isPopsRole(role)) return role;
  return null;
}

export function membershipMatchesLoginRole(
  membershipRole: string | undefined | null,
  selectedRole: PopsRole,
): boolean {
  return normalizeMembershipRole(membershipRole) === selectedRole;
}

export function loginPathForRole(role: PopsRole): string {
  return `/login?role=${encodeURIComponent(role)}`;
}

export function roleSelectPath(systemId: BusinessSystemId): string {
  return `/role?system=${encodeURIComponent(systemId)}`;
}

export function parseLoginRoleParam(value: string | null): PopsRole | null {
  if (!value) return null;
  return isPopsRole(value) ? value : null;
}
