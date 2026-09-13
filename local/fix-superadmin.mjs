import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const url =
  process.argv[2] ||
  "postgresql://postgres:bqqNHmsvmdbnZQkuZCKEDGMHEFHwpQMy@acela.proxy.rlwy.net:41130/railway";
const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@pops.platform";
const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123";

const client = new Client({ connectionString: url, connectionTimeoutMillis: 20000 });
await client.connect();
const hash = await bcrypt.hash(password, 10);
const updated = await client.query(
  `UPDATE users
   SET password_hash = $1,
       platform_role = 'super_admin',
       status = 'active'
   WHERE lower(email) = lower($2)
   RETURNING email, platform_role, status`,
  [hash, email],
);
if (!updated.rowCount) {
  await client.query(
    `INSERT INTO users (id, email, name, password_hash, platform_role, status, created_at)
     VALUES (gen_random_uuid(), $2, 'Super Admin', $1, 'super_admin', 'active', NOW())`,
    [hash, email],
  );
  console.log("INSERTED", email);
} else {
  console.log("UPDATED", updated.rows[0]);
}
await client.end();
