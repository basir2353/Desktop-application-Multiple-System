import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** `super_admin` for platform control-plane users; null for tenant users. */
  platformRole: text("platform_role"),
  /** active | inactive | suspended */
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
