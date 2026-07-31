import pg from "pg";
import https from "https";

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
  `select u.email
   from users u
   join organization_members m on m.user_id = u.id
   where m.organization_id = $1
   order by u.created_at
   limit 10`,
  [orgId],
).catch(async () => {
  // Fallback schemas
  return c.query(
    `select email from users limit 0`,
  );
});
console.log("users", users.rows);

const p = await c.query(
  `select pra_status, pra_environment, pra_registration_number, pra_access_token
   from tax_authority_profiles where organization_id = $1`,
  [orgId],
);
const profile = p.rows[0];
console.log("profile", {
  status: profile.pra_status,
  env: profile.pra_environment,
  pos: profile.pra_registration_number,
  tokenPrefix: String(profile.pra_access_token || "").slice(0, 8),
});

const bill = await c.query(
  `select bill_ref, subtotal_pkr, discount_pkr, tax_pkr, service_pkr, total_pkr
   from pops_bills where id = $1`,
  [billId],
);
console.log("bill", bill.rows[0]);

let lines = [];
for (const table of ["pops_bill_lines", "pops_order_lines"]) {
  try {
    const r = await c.query(`select * from ${table} where bill_id = $1 limit 20`, [billId]);
    if (r.rows.length) {
      lines = r.rows;
      console.log("lines from", table, r.rows.length);
      break;
    }
  } catch {
    /* try next */
  }
}

const b = bill.rows[0];
const taxable = Math.max(0, Number(b.subtotal_pkr || 0) - Number(b.discount_pkr || 0));
const tax = Number(b.tax_pkr || 0);
const total = Number(b.total_pkr || taxable + tax);
const token = profile.pra_access_token;
const posId = Number(profile.pra_registration_number);

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const dt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

const items =
  lines.length > 0
    ? lines.map((ln, i) => {
        const qty = Math.max(1, Number(ln.qty ?? ln.quantity ?? 1));
        const amount = Number(ln.line_total_pkr ?? ln.amount_pkr ?? ln.total_pkr ?? 0);
        const name = String(ln.label ?? ln.name ?? ln.item_name ?? `Item ${i + 1}`);
        return {
          ItemCode: String(i + 1),
          ItemName: name.slice(0, 100),
          Quantity: qty,
          PCTCode: "98012000",
          TaxRate: 15,
          SaleValue: Math.round(amount),
          TotalAmount: Math.round(amount),
          TaxCharged: 0,
          Discount: 0,
          FurtherTax: 0,
          InvoiceType: 1,
          RefUSIN: null,
        };
      })
    : [
        {
          ItemCode: "1",
          ItemName: "Sale",
          Quantity: 1,
          PCTCode: "98012000",
          TaxRate: 15,
          SaleValue: Math.round(taxable),
          TotalAmount: Math.round(total),
          TaxCharged: Math.round(tax),
          Discount: 0,
          FurtherTax: 0,
          InvoiceType: 1,
          RefUSIN: null,
        },
      ];

const payload = {
  POSID: posId,
  USIN: b.bill_ref,
  DateTime: dt,
  BuyerPNTN: "",
  BuyerCNIC: "",
  BuyerName: "Walk-in",
  BuyerPhoneNumber: "",
  TotalBillAmount: Math.round(total),
  TotalQuantity: items.reduce((s, it) => s + Number(it.Quantity), 0),
  TotalSaleValue: Math.round(taxable),
  TotalTaxCharged: Math.round(tax),
  Discount: Math.round(Number(b.discount_pkr || 0)),
  FurtherTax: 0,
  PaymentMode: 1,
  RefUSIN: null,
  InvoiceType: 1,
  Items: items,
};

console.log("posting", JSON.stringify({ POSID: payload.POSID, USIN: payload.USIN, Total: payload.TotalBillAmount }));

const praRes = await new Promise((resolve, reject) => {
  const body = JSON.stringify(payload);
  const req = https.request(
    {
      hostname: "ims.pral.com.pk",
      path: "/ims/production/api/Live/PostData",
      method: "POST",
      family: 4,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ status: res.statusCode, json: JSON.parse(text) });
        } catch {
          resolve({ status: res.statusCode, json: { message: text } });
        }
      });
    },
  );
  req.on("error", reject);
  req.write(body);
  req.end();
});

console.log("PRA", praRes.status, praRes.json);
const invoiceNumber = praRes.json?.InvoiceNumber;
if (!invoiceNumber || invoiceNumber === "Not Available") {
  console.error("PRA did not return invoice number");
  await c.end();
  process.exit(1);
}

const invoiceId = `FISC-${Date.now()}`;
const nowIso = new Date().toISOString();
await c.query(
  `update tax_authority_invoices
   set status = 'verified',
       authority_invoice_number = $2,
       qr_payload = $2,
       last_error = null,
       response_json = $3,
       invoice_mode = 'real',
       updated_at = now()
   where id = $1`,
  [
    invId,
    invoiceNumber,
    JSON.stringify({
      ...praRes.json,
      invoiceId,
      invoiceNumber,
      issuedAt: nowIso,
    }),
  ],
);

await c.query(
  `update pops_bills
   set pra_mode = 'real',
       pra_invoice_number = $2,
       pra_invoice_id = $3,
       pra_qr_payload = $2,
       pra_issued_at = now()
   where id = $1`,
  [billId, invoiceNumber, invoiceId],
);

await c.query(
  `update tax_authority_profiles
   set pra_last_invoice_sent_at = now(), pra_last_error = null, updated_at = now()
   where organization_id = $1`,
  [orgId],
);

// Dedupe activity: keep one submitted row
await c.query(
  `delete from tax_authority_activity_logs
   where organization_id = $1 and invoice_number = $2`,
  [orgId, b.bill_ref],
);
await c.query(
  `insert into tax_authority_activity_logs
    (organization_id, authority, event, invoice_number, pra_invoice_number, status, error_message, retry_count)
   values ($1, 'pra', 'submit_invoice', $2, $3, 'submitted', null, 0)`,
  [orgId, b.bill_ref, invoiceNumber],
);

console.log("SAVED fiscal", invoiceNumber, "on", b.bill_ref);
await c.end();
