import { date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { popsBranches } from "./operations";

export const pharmacyMedicines = pgTable("pharmacy_medicines", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  presentation: text("presentation"),
  brandName: text("brand_name"),
  category: text("category").notNull().default("Tablet"),
  manufacturer: text("manufacturer"),
  barcode: text("barcode"),
  purchasePricePkr: integer("purchase_price_pkr").notNull().default(0),
  sellingPricePkr: integer("selling_price_pkr").notNull().default(0),
  taxPct: integer("tax_pct").notNull().default(0),
  reorderLevel: integer("reorder_level").notNull().default(10),
  currentStock: integer("current_stock").notNull().default(0),
  unit: text("unit").notNull().default("Piece"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyMedicineBatches = pgTable("pharmacy_medicine_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  medicineId: uuid("medicine_id")
    .notNull()
    .references(() => pharmacyMedicines.id, { onDelete: "cascade" }),
  batchNumber: text("batch_number").notNull(),
  manufacturingDate: date("manufacturing_date"),
  expiryDate: date("expiry_date").notNull(),
  quantity: integer("quantity").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyPatients = pgTable("pharmacy_patients", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  outstandingPkr: integer("outstanding_pkr").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyDoctors = pgTable("pharmacy_doctors", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  specialization: text("specialization"),
  clinic: text("clinic"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyPrescriptions = pgTable("pharmacy_prescriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  prescriptionNumber: text("prescription_number").notNull(),
  patientId: uuid("patient_id").references(() => pharmacyPatients.id, { onDelete: "set null" }),
  doctorId: uuid("doctor_id").references(() => pharmacyDoctors.id, { onDelete: "set null" }),
  status: text("status").notNull().default("Pending"),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  dispensedAt: timestamp("dispensed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacyPrescriptionItems = pgTable("pharmacy_prescription_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  prescriptionId: uuid("prescription_id")
    .notNull()
    .references(() => pharmacyPrescriptions.id, { onDelete: "cascade" }),
  medicineId: uuid("medicine_id")
    .notNull()
    .references(() => pharmacyMedicines.id, { onDelete: "restrict" }),
  dosage: text("dosage"),
  quantity: integer("quantity").notNull(),
  dispensedQty: integer("dispensed_qty").notNull().default(0),
});

export const pharmacySales = pgTable("pharmacy_sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => popsBranches.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull(),
  patientId: uuid("patient_id").references(() => pharmacyPatients.id, { onDelete: "set null" }),
  paymentMethod: text("payment_method").notNull().default("Cash"),
  subtotalPkr: integer("subtotal_pkr").notNull().default(0),
  taxPkr: integer("tax_pkr").notNull().default(0),
  discountPkr: integer("discount_pkr").notNull().default(0),
  totalPkr: integer("total_pkr").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pharmacySaleLines = pgTable("pharmacy_sale_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => pharmacySales.id, { onDelete: "cascade" }),
  medicineId: uuid("medicine_id")
    .notNull()
    .references(() => pharmacyMedicines.id, { onDelete: "restrict" }),
  qty: integer("qty").notNull(),
  unitPricePkr: integer("unit_price_pkr").notNull(),
  lineTotalPkr: integer("line_total_pkr").notNull(),
});
