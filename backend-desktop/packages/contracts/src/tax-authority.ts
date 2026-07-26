import { z } from "zod";

export const taxEnvironmentSchema = z.enum(["sandbox", "production"]);
export type TaxEnvironment = z.infer<typeof taxEnvironmentSchema>;

export const taxConnectionStatusSchema = z.enum([
  "disconnected",
  "connected",
  "error",
  "expired",
]);
export type TaxConnectionStatus = z.infer<typeof taxConnectionStatusSchema>;

export const taxAuthoritySchema = z.enum(["fbr", "pra"]);
export type TaxAuthority = z.infer<typeof taxAuthoritySchema>;

export const taxInvoiceSourceTypeSchema = z.enum(["bill", "store_sale", "pharmacy_sale"]);
export type TaxInvoiceSourceType = z.infer<typeof taxInvoiceSourceTypeSchema>;

export const taxInvoiceStatusSchema = z.enum([
  "queued",
  "submitting",
  "submitted",
  "verified",
  "failed",
]);
export type TaxInvoiceStatus = z.infer<typeof taxInvoiceStatusSchema>;

const ntnSchema = z
  .string()
  .trim()
  .regex(/^\d{7}(-\d)?$|^\d{13}$/, "NTN must be 7 digits (optional -check) or 13-digit CNIC");

const strnSchema = z
  .string()
  .trim()
  .min(1, "STRN is required")
  .max(32);

export const taxCompanyInfoSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  ntn: ntnSchema,
  strn: strnSchema,
  businessType: z.string().trim().min(1, "Business type is required").max(100),
  province: z.string().trim().min(1, "Province is required").max(100),
  branchName: z.string().trim().min(1, "Branch name is required").max(200),
  branchCode: z.string().trim().min(1, "Branch code is required").max(64),
});

export const fbrConnectSchema = z.object({
  branchCode: z.string().trim().min(1),
  company: taxCompanyInfoSchema,
  clientId: z.string().trim().max(200).optional().default(""),
  clientSecret: z.string().trim().min(1, "Client secret / security token is required").max(2000),
  posId: z.string().trim().min(1, "POS ID is required").max(100),
  terminalId: z.string().trim().min(1, "Terminal ID is required").max(100),
  environment: taxEnvironmentSchema.default("sandbox"),
});
export type FbrConnectInput = z.infer<typeof fbrConnectSchema>;

export const praConnectSchema = z.object({
  branchCode: z.string().trim().min(1),
  company: taxCompanyInfoSchema,
  registrationNumber: z.string().trim().min(1, "Registration number is required").max(100),
  username: z.string().trim().max(200).optional().default(""),
  password: z.string().trim().min(1, "Password / API key is required").max(2000),
  praBranchCode: z.string().trim().min(1, "PRA branch code is required").max(64),
  environment: taxEnvironmentSchema.default("sandbox"),
});
export type PraConnectInput = z.infer<typeof praConnectSchema>;

export const taxAuthorityStatusSchema = z.object({
  branchCode: z.string(),
  company: z.object({
    companyName: z.string().default(""),
    ntn: z.string().default(""),
    strn: z.string().default(""),
    businessType: z.string().default(""),
    province: z.string().default(""),
    branchName: z.string().default(""),
    branchCode: z.string().default(""),
  }),
  fbr: z.object({
    status: taxConnectionStatusSchema,
    environment: taxEnvironmentSchema,
    clientId: z.string().nullable(),
    clientSecretMasked: z.string().nullable(),
    posId: z.string().nullable(),
    terminalId: z.string().nullable(),
    connectedAt: z.string().nullable(),
    tokenExpiresAt: z.string().nullable(),
    lastError: z.string().nullable(),
  }),
  pra: z.object({
    status: taxConnectionStatusSchema,
    environment: taxEnvironmentSchema,
    registrationNumber: z.string().nullable(),
    username: z.string().nullable(),
    passwordMasked: z.string().nullable(),
    praBranchCode: z.string().nullable(),
    connectedAt: z.string().nullable(),
    tokenExpiresAt: z.string().nullable(),
    lastError: z.string().nullable(),
  }),
});
export type TaxAuthorityStatus = z.infer<typeof taxAuthorityStatusSchema>;

export const taxConnectResultSchema = z.object({
  authority: taxAuthoritySchema,
  status: taxConnectionStatusSchema,
  connectedAt: z.string(),
  tokenExpiresAt: z.string().nullable(),
  message: z.string(),
});
export type TaxConnectResult = z.infer<typeof taxConnectResultSchema>;

export const taxInvoiceSchema = z.object({
  id: z.string().uuid(),
  authority: taxAuthoritySchema,
  sourceType: taxInvoiceSourceTypeSchema,
  sourceRef: z.string(),
  status: taxInvoiceStatusSchema,
  taxableAmountPkr: z.number().int(),
  taxAmountPkr: z.number().int(),
  authorityInvoiceNumber: z.string().nullable(),
  qrPayload: z.string().nullable(),
  lastError: z.string().nullable(),
  attemptCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaxInvoice = z.infer<typeof taxInvoiceSchema>;

export const sendTaxInvoiceSchema = z.object({
  branchCode: z.string().trim().min(1),
  sourceType: taxInvoiceSourceTypeSchema,
  sourceId: z.string().uuid(),
  /** When true, force re-submit even if a prior attempt exists. */
  force: z.boolean().optional().default(false),
});
export type SendTaxInvoiceInput = z.infer<typeof sendTaxInvoiceSchema>;

export const sendTaxInvoiceResultSchema = z.object({
  invoice: taxInvoiceSchema,
  message: z.string(),
});
export type SendTaxInvoiceResult = z.infer<typeof sendTaxInvoiceResultSchema>;
