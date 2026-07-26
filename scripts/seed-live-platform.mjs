/**
 * Idempotent live seed for Railway Postgres:
 * - migrates users/organizations columns
 * - unique platform super admins
 * - one demo business per SYSTEM_TYPE + HQ branch + owner
 * - upgrades restaurant staff names + PINs
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/seed-live-platform.mjs
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

const require = createRequire(join(tmpdir(), "seed-live-update", "package.json"));
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const SEED_PASSWORD = process.env.SEED_USER_PASSWORD ?? "Owner@12345";
const SUPER_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123";

const ADMIN_PERMS = [
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
];

const SUPER_ADMINS = [
  {
    email: process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@pops.platform",
    name: "Platform Super Admin",
  },
  {
    email: process.env.SEED_SUPER_ADMIN_EMAIL_2 ?? "owner@pops.platform",
    name: "Platform Owner",
  },
  { email: "superadmin@platform.local", name: "Super Admin (legacy)" },
];

const BUSINESSES = [
  {
    systemType: "restaurant",
    name: "POPS Demo Restaurant",
    adminEmail: process.env.SEED_USER_EMAIL ?? "admin.restaurant@pops.demo",
    adminName: "Restaurant Owner",
    branchCode: "REST-HQ",
    branchName: "Restaurant HQ",
    city: "Islamabad",
    legacyAdminEmail: "admin@platform.local",
  },
  {
    systemType: "pharmacy",
    name: "POPS Demo Pharmacy",
    adminEmail: "admin.pharmacy@pops.demo",
    adminName: "Pharmacy Owner",
    branchCode: "PHAR-HQ",
    branchName: "Pharmacy HQ",
    city: "Lahore",
  },
  {
    systemType: "general_store",
    name: "POPS Demo General Store",
    adminEmail: "admin.store@pops.demo",
    adminName: "Store Owner",
    branchCode: "STORE-HQ",
    branchName: "Store HQ",
    city: "Karachi",
  },
  {
    systemType: "grocery",
    name: "POPS Demo Grocery",
    adminEmail: "admin.grocery@pops.demo",
    adminName: "Grocery Owner",
    branchCode: "GROC-HQ",
    branchName: "Grocery HQ",
    city: "Islamabad",
  },
  {
    systemType: "retail",
    name: "POPS Demo Retail",
    adminEmail: "admin.retail@pops.demo",
    adminName: "Retail Owner",
    branchCode: "RETL-HQ",
    branchName: "Retail HQ",
    city: "Multan",
  },
];

const STAFF = [
  { email: "cashier1@platform.local", name: "Ayesha Cashier", role: "cashier", pin: "2222", branch: "ISB-GT" },
  { email: "manager1@platform.local", name: "Hassan Manager", role: "manager", pin: "3333", branch: "ISB-GT" },
  { email: "accountant1@platform.local", name: "Sara Accountant", role: "accountant", pin: null, branch: "ISB-GT" },
  { email: "kitchen1@platform.local", name: "Bilal Kitchen", role: "kitchen", pin: "4444", branch: "ISB-GT" },
  { email: "waiter1@platform.local", name: "Omar Waiter", role: "waiter", pin: "1111", branch: "ISB-GT" },
  { email: "waiter2@platform.local", name: "Zara Waiter", role: "waiter", pin: "5555", branch: "ISB-GT" },
  { email: "rider1@platform.local", name: "Ali Rider", role: "rider", pin: "6666", branch: "ISB-GT" },
  { email: "hr1@platform.local", name: "Nadia HR", role: "hr", pin: null, branch: "ISB-GT" },
];

const ROLE_PERMS = {
  cashier: ["pops.read", "pops.pos.void", "pops.pos.discount", "pops.closing.report"],
  manager: [
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
  accountant: ["pops.read", "pops.accounting.manage", "pops.closing.report"],
  kitchen: ["pops.read", "pops.kitchen.bump"],
  waiter: ["pops.read", "pops.kitchen.bump"],
  rider: ["pops.read", "pops.delivery.manage"],
  hr: ["pops.read", "pops.hr.manage"],
};

const isLocal =
  /localhost|127\.0\.0\.1/i.test(DATABASE_URL) || process.env.SEED_SSL === "0";
const client = new Client({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
await client.connect();

async function ensureColumns() {
  await client.query(`
    alter table users
      add column if not exists name text,
      add column if not exists platform_role text,
      add column if not exists status text not null default 'active'
  `);
  await client.query(`
    alter table organizations
      add column if not exists system_type text not null default 'restaurant',
      add column if not exists status text not null default 'active',
      add column if not exists licence_key text,
      add column if not exists licence_plan text,
      add column if not exists licence_expires_at timestamptz,
      add column if not exists created_by uuid,
      add column if not exists updated_at timestamptz not null default now()
  `);
  console.log("OK schema migrate (users + organizations)");
}

async function upsertSuperAdmin(email, name, passwordHash) {
  const normalized = email.trim().toLowerCase();
  const existing = await client.query(`select id from users where email = $1`, [normalized]);
  if (existing.rowCount === 0) {
    await client.query(
      `insert into users (email, name, password_hash, platform_role, status)
       values ($1, $2, $3, 'super_admin', 'active')`,
      [normalized, name, passwordHash],
    );
    console.log("CREATED super_admin", normalized);
  } else {
    await client.query(
      `update users
       set name = $1, password_hash = $2, platform_role = 'super_admin', status = 'active'
       where email = $3`,
      [name, passwordHash, normalized],
    );
    console.log("UPDATED super_admin", normalized);
  }
}

async function ensureOwner(orgId, email, name, passwordHash) {
  const normalized = email.trim().toLowerCase();
  let userId;
  const existing = await client.query(`select id from users where email = $1`, [normalized]);
  if (existing.rowCount === 0) {
    const created = await client.query(
      `insert into users (email, name, password_hash, status)
       values ($1, $2, $3, 'active') returning id`,
      [normalized, name, passwordHash],
    );
    userId = created.rows[0].id;
    console.log("CREATED owner", normalized);
  } else {
    userId = existing.rows[0].id;
    await client.query(
      `update users set name = $1, password_hash = $2, status = 'active', platform_role = null where id = $3`,
      [name, passwordHash, userId],
    );
    console.log("UPDATED owner", normalized);
  }

  const mem = await client.query(
    `select 1 from organization_memberships where organization_id = $1 and user_id = $2`,
    [orgId, userId],
  );
  if (mem.rowCount === 0) {
    await client.query(
      `insert into organization_memberships
        (organization_id, user_id, role, permissions, branch_scope, pin_required, active, last_activity_at)
       values ($1, $2, 'owner', $3::jsonb, 'all', false, true, now())`,
      [orgId, userId, JSON.stringify(ADMIN_PERMS)],
    );
  } else {
    await client.query(
      `update organization_memberships
       set role = 'owner', permissions = $3::jsonb, branch_scope = 'all', active = true
       where organization_id = $1 and user_id = $2`,
      [orgId, userId, JSON.stringify(ADMIN_PERMS)],
    );
  }

  await client.query(`update organizations set created_by = $1, updated_at = now() where id = $2`, [
    userId,
    orgId,
  ]);
  return userId;
}

async function ensureBusiness(biz, passwordHash) {
  // Prefer existing org of this system type; otherwise first orphan/legacy org for restaurant.
  let orgId;
  const byType = await client.query(
    `select id from organizations where system_type = $1 and status = 'active' order by created_at asc limit 1`,
    [biz.systemType],
  );
  if (byType.rowCount > 0) {
    orgId = byType.rows[0].id;
    await client.query(
      `update organizations
       set name = $1, status = 'active', licence_plan = 'demo',
           licence_key = coalesce(licence_key, $2), updated_at = now()
       where id = $3`,
      [biz.name, `LIC-DEMO-${biz.systemType.toUpperCase()}`, orgId],
    );
    console.log("UPDATED org", biz.systemType, biz.name);
  } else if (biz.systemType === "restaurant") {
    const legacy = await client.query(`select id from organizations order by created_at asc limit 1`);
    if (legacy.rowCount > 0) {
      orgId = legacy.rows[0].id;
      await client.query(
        `update organizations
         set name = $1, system_type = 'restaurant', status = 'active', licence_plan = 'demo',
             licence_key = coalesce(licence_key, $2), updated_at = now()
         where id = $3`,
        [biz.name, "LIC-DEMO-RESTAURANT", orgId],
      );
      console.log("UPGRADED legacy org → restaurant", biz.name);
    }
  }

  if (!orgId) {
    const created = await client.query(
      `insert into organizations (name, system_type, status, licence_plan, licence_key)
       values ($1, $2, 'active', 'demo', $3) returning id`,
      [biz.name, biz.systemType, `LIC-DEMO-${biz.systemType.toUpperCase()}-${randomBytes(3).toString("hex")}`],
    );
    orgId = created.rows[0].id;
    console.log("CREATED org", biz.systemType, biz.name);
  }

  await ensureOwner(orgId, biz.adminEmail, biz.adminName, passwordHash);
  if (biz.legacyAdminEmail) {
    await ensureOwner(orgId, biz.legacyAdminEmail, "Restaurant Admin", passwordHash);
  }

  const branch = await client.query(
    `select id from pops_branches where organization_id = $1 and code = $2`,
    [orgId, biz.branchCode],
  );
  if (branch.rowCount === 0) {
    await client.query(
      `insert into pops_branches (organization_id, code, name, city) values ($1, $2, $3, $4)`,
      [orgId, biz.branchCode, biz.branchName, biz.city],
    );
    console.log("CREATED branch", biz.branchCode);
  }

  return orgId;
}

async function ensureStaff(restaurantOrgId, passwordHash) {
  for (const s of STAFF) {
    const existing = await client.query(`select id from users where email = $1`, [s.email]);
    let userId;
    if (existing.rowCount === 0) {
      const created = await client.query(
        `insert into users (email, name, password_hash, status) values ($1, $2, $3, 'active') returning id`,
        [s.email, s.name, passwordHash],
      );
      userId = created.rows[0].id;
      console.log("CREATED staff", s.email);
    } else {
      userId = existing.rows[0].id;
      await client.query(`update users set name = $1, password_hash = $2, status = 'active' where id = $3`, [
        s.name,
        passwordHash,
        userId,
      ]);
      console.log("UPDATED staff", s.email);
    }

    const perms = ROLE_PERMS[s.role] ?? ["pops.read"];
    const pinHash = s.pin ? await bcrypt.hash(s.pin, 10) : null;
    const mem = await client.query(
      `select 1 from organization_memberships where organization_id = $1 and user_id = $2`,
      [restaurantOrgId, userId],
    );
    if (mem.rowCount === 0) {
      await client.query(
        `insert into organization_memberships
          (organization_id, user_id, role, permissions, branch_scope, pin_required, staff_pin_hash, active, last_activity_at)
         values ($1, $2, $3, $4::jsonb, $5, $6, $7, true, now())`,
        [restaurantOrgId, userId, s.role, JSON.stringify(perms), s.branch, Boolean(s.pin), pinHash],
      );
    } else {
      await client.query(
        `update organization_memberships
         set role = $3, permissions = $4::jsonb, branch_scope = $5,
             pin_required = $6, staff_pin_hash = coalesce($7, staff_pin_hash), active = true
         where organization_id = $1 and user_id = $2`,
        [restaurantOrgId, userId, s.role, JSON.stringify(perms), s.branch, Boolean(s.pin), pinHash],
      );
    }
  }
}

async function ensureSampleModule() {
  const mod = await client.query(`select id from modules where slug = 'sample'`);
  if (mod.rowCount === 0) {
    const created = await client.query(
      `insert into modules (slug, display_name, description, publisher)
       values ('sample', 'Sample Module', 'Reference microfrontend remote for the launcher host.', 'platform')
       returning id`,
    );
    await client.query(
      `insert into module_versions (module_id, semver, artifact_url, digest_sha256)
       values ($1, '0.1.0', 'http://127.0.0.1:5001/assets/remoteEntry.js', $2)`,
      [created.rows[0].id, "0".repeat(64)],
    );
    console.log("CREATED sample module");
  }
}

try {
  await ensureColumns();
  const superHash = await bcrypt.hash(SUPER_PASSWORD, 12);
  const seedHash = await bcrypt.hash(SEED_PASSWORD, 12);

  for (const sa of SUPER_ADMINS) {
    await upsertSuperAdmin(sa.email, sa.name, superHash);
  }

  let restaurantOrgId;
  for (const biz of BUSINESSES) {
    const orgId = await ensureBusiness(biz, seedHash);
    if (biz.systemType === "restaurant") restaurantOrgId = orgId;
  }

  if (restaurantOrgId) {
    await ensureStaff(restaurantOrgId, seedHash);
  }
  await ensureSampleModule();

  console.log("\n========== LIVE SEED COMPLETE ==========");
  console.log("Super Admin password:", SUPER_PASSWORD);
  console.log("Business / staff password:", SEED_PASSWORD);
  console.log("\nPlatform Super Admins:");
  for (const sa of SUPER_ADMINS) console.log(`  ${sa.email}`);
  console.log("\nBusiness owners:");
  for (const b of BUSINESSES) console.log(`  [${b.systemType}] ${b.adminEmail}`);
  console.log("  [restaurant legacy] admin@platform.local");
  console.log("\nRestaurant staff PINs: waiter1=1111 cashier1=2222 manager1=3333 kitchen1=4444 waiter2=5555 rider1=6666");

  const summary = await client.query(`
    select o.system_type, o.name, o.status, count(om.user_id)::int as users
    from organizations o
    left join organization_memberships om on om.organization_id = o.id
    group by o.id
    order by o.system_type, o.name
  `);
  console.log("\nOrgs:");
  for (const row of summary.rows) console.log(row);
} finally {
  await client.end();
}
