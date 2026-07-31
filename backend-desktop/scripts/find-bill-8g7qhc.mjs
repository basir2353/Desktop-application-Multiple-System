import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: /railway|rlwy\.app|proxy\.rlwy/i.test(process.env.DATABASE_URL || "")
    ? { rejectUnauthorized: false }
    : undefined,
});

await c.connect();

const bill = await c.query(
  `select b.id, b.bill_ref, b.organization_id, b.branch_id, b.pra_invoice_number, b.pra_mode,
          o.name as org_name
   from pops_bills b
   join organizations o on o.id = b.organization_id
   where b.bill_ref = $1`,
  ["BILL-8G7QHC"],
);
console.log("bills", JSON.stringify(bill.rows, null, 2));

const inv = await c.query(
  `select i.id, i.source_ref, i.status, i.last_error, i.attempt_count, i.authority_invoice_number,
          i.organization_id, o.name as org_name
   from tax_authority_invoices i
   join organizations o on o.id = i.organization_id
   where i.source_ref = $1`,
  ["BILL-8G7QHC"],
);
console.log("invoices", JSON.stringify(inv.rows, null, 2));

const profiles = await c.query(
  `select p.organization_id, o.name, p.pra_status, p.pra_environment, p.pra_registration_number,
          left(coalesce(p.pra_access_token,''), 8) as token_prefix,
          p.pra_last_error, b.code as branch_code
   from tax_authority_profiles p
   join organizations o on o.id = p.organization_id
   left join pops_branches b on b.id = p.branch_id
   where p.pra_status is not null
   order by p.updated_at desc nulls last
   limit 15`,
);
console.log("pra profiles", JSON.stringify(profiles.rows, null, 2));

await c.end();
