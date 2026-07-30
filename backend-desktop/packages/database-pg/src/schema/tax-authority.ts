import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { popsBranches } from "./operations";

/**
 * Per-branch FBR / PRA connection profile (company info + credentials + tokens).
 * One row per organization + branch.
 */
export const taxAuthorityProfiles = pgTable(
  "tax_authority_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => popsBranches.id, { onDelete: "cascade" }),

    companyName: text("company_name").notNull().default(""),
    ntn: text("ntn").notNull().default(""),
    strn: text("strn").notNull().default(""),
    businessType: text("business_type").notNull().default(""),
    province: text("province").notNull().default(""),
    branchName: text("branch_name").notNull().default(""),
    branchCode: text("branch_code").notNull().default(""),

    fbrClientId: text("fbr_client_id"),
    fbrClientSecret: text("fbr_client_secret"),
    fbrPosId: text("fbr_pos_id"),
    fbrTerminalId: text("fbr_terminal_id"),
    fbrEnvironment: text("fbr_environment").notNull().default("sandbox"),
    fbrStatus: text("fbr_status").notNull().default("disconnected"),
    fbrAccessToken: text("fbr_access_token"),
    fbrTokenExpiresAt: timestamp("fbr_token_expires_at", { withTimezone: true }),
    fbrConnectedAt: timestamp("fbr_connected_at", { withTimezone: true }),
    fbrLastError: text("fbr_last_error"),

    praRegistrationNumber: text("pra_registration_number"),
    praUsername: text("pra_username"),
    praPassword: text("pra_password"),
    praBranchCode: text("pra_branch_code"),
    praEnvironment: text("pra_environment").notNull().default("sandbox"),
    praStatus: text("pra_status").notNull().default("disconnected"),
    praAccessToken: text("pra_access_token"),
    praTokenExpiresAt: timestamp("pra_token_expires_at", { withTimezone: true }),
    praConnectedAt: timestamp("pra_connected_at", { withTimezone: true }),
    praLastError: text("pra_last_error"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tax_authority_profiles_org_branch_uidx").on(t.organizationId, t.branchId)],
);

/** Outbox of invoices submitted (or queued) to FBR / PRA. */
export const taxAuthorityInvoices = pgTable(
  "tax_authority_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => popsBranches.id, { onDelete: "cascade" }),
    authority: text("authority").notNull(),
    /** fake | real — distinguishes Fake PRA slips from live e-IMS submits. */
    invoiceMode: text("invoice_mode").notNull().default("real"),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceRef: text("source_ref").notNull(),
    status: text("status").notNull().default("queued"),
    taxableAmountPkr: integer("taxable_amount_pkr").notNull().default(0),
    taxAmountPkr: integer("tax_amount_pkr").notNull().default(0),
    requestJson: text("request_json"),
    responseJson: text("response_json"),
    authorityInvoiceNumber: text("authority_invoice_number"),
    qrPayload: text("qr_payload"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tax_authority_invoices_source_uidx").on(
      t.organizationId,
      t.authority,
      t.invoiceMode,
      t.sourceType,
      t.sourceId,
    ),
  ],
);
