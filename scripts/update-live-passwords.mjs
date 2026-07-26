/**
 * Reset all seeded live users to clear documented passwords.
 * DATABASE_URL required.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";

const require = createRequire(join(tmpdir(), "seed-live-update", "package.json"));
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

// Clear, documented passwords (same for all seeded accounts unless noted).
const SUPER_PASSWORD = "SuperAdmin@123";
const OWNER_PASSWORD = "Owner@12345";
const STAFF_PASSWORD = "Staff@12345";

const SUPER_ADMINS = [
  "superadmin@pops.platform",
  "owner@pops.platform",
  "superadmin@platform.local",
];

const OWNERS = [
  "admin.restaurant@pops.demo",
  "admin.pharmacy@pops.demo",
  "admin.store@pops.demo",
  "admin.grocery@pops.demo",
  "admin.retail@pops.demo",
  "admin@platform.local",
];

const STAFF = [
  "cashier1@platform.local",
  "manager1@platform.local",
  "accountant1@platform.local",
  "kitchen1@platform.local",
  "waiter1@platform.local",
  "waiter2@platform.local",
  "rider1@platform.local",
  "hr1@platform.local",
];

const STAFF_PINS = {
  "waiter1@platform.local": "1111",
  "cashier1@platform.local": "2222",
  "manager1@platform.local": "3333",
  "kitchen1@platform.local": "4444",
  "waiter2@platform.local": "5555",
  "rider1@platform.local": "6666",
};

const isLocal =
  /localhost|127\.0\.0\.1/i.test(DATABASE_URL) || process.env.SEED_SSL === "0";
const client = new Client({
  connectionString: DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});
await client.connect();

async function setPassword(email, password) {
  const hash = await bcrypt.hash(password, 12);
  const res = await client.query(
    `update users set password_hash = $1, status = 'active' where email = $2`,
    [hash, email],
  );
  console.log(res.rowCount ? `OK password ${email}` : `MISSING ${email}`);
}

async function setPin(email, pin) {
  const pinHash = await bcrypt.hash(pin, 10);
  const user = await client.query(`select id from users where email = $1`, [email]);
  if (user.rowCount === 0) return;
  await client.query(
    `update organization_memberships
     set staff_pin_hash = $1, pin_required = true
     where user_id = $2`,
    [pinHash, user.rows[0].id],
  );
  console.log(`OK pin ${email} = ${pin}`);
}

try {
  for (const email of SUPER_ADMINS) await setPassword(email, SUPER_PASSWORD);
  for (const email of OWNERS) await setPassword(email, OWNER_PASSWORD);
  for (const email of STAFF) await setPassword(email, STAFF_PASSWORD);
  for (const [email, pin] of Object.entries(STAFF_PINS)) await setPin(email, pin);

  console.log("\n========== PASSWORDS ==========");
  console.log("Super Admin :", SUPER_PASSWORD);
  console.log("Business Owner :", OWNER_PASSWORD);
  console.log("Staff :", STAFF_PASSWORD);
  console.log("PINs: waiter1=1111 cashier1=2222 manager1=3333 kitchen1=4444 waiter2=5555 rider1=6666");
} finally {
  await client.end();
}
