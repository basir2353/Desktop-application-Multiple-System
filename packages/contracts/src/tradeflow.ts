import { z } from "zod";

export const tradeflowPaymentModeSchema = z.enum(["cash", "credit"]);
export const tradeflowDiscountTypeSchema = z.enum(["none", "percent", "amount"]);
export const tradeflowBookingStatusSchema = z.enum(["open", "partial", "completed", "cancelled"]);
export const tradeflowInvoiceStatusSchema = z.enum(["saved", "partial", "paid"]);
export const tradeflowPrintSizeSchema = z.enum(["a4", "a5", "thermal"]);
export const tradeflowUnitKindSchema = z.enum(["primary", "alt"]);
export const tradeflowPartyTypeSchema = z.enum(["customer", "supplier"]);
export const tradeflowPaymentKindSchema = z.enum(["receive", "pay", "advance"]);
export const tradeflowReturnKindSchema = z.enum(["sales", "purchase"]);
export const tradeflowNoteKindSchema = z.enum(["credit", "debit"]);
export const tradeflowLedgerFilterSchema = z.enum(["all", "item", "payments", "sales", "returns", "bookings"]);
export const tradeflowWhatsappKindSchema = z.enum(["invoice", "reminder", "purchase"]);

export const tradeflowCustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  isCash: z.boolean(),
  closingBalancePkr: z.number(),
});

export const tradeflowSupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  closingBalancePkr: z.number(),
});

export const tradeflowItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  unit: z.string(),
  altUnit: z.string(),
  altFactor: z.number(),
  defaultRatePkr: z.number(),
  onHandQty: z.number(),
  onHandAlt: z.number(),
  bookedQty: z.number(),
  bookedAlt: z.number(),
  freeQty: z.number(),
  freeAlt: z.number(),
  lastRatePkr: z.number().nullable(),
  openBookingId: z.string().uuid().nullable(),
  openBookingRemaining: z.number(),
  openBookingRemainingValuePkr: z.number(),
  openBookingRatePkr: z.number().nullable(),
});

export const tradeflowSalesPersonSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  isActive: z.boolean(),
});

export const tradeflowAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: z.string(),
});

export const tradeflowBookingSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  unit: z.string(),
  qtyBooked: z.number(),
  qtyIssued: z.number(),
  qtyRemaining: z.number(),
  bookedRatePkr: z.number(),
  advancePkr: z.number(),
  bookedValuePkr: z.number(),
  deliveredValuePkr: z.number(),
  remainingValuePkr: z.number(),
  status: tradeflowBookingStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const tradeflowInvoiceLineSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  unit: z.string(),
  unitKind: tradeflowUnitKindSchema,
  bookingId: z.string().uuid().nullable(),
  qty: z.number(),
  bookingQty: z.number(),
  bookingRemainingAfter: z.number().nullable(),
  bookingRemainingValueAfterPkr: z.number().nullable(),
  ratePkr: z.number(),
  lastRatePkr: z.number(),
  discountType: tradeflowDiscountTypeSchema,
  discountValue: z.number(),
  discountPkr: z.number(),
  lineTotalPkr: z.number(),
});

export const tradeflowInvoiceExpenseSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  amountPkr: z.number(),
});

export const tradeflowInvoiceAttachmentSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string(),
  mimeType: z.string(),
  dataUrl: z.string(),
});

export const tradeflowInvoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNo: z.string(),
  customerId: z.string().uuid().nullable(),
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  customerBalancePkr: z.number(),
  salesPersonId: z.string().uuid().nullable(),
  salesPersonName: z.string().nullable(),
  paymentMode: tradeflowPaymentModeSchema,
  dueDate: z.string().nullable(),
  status: tradeflowInvoiceStatusSchema,
  subtotalPkr: z.number(),
  discountPkr: z.number(),
  expensePkr: z.number(),
  totalPkr: z.number(),
  receivedPkr: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  lines: z.array(tradeflowInvoiceLineSchema),
  expenses: z.array(tradeflowInvoiceExpenseSchema),
  attachments: z.array(tradeflowInvoiceAttachmentSchema),
  bookingSummary: z
    .object({
      bookedValuePkr: z.number(),
      deliveredValuePkr: z.number(),
      remainingValuePkr: z.number(),
      advancePkr: z.number(),
    })
    .optional(),
});

export const tradeflowPurchaseLineSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  itemName: z.string(),
  unit: z.string(),
  unitKind: tradeflowUnitKindSchema,
  qty: z.number(),
  ratePkr: z.number(),
  lineTotalPkr: z.number(),
});

export const tradeflowPurchaseSchema = z.object({
  id: z.string().uuid(),
  invoiceNo: z.string(),
  supplierId: z.string().uuid(),
  supplierName: z.string(),
  supplierPhone: z.string().nullable(),
  supplierBalancePkr: z.number(),
  totalPkr: z.number(),
  paidPkr: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  lines: z.array(tradeflowPurchaseLineSchema),
});

export const tradeflowPaymentSchema = z.object({
  id: z.string().uuid(),
  partyType: tradeflowPartyTypeSchema,
  partyId: z.string().uuid(),
  partyName: z.string(),
  kind: tradeflowPaymentKindSchema,
  amountPkr: z.number(),
  ref: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const tradeflowReturnSchema = z.object({
  id: z.string().uuid(),
  kind: tradeflowReturnKindSchema,
  partyType: tradeflowPartyTypeSchema,
  partyId: z.string().uuid(),
  partyName: z.string(),
  itemId: z.string().uuid().nullable(),
  itemName: z.string().nullable(),
  qty: z.number(),
  amountPkr: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const tradeflowNoteSchema = z.object({
  id: z.string().uuid(),
  kind: tradeflowNoteKindSchema,
  partyType: tradeflowPartyTypeSchema,
  partyId: z.string().uuid(),
  partyName: z.string(),
  amountPkr: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const tradeflowJournalSchema = z.object({
  id: z.string().uuid(),
  entryNo: z.string(),
  debitAccountId: z.string().uuid(),
  debitAccountName: z.string(),
  creditAccountId: z.string().uuid(),
  creditAccountName: z.string(),
  amountPkr: z.number(),
  narration: z.string().nullable(),
  createdAt: z.string(),
});

export const tradeflowContraSchema = z.object({
  id: z.string().uuid(),
  entryNo: z.string(),
  fromAccountId: z.string().uuid(),
  fromAccountName: z.string(),
  toAccountId: z.string().uuid(),
  toAccountName: z.string(),
  amountPkr: z.number(),
  narration: z.string().nullable(),
  createdAt: z.string(),
});

export const tradeflowExpenseSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  amountPkr: z.number(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

export const tradeflowSettingsSchema = z.object({
  whatsappTaxMessage: z.string(),
});

export const tradeflowWhatsappSchema = z.object({
  phone: z.string().nullable(),
  message: z.string(),
  waUrl: z.string().nullable(),
});

export const tradeflowLedgerEntrySchema = z.object({
  at: z.string(),
  type: z.string(),
  title: z.string(),
  amountPkr: z.number(),
  qty: z.number().nullable(),
  itemName: z.string().nullable(),
  unit: z.string().nullable(),
  ref: z.string().nullable(),
});

export const tradeflowLedgerSchema = z.object({
  customer: tradeflowCustomerSchema,
  summary: z.object({
    bookingValuePkr: z.number(),
    advancePkr: z.number(),
    deliveredValuePkr: z.number(),
    remainingValuePkr: z.number(),
    salesPkr: z.number(),
    paymentsPkr: z.number(),
    returnsPkr: z.number(),
    closingBalancePkr: z.number(),
  }),
  bookings: z.array(tradeflowBookingSchema),
  deliveredItems: z.array(tradeflowLedgerEntrySchema),
  remainingBookings: z.array(tradeflowBookingSchema),
  payments: z.array(tradeflowPaymentSchema),
  invoices: z.array(tradeflowInvoiceSchema),
  returns: z.array(tradeflowReturnSchema),
  entries: z.array(tradeflowLedgerEntrySchema),
});

export const tradeflowDashboardSchema = z.object({
  systemName: z.string(),
  status: z.literal("ready"),
  invoiceCount: z.number(),
  openBookings: z.number(),
  todaySalesPkr: z.number(),
  todayExpensesPkr: z.number(),
  todayProfitPkr: z.number(),
  todayReceiptsPkr: z.number(),
  todayPaymentsPkr: z.number(),
  todayPurchasesPkr: z.number(),
  todayReturnsPkr: z.number(),
  customerCount: z.number(),
});

export const createTradeFlowCustomerSchema = z.object({
  branchCode: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const createTradeFlowSupplierSchema = z.object({
  branchCode: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const createTradeFlowItemSchema = z.object({
  branchCode: z.string().min(1),
  sku: z.string().optional(),
  name: z.string().min(1),
  unit: z.string().optional(),
  altUnit: z.string().optional(),
  altFactor: z.number().nonnegative().optional(),
  defaultRatePkr: z.number().nonnegative(),
  onHandQty: z.number().nonnegative().optional(),
});

export const updateTradeFlowItemSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1).optional(),
  unit: z.string().optional(),
  altUnit: z.string().optional(),
  altFactor: z.number().nonnegative().optional(),
  defaultRatePkr: z.number().nonnegative().optional(),
  onHandQty: z.number().nonnegative().optional(),
});

export const createTradeFlowSalesPersonSchema = z.object({
  branchCode: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
});

export const createTradeFlowBookingSchema = z.object({
  branchCode: z.string().min(1),
  customerId: z.string().uuid(),
  itemId: z.string().uuid(),
  qtyBooked: z.number().positive(),
  bookedRatePkr: z.number().nonnegative(),
  advancePkr: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const createTradeFlowInvoiceLineSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().positive(),
  ratePkr: z.number().nonnegative(),
  discountType: tradeflowDiscountTypeSchema.optional(),
  discountValue: z.number().nonnegative().optional(),
  bookingId: z.string().uuid().optional(),
  unitKind: tradeflowUnitKindSchema.optional(),
});

export const createTradeFlowInvoiceExpenseSchema = z.object({
  label: z.string().min(1),
  amountPkr: z.number().nonnegative(),
});

export const createTradeFlowInvoiceAttachmentSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  dataUrl: z.string().min(1),
});

export const createTradeFlowInvoiceSchema = z.object({
  branchCode: z.string().min(1),
  customerId: z.string().uuid().optional().nullable(),
  salesPersonId: z.string().uuid().optional().nullable(),
  paymentMode: tradeflowPaymentModeSchema.optional(),
  dueDate: z.string().optional().nullable(),
  receiveNow: z.boolean().optional(),
  receivedPkr: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  lines: z.array(createTradeFlowInvoiceLineSchema).min(1),
  expenses: z.array(createTradeFlowInvoiceExpenseSchema).optional(),
  attachments: z.array(createTradeFlowInvoiceAttachmentSchema).optional(),
});

export const createTradeFlowPurchaseLineSchema = z.object({
  itemId: z.string().uuid(),
  qty: z.number().positive(),
  ratePkr: z.number().nonnegative(),
  unitKind: tradeflowUnitKindSchema.optional(),
});

export const createTradeFlowPurchaseSchema = z.object({
  branchCode: z.string().min(1),
  supplierId: z.string().uuid(),
  paidPkr: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  lines: z.array(createTradeFlowPurchaseLineSchema).min(1),
});

export const createTradeFlowPaymentSchema = z.object({
  branchCode: z.string().min(1),
  partyType: tradeflowPartyTypeSchema,
  partyId: z.string().uuid(),
  kind: tradeflowPaymentKindSchema,
  amountPkr: z.number().positive(),
  notes: z.string().optional(),
});

export const createTradeFlowReturnSchema = z.object({
  branchCode: z.string().min(1),
  kind: tradeflowReturnKindSchema,
  partyType: tradeflowPartyTypeSchema,
  partyId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  qty: z.number().nonnegative().optional(),
  amountPkr: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const createTradeFlowNoteSchema = z.object({
  branchCode: z.string().min(1),
  kind: tradeflowNoteKindSchema,
  partyType: tradeflowPartyTypeSchema,
  partyId: z.string().uuid(),
  amountPkr: z.number().positive(),
  notes: z.string().optional(),
});

export const createTradeFlowJournalSchema = z.object({
  branchCode: z.string().min(1),
  debitAccountId: z.string().uuid(),
  creditAccountId: z.string().uuid(),
  amountPkr: z.number().positive(),
  narration: z.string().optional(),
});

export const createTradeFlowContraSchema = z.object({
  branchCode: z.string().min(1),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amountPkr: z.number().positive(),
  narration: z.string().optional(),
});

export const createTradeFlowExpenseSchema = z.object({
  branchCode: z.string().min(1),
  label: z.string().min(1),
  amountPkr: z.number().positive(),
  notes: z.string().optional(),
});

export const updateTradeFlowSettingsSchema = z.object({
  branchCode: z.string().min(1),
  whatsappTaxMessage: z.string().min(1),
});

export const updateTradeFlowCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const updateTradeFlowSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export type TradeFlowCustomer = z.infer<typeof tradeflowCustomerSchema>;
export type TradeFlowSupplier = z.infer<typeof tradeflowSupplierSchema>;
export type TradeFlowItem = z.infer<typeof tradeflowItemSchema>;
export type TradeFlowSalesPerson = z.infer<typeof tradeflowSalesPersonSchema>;
export type TradeFlowAccount = z.infer<typeof tradeflowAccountSchema>;
export type TradeFlowBooking = z.infer<typeof tradeflowBookingSchema>;
export type TradeFlowInvoice = z.infer<typeof tradeflowInvoiceSchema>;
export type TradeFlowPurchase = z.infer<typeof tradeflowPurchaseSchema>;
export type TradeFlowPayment = z.infer<typeof tradeflowPaymentSchema>;
export type TradeFlowReturn = z.infer<typeof tradeflowReturnSchema>;
export type TradeFlowNote = z.infer<typeof tradeflowNoteSchema>;
export type TradeFlowJournal = z.infer<typeof tradeflowJournalSchema>;
export type TradeFlowContra = z.infer<typeof tradeflowContraSchema>;
export type TradeFlowExpense = z.infer<typeof tradeflowExpenseSchema>;
export type TradeFlowSettings = z.infer<typeof tradeflowSettingsSchema>;
export type TradeFlowWhatsapp = z.infer<typeof tradeflowWhatsappSchema>;
export type TradeFlowLedger = z.infer<typeof tradeflowLedgerSchema>;
export type TradeFlowDashboard = z.infer<typeof tradeflowDashboardSchema>;
export type CreateTradeFlowCustomer = z.infer<typeof createTradeFlowCustomerSchema>;
export type CreateTradeFlowSupplier = z.infer<typeof createTradeFlowSupplierSchema>;
export type CreateTradeFlowItem = z.infer<typeof createTradeFlowItemSchema>;
export type UpdateTradeFlowItem = z.infer<typeof updateTradeFlowItemSchema>;
export type CreateTradeFlowSalesPerson = z.infer<typeof createTradeFlowSalesPersonSchema>;
export type CreateTradeFlowBooking = z.infer<typeof createTradeFlowBookingSchema>;
export type CreateTradeFlowInvoice = z.infer<typeof createTradeFlowInvoiceSchema>;
export type CreateTradeFlowPurchase = z.infer<typeof createTradeFlowPurchaseSchema>;
export type CreateTradeFlowPayment = z.infer<typeof createTradeFlowPaymentSchema>;
export type CreateTradeFlowReturn = z.infer<typeof createTradeFlowReturnSchema>;
export type CreateTradeFlowNote = z.infer<typeof createTradeFlowNoteSchema>;
export type CreateTradeFlowJournal = z.infer<typeof createTradeFlowJournalSchema>;
export type CreateTradeFlowContra = z.infer<typeof createTradeFlowContraSchema>;
export type CreateTradeFlowExpense = z.infer<typeof createTradeFlowExpenseSchema>;
export type UpdateTradeFlowSettings = z.infer<typeof updateTradeFlowSettingsSchema>;
export type UpdateTradeFlowCustomer = z.infer<typeof updateTradeFlowCustomerSchema>;
export type UpdateTradeFlowSupplier = z.infer<typeof updateTradeFlowSupplierSchema>;
