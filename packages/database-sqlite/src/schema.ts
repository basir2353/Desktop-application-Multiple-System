import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const installedModules = sqliteTable("installed_modules", {
  slug: text("slug").primaryKey(),
  version: text("version").notNull(),
  remoteEntryUrl: text("remote_entry_url").notNull(),
  manifestJson: text("manifest_json").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  installedAt: text("installed_at").notNull(),
});

export const outbox = sqliteTable("outbox", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: text("next_retry_at"),
  createdAt: text("created_at").notNull(),
});

export const settingsKv = sqliteTable("settings_kv", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const syncCursors = sqliteTable("sync_cursors", {
  scope: text("scope").primaryKey(),
  cursor: text("cursor").notNull(),
  updatedAt: text("updated_at").notNull(),
});
