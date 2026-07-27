import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A business / client installation.
 * `systemType` permanently binds the tenant to one business system module.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  /** restaurant | pharmacy | general_store | grocery | retail | … */
  systemType: text("system_type").notNull().default("restaurant"),
  /** active | inactive | suspended | deleted */
  status: text("status").notNull().default("active"),
  licenceKey: text("licence_key"),
  /** trial_5 | monthly_30 | standard | demo | custom… */
  licencePlan: text("licence_plan"),
  licenceExpiresAt: timestamp("licence_expires_at", { withTimezone: true }),
  /**
   * Super Admin module ceiling for this business (POPS_MODULE_ACCESS ids).
   * null = all modules allowed; [] = lock down to basic ERP only.
   */
  enabledModules: jsonb("enabled_modules").$type<string[] | null>(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
