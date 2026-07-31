import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const orgId = "132f818f-2908-426f-9e76-3166fdc2524b";
const billId = "e1d2eeae-4cbb-46f7-8221-5fb39a8e1b54";
const invId = "1c707615-c3d9-4db9-a48f-18ce5063d9a3";

await c.query(
  `update tax_authority_profiles
   set pra_environment = 'production',
       pra_status = 'connected',
       pra_last_error = null,
       updated_at = now()
   where organization_id = $1`,
  [orgId],
);
await c.query(
  `update organizations
   set pra_real_enabled = true, pra_fake_enabled = false, pra_enabled = true
   where id = $1`,
  [orgId],
);

const users = await c.query(
  `select email, role from users where organization_id = $1 order by created_at limit 10`,
  [orgId],
);
console.log("users", users.rows);

const p = await c.query(
  `select pra_status, pra_environment, pra_registration_number, pra_access_token is not null as has_token
   from tax_authority_profiles where organization_id = $1`,
  [orgId],
);
console.log("profile", p.rows);

// Load bill amounts for PostData
const bill = await c.query(
  `select bill_ref, subtotal_pkr, discount_pkr, tax_pkr, service_pkr, total_pkr
   from pops_bills where id = $1`,
  [billId],
);
console.log("bill", bill.rows[0]);

const lines = await c.query(
  `select label, qty, unit_price_pkr, line_total_pkr
   from pops_bill_lines where bill_id = $1`,
  [billId],
).catch(() => ({ rows: [] }));
console.log("lines", lines.rows);

await c.end();
