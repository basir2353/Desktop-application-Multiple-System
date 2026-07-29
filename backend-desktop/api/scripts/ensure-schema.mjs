/**
 * Idempotent ALTER TABLE for columns drizzle-kit push sometimes skips on
 * existing Railway databases. Run after `drizzle-kit push`.
 *
 * Uses `pg` from packages/database-pg (always present in the Docker image).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkspaceRoot } from "./resolve-workspace.mjs";

const STATEMENTS = [
  `ALTER TABLE organization_memberships ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true`,
  `ALTER TABLE organization_memberships ADD COLUMN IF NOT EXISTS nav_allowlist jsonb`,
  `ALTER TABLE organization_memberships ADD COLUMN IF NOT EXISTS last_activity_at timestamptz`,
  `ALTER TABLE organization_memberships ADD COLUMN IF NOT EXISTS staff_pin_hash text`,
  `ALTER TABLE pops_cash_movements ADD COLUMN IF NOT EXISTS employee_id uuid`,
  `ALTER TABLE pops_cash_movements ADD COLUMN IF NOT EXISTS party_kind text`,
  `ALTER TABLE pops_cash_movements ADD COLUMN IF NOT EXISTS client_request_id text`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enabled_modules jsonb`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fbr_enabled boolean NOT NULL DEFAULT false`,
  `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pra_enabled boolean NOT NULL DEFAULT false`,
  // General Store: missing columns make /v1/store/dashboard (and seed) return 500.
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS description text`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS subcategory_id uuid`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS variant_of_id uuid`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS barcode text`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS qr_code text`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS image_url text`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS purchase_price_pkr integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS selling_price_pkr integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS tax_pct integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS reorder_level integer NOT NULL DEFAULT 10`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS available_stock integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS damaged_stock integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS expired_stock integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS in_transit_stock integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS track_batch text NOT NULL DEFAULT 'no'`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS track_serial text NOT NULL DEFAULT 'no'`,
  `ALTER TABLE store_products ADD COLUMN IF NOT EXISTS is_weighed text NOT NULL DEFAULT 'no'`,
  `ALTER TABLE store_suppliers ADD COLUMN IF NOT EXISTS opening_balance_pkr integer NOT NULL DEFAULT 0`,
  `ALTER TABLE store_customers ADD COLUMN IF NOT EXISTS membership_tier text NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE store_product_batches ADD COLUMN IF NOT EXISTS lot_number text`,
  `ALTER TABLE store_product_batches ADD COLUMN IF NOT EXISTS manufacturing_date date`,
  `ALTER TABLE store_product_batches ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`,
  `CREATE TABLE IF NOT EXISTS store_product_serials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
    serial_number text NOT NULL,
    batch_id uuid,
    status text NOT NULL DEFAULT 'available',
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS licence_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_days integer NOT NULL,
    amount integer NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'PKR',
    paid_by_label text,
    note text,
    paid_at timestamptz NOT NULL DEFAULT now(),
    recorded_by uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS licence_reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period_key text NOT NULL,
    kind text NOT NULL,
    channel text NOT NULL DEFAULT 'email',
    to_email text,
    success text NOT NULL DEFAULT 'true',
    detail text,
    sent_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS licence_reminders_org_period_kind_uidx
    ON licence_reminders (organization_id, period_key, kind)`,
  `CREATE TABLE IF NOT EXISTS org_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind text NOT NULL,
    period_key text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    dismissed_at timestamptz
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS org_alerts_org_period_kind_uidx
    ON org_alerts (organization_id, period_key, kind)`,
  `CREATE TABLE IF NOT EXISTS platform_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_by uuid,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tax_authority_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES pops_branches(id) ON DELETE CASCADE,
    company_name text NOT NULL DEFAULT '',
    ntn text NOT NULL DEFAULT '',
    strn text NOT NULL DEFAULT '',
    business_type text NOT NULL DEFAULT '',
    province text NOT NULL DEFAULT '',
    branch_name text NOT NULL DEFAULT '',
    branch_code text NOT NULL DEFAULT '',
    fbr_client_id text,
    fbr_client_secret text,
    fbr_pos_id text,
    fbr_terminal_id text,
    fbr_environment text NOT NULL DEFAULT 'sandbox',
    fbr_status text NOT NULL DEFAULT 'disconnected',
    fbr_access_token text,
    fbr_token_expires_at timestamptz,
    fbr_connected_at timestamptz,
    fbr_last_error text,
    pra_registration_number text,
    pra_username text,
    pra_password text,
    pra_branch_code text,
    pra_environment text NOT NULL DEFAULT 'sandbox',
    pra_status text NOT NULL DEFAULT 'disconnected',
    pra_access_token text,
    pra_token_expires_at timestamptz,
    pra_connected_at timestamptz,
    pra_last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tax_authority_profiles_org_branch_uidx
    ON tax_authority_profiles (organization_id, branch_id)`,
  `CREATE TABLE IF NOT EXISTS tax_authority_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES pops_branches(id) ON DELETE CASCADE,
    authority text NOT NULL,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    source_ref text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    taxable_amount_pkr integer NOT NULL DEFAULT 0,
    tax_amount_pkr integer NOT NULL DEFAULT 0,
    request_json text,
    response_json text,
    authority_invoice_number text,
    qr_payload text,
    attempt_count integer NOT NULL DEFAULT 0,
    last_attempt_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tax_authority_invoices_source_uidx
    ON tax_authority_invoices (organization_id, authority, source_type, source_id)`,
];
export function ensureCriticalSchema() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("[ensure-schema] DATABASE_URL missing");
    return false;
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const apiRoot = join(scriptDir, "..");
  const appRoot = resolveWorkspaceRoot(apiRoot);
  const dbPkgRoot = join(appRoot, "packages", "database-pg");

  const runner = `
const { Client } = require("pg");
const statements = ${JSON.stringify(STATEMENTS)};
(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /railway|rlwy\\.app|amazonaws|neon\\.tech/i.test(process.env.DATABASE_URL || "")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();
  for (const sql of statements) {
    try {
      await client.query(sql);
      console.log("[ensure-schema] OK:", sql.slice(0, 80));
    } catch (err) {
      console.warn("[ensure-schema] skip:", err && err.message ? err.message : err);
    }
  }
  await client.end();
})().catch((err) => {
  console.error("[ensure-schema] failed:", err && err.message ? err.message : err);
  process.exit(1);
});
`;

  const result = spawnSync(process.execPath, ["-e", runner], {
    cwd: dbPkgRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    console.error("[ensure-schema] aborted with status", result.status);
    return false;
  }
  console.log("[ensure-schema] critical columns verified.");
  return true;
}
