import { date, doublePrecision, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { popsBranches } from "./operations";

export const tradeflowCustomers = pgTable("tradeflow_customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  isCash: integer("is_cash").notNull().default(0),
  closingBalancePkr: integer("closing_balance_pkr").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowItems = pgTable("tradeflow_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("Bag"),
  altUnit: text("alt_unit").notNull().default("Amount"),
  altFactor: integer("alt_factor").notNull().default(0),
  defaultRatePkr: integer("default_rate_pkr").notNull().default(0),
  onHandQty: doublePrecision("on_hand_qty").notNull().default(0),
  bookedQty: doublePrecision("booked_qty").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowSalesPersons = pgTable("tradeflow_sales_persons", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowPartyRates = pgTable(
  "tradeflow_party_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => popsBranches.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => tradeflowCustomers.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => tradeflowItems.id, { onDelete: "cascade" }),
    lastRatePkr: integer("last_rate_pkr").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tradeflow_party_rates_org_branch_party_item_uidx").on(t.organizationId, t.branchId, t.customerId, t.itemId)],
);

export const tradeflowBookings = pgTable("tradeflow_bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => tradeflowCustomers.id, { onDelete: "restrict" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => tradeflowItems.id, { onDelete: "restrict" }),
  qtyBooked: doublePrecision("qty_booked").notNull().default(0),
  qtyIssued: doublePrecision("qty_issued").notNull().default(0),
  bookedRatePkr: integer("booked_rate_pkr").notNull().default(0),
  advancePkr: integer("advance_pkr").notNull().default(0),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowInvoices = pgTable("tradeflow_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  invoiceNo: text("invoice_no").notNull(),
  customerId: uuid("customer_id").references(() => tradeflowCustomers.id, { onDelete: "set null" }),
  salesPersonId: uuid("sales_person_id").references(() => tradeflowSalesPersons.id, { onDelete: "set null" }),
  paymentMode: text("payment_mode").notNull().default("cash"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("saved"),
  subtotalPkr: integer("subtotal_pkr").notNull().default(0),
  discountPkr: integer("discount_pkr").notNull().default(0),
  expensePkr: integer("expense_pkr").notNull().default(0),
  totalPkr: integer("total_pkr").notNull().default(0),
  receivedPkr: integer("received_pkr").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowInvoiceLines = pgTable("tradeflow_invoice_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => tradeflowInvoices.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => tradeflowItems.id, { onDelete: "restrict" }),
  bookingId: uuid("booking_id").references(() => tradeflowBookings.id, { onDelete: "set null" }),
  qty: doublePrecision("qty").notNull().default(0),
  bookingQty: doublePrecision("booking_qty").notNull().default(0),
  ratePkr: integer("rate_pkr").notNull().default(0),
  lastRatePkr: integer("last_rate_pkr").notNull().default(0),
  discountType: text("discount_type").notNull().default("none"),
  discountValue: doublePrecision("discount_value").notNull().default(0),
  discountPkr: integer("discount_pkr").notNull().default(0),
  lineTotalPkr: integer("line_total_pkr").notNull().default(0),
  unitKind: text("unit_kind").notNull().default("primary"),
});

export const tradeflowInvoiceExpenses = pgTable("tradeflow_invoice_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => tradeflowInvoices.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountPkr: integer("amount_pkr").notNull().default(0),
});

export const tradeflowInvoiceAttachments = pgTable("tradeflow_invoice_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => tradeflowInvoices.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  dataUrl: text("data_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowSuppliers = pgTable("tradeflow_suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  closingBalancePkr: integer("closing_balance_pkr").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowAccounts = pgTable("tradeflow_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("cash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowSettings = pgTable("tradeflow_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  whatsappTaxMessage: text("whatsapp_tax_message")
    .notNull()
    .default("Thank you. Tax invoice is attached. Please pay on due date."),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowPayments = pgTable("tradeflow_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  partyType: text("party_type").notNull(),
  partyId: uuid("party_id").notNull(),
  kind: text("kind").notNull().default("receive"),
  amountPkr: integer("amount_pkr").notNull().default(0),
  ref: text("ref"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowExpenses = pgTable("tradeflow_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountPkr: integer("amount_pkr").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowPurchases = pgTable("tradeflow_purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  invoiceNo: text("invoice_no").notNull(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => tradeflowSuppliers.id, { onDelete: "restrict" }),
  totalPkr: integer("total_pkr").notNull().default(0),
  paidPkr: integer("paid_pkr").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowPurchaseLines = pgTable("tradeflow_purchase_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseId: uuid("purchase_id")
    .notNull()
    .references(() => tradeflowPurchases.id, { onDelete: "cascade" }),
  itemId: uuid("item_id")
    .notNull()
    .references(() => tradeflowItems.id, { onDelete: "restrict" }),
  qty: doublePrecision("qty").notNull().default(0),
  ratePkr: integer("rate_pkr").notNull().default(0),
  unitKind: text("unit_kind").notNull().default("primary"),
  lineTotalPkr: integer("line_total_pkr").notNull().default(0),
});

export const tradeflowReturns = pgTable("tradeflow_returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  partyType: text("party_type").notNull(),
  partyId: uuid("party_id").notNull(),
  itemId: uuid("item_id").references(() => tradeflowItems.id, { onDelete: "set null" }),
  qty: doublePrecision("qty").notNull().default(0),
  amountPkr: integer("amount_pkr").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowNotes = pgTable("tradeflow_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  partyType: text("party_type").notNull(),
  partyId: uuid("party_id").notNull(),
  amountPkr: integer("amount_pkr").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowJournalEntries = pgTable("tradeflow_journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  entryNo: text("entry_no").notNull(),
  debitAccountId: uuid("debit_account_id")
    .notNull()
    .references(() => tradeflowAccounts.id, { onDelete: "restrict" }),
  creditAccountId: uuid("credit_account_id")
    .notNull()
    .references(() => tradeflowAccounts.id, { onDelete: "restrict" }),
  amountPkr: integer("amount_pkr").notNull().default(0),
  narration: text("narration"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tradeflowContraEntries = pgTable("tradeflow_contra_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  entryNo: text("entry_no").notNull(),
  fromAccountId: uuid("from_account_id")
    .notNull()
    .references(() => tradeflowAccounts.id, { onDelete: "restrict" }),
  toAccountId: uuid("to_account_id")
    .notNull()
    .references(() => tradeflowAccounts.id, { onDelete: "restrict" }),
  amountPkr: integer("amount_pkr").notNull().default(0),
  narration: text("narration"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
