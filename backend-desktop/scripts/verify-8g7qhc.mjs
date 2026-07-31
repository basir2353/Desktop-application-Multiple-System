import pg from "pg";
const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const b = await c.query(
  `select bill_ref, pra_invoice_number, pra_qr_payload, pra_mode from pops_bills where bill_ref = $1`,
  ["BILL-8G7QHC"],
);
const i = await c.query(
  `select status, authority_invoice_number, last_error from tax_authority_invoices where source_ref = $1`,
  ["BILL-8G7QHC"],
);
const p = await c.query(
  `select pra_environment, pra_status, pra_last_error from tax_authority_profiles where organization_id = $1`,
  ["132f818f-2908-426f-9e76-3166fdc2524b"],
);
console.log(JSON.stringify({ bill: b.rows[0], inv: i.rows[0], profile: p.rows[0] }, null, 2));
await c.end();
