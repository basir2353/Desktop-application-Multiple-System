import { sql } from "drizzle-orm";
import type { PlatformPgDb } from "@platform/database-pg";

/**
 * Org-scoped transactional tables wiped on company reset.
 * Master data kept: users, branches, menu, recipes, suppliers, employees,
 * chart of accounts, tax profiles, printers, product/medicine catalogs.
 */
/** Only tables that have organization_id. Child rows cascade from these parents. */
const ORG_DELETE_TABLES: readonly string[] = [
  "store_cash_movements",
  "store_sale_returns",
  "store_sales",
  "store_purchase_returns",
  "store_grn",
  "store_purchase_orders",
  "store_purchase_requisitions",
  "store_stock_transfers",
  "store_stock_adjustments",
  "store_stock_audits",
  "store_inventory_transactions",
  "store_shifts",
  "store_coupons",
  "store_gift_cards",

  "pharmacy_sales",
  "pharmacy_prescriptions",
  "pharmacy_khata_entries",
  "pharmacy_controlled_drug_logs",
  "pharmacy_shifts",
  "pharmacy_refill_reminders",

  "pops_vendor_payments",
  "pops_vendor_bills",
  "pops_customer_payments",
  "pops_customer_invoices",
  "pops_cash_movements",
  "pops_cash_sessions",
  "pops_bank_transactions",
  "pops_expenses",
  "pops_payroll_runs",
  "pops_accounting_audit_logs",
  "pops_journal_entries",

  "pops_goods_receipts",
  "pops_purchase_orders",
  "pops_stock_batches",
  "pops_stock_adjustments",
  "pops_waste_records",
  "pops_stock_counts",
  "pops_production_batches",
  "pops_inventory_audit_logs",
  "pops_branch_transfers",

  "pops_attendance",
  "pops_leave_requests",
  "pops_staff_food",
  "pops_employee_advances",

  "pops_bills",
  "pops_sales",
  "pops_daily_sales",
  "pops_active_orders",
  "pops_kitchen_tickets",
  "pops_kitchen_line_cancellations",
  "pops_alerts",
  "pops_security_events",
  "pops_notification_log",
  "pops_day_close_records",

  "tax_authority_invoices",
  "tax_authority_activity_logs",

  "print_jobs_cloud",
  "print_alerts",

  "org_alerts",
];

async function deleteByOrg(
  db: PlatformPgDb,
  table: string,
  organizationId: string,
): Promise<number> {
  try {
    const result = await db.execute(
      sql`DELETE FROM ${sql.raw(table)} WHERE organization_id = ${organizationId}`,
    );
    return Number(result.rowCount ?? 0);
  } catch {
    // Table may not exist on older DBs / other system types.
    return 0;
  }
}

async function execOptional(db: PlatformPgDb, query: ReturnType<typeof sql>): Promise<number> {
  try {
    const result = await db.execute(query);
    return Number(result.rowCount ?? 0);
  } catch {
    return 0;
  }
}

export async function wipeBusinessTransactions(
  db: PlatformPgDb,
  organizationId: string,
): Promise<{ deletedRows: number; wipedTables: string[] }> {
  let deletedRows = 0;
  const wipedTables: string[] = [];

  // Journal lines have no organization_id — clear via entries first.
  deletedRows += await execOptional(
    db,
    sql`DELETE FROM pops_journal_lines WHERE entry_id IN (
      SELECT id FROM pops_journal_entries WHERE organization_id = ${organizationId}
    )`,
  );

  // Store / pharmacy batch & serial stock (no org column).
  deletedRows += await execOptional(
    db,
    sql`DELETE FROM store_product_batches WHERE product_id IN (
      SELECT id FROM store_products WHERE organization_id = ${organizationId}
    )`,
  );
  deletedRows += await execOptional(
    db,
    sql`DELETE FROM store_product_serials WHERE product_id IN (
      SELECT id FROM store_products WHERE organization_id = ${organizationId}
    )`,
  );
  deletedRows += await execOptional(
    db,
    sql`DELETE FROM pharmacy_medicine_batches WHERE medicine_id IN (
      SELECT id FROM pharmacy_medicines WHERE organization_id = ${organizationId}
    )`,
  );

  // Payroll lines may remain if cascade missing on some DBs.
  deletedRows += await execOptional(
    db,
    sql`DELETE FROM pops_payroll_lines WHERE payroll_run_id IN (
      SELECT id FROM pops_payroll_runs WHERE organization_id = ${organizationId}
    )`,
  );

  for (const table of ORG_DELETE_TABLES) {
    const n = await deleteByOrg(db, table, organizationId);
    if (n > 0) {
      deletedRows += n;
      wipedTables.push(table);
    }
  }

  // Zero balances / on-hand stock (catalog kept).
  deletedRows += await execOptional(
    db,
    sql`UPDATE pops_bank_accounts SET balance_pkr = 0 WHERE organization_id = ${organizationId}`,
  );
  deletedRows += await execOptional(
    db,
    sql`UPDATE pops_ingredients SET current_stock = 0 WHERE organization_id = ${organizationId}`,
  );
  deletedRows += await execOptional(
    db,
    sql`UPDATE pops_inventory_items SET qty = 0 WHERE organization_id = ${organizationId}`,
  );
  deletedRows += await execOptional(
    db,
    sql`UPDATE pops_suppliers SET opening_balance_pkr = 0 WHERE organization_id = ${organizationId}`,
  );
  deletedRows += await execOptional(
    db,
    sql`UPDATE store_products SET
      available_stock = 0,
      reserved_stock = 0,
      damaged_stock = 0,
      expired_stock = 0,
      in_transit_stock = 0
    WHERE organization_id = ${organizationId}`,
  );
  deletedRows += await execOptional(
    db,
    sql`UPDATE pharmacy_medicines SET current_stock = 0 WHERE organization_id = ${organizationId}`,
  );
  deletedRows += await execOptional(
    db,
    sql`UPDATE pops_branch_closing_state SET
      orders_paused = false,
      orders_paused_at = NULL,
      orders_paused_by = NULL,
      last_z_report_at = NULL,
      last_z_report_ref = NULL,
      last_z_report_json = NULL,
      last_backup_at = NULL,
      last_backup_ref = NULL,
      last_day_closed_at = NULL,
      last_day_closed_by = NULL,
      updated_at = NOW()
    WHERE organization_id = ${organizationId}`,
  );

  // FPRA invoice sequence back to start for a clean books reopen.
  deletedRows += await execOptional(
    db,
    sql`UPDATE organizations SET pra_fake_invoice_seq = 0, updated_at = NOW()
      WHERE id = ${organizationId}`,
  );

  return { deletedRows, wipedTables };
}
