import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { popsBranches } from "./operations";

export const popsMenuCategories = pgTable("pops_menu_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Public URL path served by the API, e.g. /uploads/menu/... */
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const popsMenuItems = pgTable("pops_menu_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => popsMenuCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Public URL path served by the API, e.g. /uploads/menu/... */
  imageUrl: text("image_url"),
  /** Serving size: full, half, plate, etc. */
  portion: text("portion"),
  pricePkr: integer("price_pkr").notNull(),
  barcode: text("barcode"),
  happyHour: boolean("happy_hour").notNull().default(false),
  /** Highlight on POS and admin menu as a featured dish. */
  featured: boolean("featured").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Size / portion options for a dish, e.g. Full, Half, Quarter. */
export const popsMenuItemVariants = pgTable("pops_menu_item_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => popsMenuItems.id, { onDelete: "cascade" }),
  /** User-defined label, e.g. Full, Half, Quarter, Single */
  label: text("label").notNull(),
  pricePkr: integer("price_pkr").notNull(),
  barcode: text("barcode"),
  happyHour: boolean("happy_hour").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
