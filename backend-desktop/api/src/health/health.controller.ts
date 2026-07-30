import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { PlatformPgDb } from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";

@Controller("health")
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: PlatformPgDb) {}

  @Get()
  getHealth(): { status: string; ts: string } {
    return { status: "ok", ts: new Date().toISOString() };
  }

  /** DB readiness — helps diagnose Railway login 500s after deploy. */
  @Get("db")
  async getDbHealth(): Promise<{
    status: "ok" | "degraded";
    checks: Record<string, boolean | number | string>;
  }> {
    const checks: Record<string, boolean | number | string> = {};

    try {
      await this.db.execute(sql`select 1`);
      checks.connected = true;
    } catch (err) {
      checks.connected = false;
      checks.error = err instanceof Error ? err.message : String(err);
      return { status: "degraded", checks };
    }

    const tables = ["users", "organization_memberships", "refresh_tokens", "pops_security_events"] as const;
    for (const table of tables) {
      try {
        const rows = await this.db.execute(
          sql.raw(`select to_regclass('public.${table}') as present`),
        );
        const present = (rows.rows[0] as { present?: string | null } | undefined)?.present;
        checks[`table_${table}`] = Boolean(present);
      } catch {
        checks[`table_${table}`] = false;
      }
    }

    try {
      const users = await this.db.execute(sql`select count(*)::int as count from users`);
      checks.userCount = Number((users.rows[0] as { count?: number } | undefined)?.count ?? 0);
    } catch (err) {
      checks.userCount = -1;
      checks.userCountError = err instanceof Error ? err.message : String(err);
    }

    // Column probes — missing columns cause login 500 when selecting full membership rows.
    for (const col of ["active", "nav_allowlist", "last_activity_at", "staff_pin_hash"] as const) {
      try {
        const rows = await this.db.execute(
          sql.raw(
            `select 1 from information_schema.columns where table_schema='public' and table_name='organization_memberships' and column_name='${col}' limit 1`,
          ),
        );
        checks[`col_memberships_${col}`] = (rows.rows?.length ?? 0) > 0;
      } catch {
        checks[`col_memberships_${col}`] = false;
      }
    }

    try {
      await this.db.execute(
        sql`select organization_id, role, permissions, branch_scope from organization_memberships limit 1`,
      );
      checks.membershipCoreSelect = true;
    } catch (err) {
      checks.membershipCoreSelect = false;
      checks.membershipCoreError = err instanceof Error ? err.message : String(err);
    }

    try {
      await this.db.execute(
        sql`select organization_id, role, permissions, branch_scope, active, nav_allowlist from organization_memberships limit 1`,
      );
      checks.membershipFullSelect = true;
    } catch (err) {
      checks.membershipFullSelect = false;
      checks.membershipFullError = err instanceof Error ? err.message : String(err);
    }

    // General Store: patch missing columns that cause dashboard Internal server error.
    const storeAlters = [
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
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS promotion_discount_pkr integer NOT NULL DEFAULT 0`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS loyalty_points_earned integer NOT NULL DEFAULT 0`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS loyalty_points_redeemed integer NOT NULL DEFAULT 0`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS amount_paid_pkr integer NOT NULL DEFAULT 0`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS amount_due_pkr integer NOT NULL DEFAULT 0`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS payments_json text`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS shift_id uuid`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS terminal_id text`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS held_label text`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS held_cart_json text`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS coupon_code text`,
      `ALTER TABLE store_sales ADD COLUMN IF NOT EXISTS gift_card_number text`,
      `ALTER TABLE store_sale_lines ADD COLUMN IF NOT EXISTS display_name text`,
      `ALTER TABLE store_sale_lines ADD COLUMN IF NOT EXISTS is_weighed text NOT NULL DEFAULT 'no'`,
      `ALTER TABLE store_sale_lines ADD COLUMN IF NOT EXISTS batch_id uuid`,
    ];
    let storePatched = 0;
    for (const statement of storeAlters) {
      try {
        await this.db.execute(sql.raw(statement));
        storePatched += 1;
      } catch {
        // table may not exist yet — drizzle push / ensure-schema handles creation
      }
    }
    checks.storeSchemaPatched = storePatched;

    try {
      await this.db.execute(
        sql`select id, reserved_stock, track_serial, is_weighed from store_products limit 1`,
      );
      checks.storeProductsSelect = true;
    } catch (err) {
      checks.storeProductsSelect = false;
      checks.storeProductsError = err instanceof Error ? err.message : String(err);
    }

    const ready =
      checks.connected === true &&
      checks.table_users === true &&
      checks.table_organization_memberships === true;

    return { status: ready ? "ok" : "degraded", checks };
  }
}
