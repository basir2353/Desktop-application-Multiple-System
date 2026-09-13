import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { Client } = require("pg");

// Force acela — do not use process.env (shell may still have local DATABASE_URL)
const url =
  "postgresql://postgres:bqqNHmsvmdbnZQkuZCKEDGMHEFHwpQMy@acela.proxy.rlwy.net:41130/railway";

console.log("CONNECTING", url.replace(/:[^:@]+@/, ":***@"));

const client = new Client({
  connectionString: url,
  connectionTimeoutMillis: 20000,
});

try {
  await client.connect();
  const r = await client.query(
    "select 1 as ok, current_database() as db, inet_server_addr()::text as addr, now() as ts",
  );
  console.log("DB_OK", JSON.stringify(r.rows[0]));
  try {
    const u = await client.query(
      "select count(*)::int as users from users",
    );
    console.log("USERS", u.rows[0].users);
    const sa = await client.query(
      "select email, platform_role, status from users where lower(email)=lower($1)",
      ["superadmin@pops.platform"],
    );
    console.log("SUPERADMIN", JSON.stringify(sa.rows[0] ?? null));
  } catch (e) {
    console.log("SCHEMA", e.message);
  }
  await client.end();
} catch (e) {
  console.error("DB_FAIL", e.message);
  process.exit(1);
}
