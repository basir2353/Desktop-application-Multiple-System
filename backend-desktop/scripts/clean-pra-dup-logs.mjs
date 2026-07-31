import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: /railway|rlwy\.app/i.test(process.env.DATABASE_URL || "")
    ? { rejectUnauthorized: false }
    : undefined,
});

await c.connect();
const bill = "BILL-816NLQ";

const logs = await c.query(
  `select id, status, error_message, retry_count, created_at
   from tax_authority_activity_logs
   where invoice_number = $1
   order by created_at desc`,
  [bill],
);
console.log("logs before", logs.rows.length, JSON.stringify(logs.rows, null, 2));

if (logs.rows.length > 1) {
  const keep = logs.rows[0].id;
  const del = await c.query(
    `delete from tax_authority_activity_logs where invoice_number = $1 and id <> $2`,
    [bill, keep],
  );
  await c.query(
    `update tax_authority_activity_logs
     set status = 'pending', error_message = null, retry_count = 0
     where id = $1`,
    [keep],
  );
  console.log("kept", keep, "deleted", del.rowCount);
} else if (logs.rows.length === 1) {
  await c.query(
    `update tax_authority_activity_logs
     set status = 'pending', error_message = null, retry_count = 0
     where id = $1`,
    [logs.rows[0].id],
  );
}

const inv = await c.query(
  `select id, status, last_error, attempt_count, source_ref
   from tax_authority_invoices
   where source_ref = $1 and authority = 'pra'`,
  [bill],
);
console.log("invoices", JSON.stringify(inv.rows, null, 2));
for (const row of inv.rows) {
  if (["queued", "failed", "submitting"].includes(row.status)) {
    await c.query(
      `update tax_authority_invoices set status = 'pending', last_error = null where id = $1`,
      [row.id],
    );
    console.log("invoice reset", row.id);
  }
}

const dups = await c.query(`
  with ranked as (
    select id,
      row_number() over (
        partition by organization_id, invoice_number
        order by created_at desc
      ) rn
    from tax_authority_activity_logs
    where invoice_number is not null and invoice_number <> ''
  )
  delete from tax_authority_activity_logs t
  using ranked r
  where t.id = r.id and r.rn > 1
  returning t.invoice_number
`);
console.log("deleted other dups", dups.rowCount);

const after = await c.query(
  `select id, status, error_message, retry_count from tax_authority_activity_logs where invoice_number = $1`,
  [bill],
);
console.log("logs after", after.rows);

await c.end();
