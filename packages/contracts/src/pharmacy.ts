import { z } from "zod";

export const PHARMACY_ROLES = [
  "admin",
  "pharmacist",
  "cashier",
  "inventory_manager",
  "manager",
] as const;
export const pharmacyRoleSchema = z.enum(PHARMACY_ROLES);

export const MEDICINE_CATEGORIES = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Cream",
  "Drops",
  "Inhaler",
  "Other",
] as const;
export const medicineCategorySchema = z.enum(MEDICINE_CATEGORIES);

export const PRESCRIPTION_STATUSES = ["Pending", "Verified", "Dispensed", "Cancelled"] as const;
export const prescriptionStatusSchema = z.enum(PRESCRIPTION_STATUSES);

export const PHARMACY_PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "Mobile Wallet"] as const;
export const pharmacyPaymentMethodSchema = z.enum(PHARMACY_PAYMENT_METHODS);

export const medicineSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  genericName: z.string().nullable(),
  presentation: z.string().nullable(),
  brandName: z.string().nullable(),
  category: z.string(),
  manufacturer: z.string().nullable(),
  barcode: z.string().nullable(),
  purchasePrice: z.number(),
  sellingPrice: z.number(),
  taxPct: z.number(),
  reorderLevel: z.number(),
  currentStock: z.number(),
  unit: z.string(),
  nearestExpiry: z.string().nullable(),
});

export const medicineBatchSchema = z.object({
  id: z.string().uuid(),
  medicineId: z.string().uuid(),
  medicineName: z.string(),
  batchNumber: z.string(),
  manufacturingDate: z.string().nullable(),
  expiryDate: z.string(),
  quantity: z.number(),
});

export const pharmacyPatientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  loyaltyPoints: z.number(),
  outstandingPkr: z.number(),
  totalPurchases: z.number(),
});

export const pharmacyDoctorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  specialization: z.string().nullable(),
  clinic: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  prescriptionCount: z.number(),
});

export const prescriptionItemSchema = z.object({
  id: z.string().uuid(),
  medicineId: z.string().uuid(),
  medicineName: z.string(),
  dosage: z.string().nullable(),
  quantity: z.number(),
  dispensedQty: z.number(),
});

export const prescriptionSchema = z.object({
  id: z.string().uuid(),
  prescriptionNumber: z.string(),
  patientId: z.string().uuid().nullable(),
  patientName: z.string().nullable(),
  doctorId: z.string().uuid().nullable(),
  doctorName: z.string().nullable(),
  status: prescriptionStatusSchema,
  notes: z.string().nullable(),
  items: z.array(prescriptionItemSchema),
  createdAt: z.string(),
  verifiedAt: z.string().nullable(),
  dispensedAt: z.string().nullable(),
});

export const pharmacySaleLineSchema = z.object({
  id: z.string().uuid(),
  medicineId: z.string().uuid(),
  medicineName: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
});

export const pharmacySaleSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  patientId: z.string().uuid().nullable(),
  patientName: z.string().nullable(),
  paymentMethod: pharmacyPaymentMethodSchema,
  subtotal: z.number(),
  tax: z.number(),
  discount: z.number(),
  total: z.number(),
  lines: z.array(pharmacySaleLineSchema),
  createdAt: z.string(),
});

export const pharmacyAlertSchema = z.object({
  type: z.enum(["low_stock", "out_of_stock", "expiry", "near_expiry", "payment_due"]),
  severity: z.enum(["info", "warning", "danger"]),
  message: z.string(),
  medicineId: z.string().uuid().optional(),
});

export const pharmacyDashboardSchema = z.object({
  totalSalesToday: z.number(),
  totalPurchasesMonth: z.number(),
  availableStock: z.number(),
  lowStockCount: z.number(),
  expiringCount: z.number(),
  revenueMonth: z.number(),
  profitMonth: z.number(),
  pendingOrders: z.number(),
  customerCount: z.number(),
  transactionCountToday: z.number(),
  dailySales: z.array(z.object({ date: z.string(), amount: z.number() })),
  monthlyRevenue: z.array(z.object({ month: z.string(), amount: z.number() })),
  topMedicines: z.array(z.object({ name: z.string(), qty: z.number(), revenue: z.number() })),
  purchaseTrends: z.array(z.object({ month: z.string(), amount: z.number() })),
  stockHealth: z.array(z.object({ label: z.string(), value: z.number() })),
  prescriptionBreakdown: z.array(z.object({ label: z.string(), value: z.number() })),
  paymentBreakdown: z.array(z.object({ label: z.string(), value: z.number() })),
  categoryStock: z.array(z.object({ label: z.string(), value: z.number() })),
  alerts: z.array(pharmacyAlertSchema),
});

export const createMedicineSchema = z.object({
  branchCode: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  genericName: z.string().optional(),
  presentation: z.string().optional(),
  brandName: z.string().optional(),
  category: medicineCategorySchema.default("Tablet"),
  manufacturer: z.string().optional(),
  barcode: z.string().optional(),
  purchasePrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  taxPct: z.number().min(0).max(100).default(0),
  reorderLevel: z.number().min(0).default(10),
  currentStock: z.number().min(0).default(0),
  unit: z.string().default("Piece"),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const updateMedicineSchema = createMedicineSchema.omit({ branchCode: true }).partial();

export const createPatientSchema = z.object({
  branchCode: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
});

export const createDoctorSchema = z.object({
  branchCode: z.string().min(1),
  name: z.string().min(1),
  specialization: z.string().optional(),
  clinic: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const createPrescriptionSchema = z.object({
  branchCode: z.string().min(1),
  patientId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      medicineId: z.string().uuid(),
      dosage: z.string().optional(),
      quantity: z.number().min(1),
    }),
  ).min(1),
});

export const createPharmacySaleSchema = z.object({
  branchCode: z.string().min(1),
  patientId: z.string().uuid().optional(),
  paymentMethod: pharmacyPaymentMethodSchema,
  discount: z.number().min(0).default(0),
  lines: z.array(
    z.object({
      medicineId: z.string().uuid(),
      qty: z.number().min(1),
    }),
  ).min(1),
});

export type Medicine = z.infer<typeof medicineSchema>;
export type MedicineBatch = z.infer<typeof medicineBatchSchema>;
export type PharmacyPatient = z.infer<typeof pharmacyPatientSchema>;
export type PharmacyDoctor = z.infer<typeof pharmacyDoctorSchema>;
export type Prescription = z.infer<typeof prescriptionSchema>;
export type PharmacySale = z.infer<typeof pharmacySaleSchema>;
export type PharmacyDashboard = z.infer<typeof pharmacyDashboardSchema>;
export type CreateMedicine = z.infer<typeof createMedicineSchema>;
export type CreatePatient = z.infer<typeof createPatientSchema>;
export type CreateDoctor = z.infer<typeof createDoctorSchema>;
export type CreatePrescription = z.infer<typeof createPrescriptionSchema>;
export type CreatePharmacySale = z.infer<typeof createPharmacySaleSchema>;

export const pharmacyPurchaseLineSchema = z.object({
  poNumber: z.string(),
  supplierName: z.string(),
  status: z.string(),
  totalAmount: z.number(),
  createdAt: z.string(),
});

export const pharmacySupplierPaymentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  paymentTerms: z.string().nullable(),
  totalPurchases: z.number(),
  openingBalancePkr: z.number(),
  amountDue: z.number(),
  lastOrder: z.string().nullable(),
});

export const pharmacySalesStatementSchema = z.object({
  invoiceNumber: z.string(),
  patientName: z.string().nullable(),
  paymentMethod: z.string(),
  total: z.number(),
  createdAt: z.string(),
});

export const pharmacyProfitLossLineSchema = z.object({
  label: z.string(),
  amount: z.number(),
  type: z.enum(["income", "expense", "total"]),
});

export const pharmacyProfitLossTopProductSchema = z.object({
  medicineName: z.string(),
  qtySold: z.number(),
  revenue: z.number(),
  cost: z.number(),
  profit: z.number(),
});

export const pharmacyProfitLossSchema = z.object({
  periodLabel: z.string(),
  from: z.string(),
  to: z.string(),
  revenue: z.number(),
  costOfGoods: z.number(),
  grossProfit: z.number(),
  expenses: z.number(),
  netProfit: z.number(),
  marginPct: z.number(),
  transactionCount: z.number(),
  itemsSold: z.number(),
  taxCollected: z.number(),
  discountsGiven: z.number(),
  purchasesInPeriod: z.number(),
  statement: z.array(pharmacyProfitLossLineSchema),
  topProducts: z.array(pharmacyProfitLossTopProductSchema),
});

export const pharmacySalesOfMonthSchema = z.object({
  month: z.string(),
  from: z.string(),
  to: z.string(),
  totalSales: z.number(),
  transactionCount: z.number(),
  averageSale: z.number(),
  dailyBreakdown: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      amount: z.number(),
      count: z.number(),
    }),
  ),
  transactions: z.array(pharmacySalesStatementSchema),
});

export const pharmacyExpiredProductSchema = z.object({
  id: z.string().uuid(),
  medicineName: z.string(),
  sku: z.string(),
  presentation: z.string().nullable(),
  category: z.string(),
  batchNumber: z.string(),
  expiryDate: z.string(),
  quantity: z.number(),
  daysOverdue: z.number(),
  daysUntilExpiry: z.number(),
  status: z.enum(["expired", "expiring_soon"]),
  estimatedLossPkr: z.number(),
});

export const pharmacyExpiredProductsReportSchema = z.object({
  periodLabel: z.string(),
  from: z.string(),
  to: z.string(),
  totalBatches: z.number(),
  totalUnits: z.number(),
  expiredCount: z.number(),
  expiringSoonCount: z.number(),
  estimatedLossPkr: z.number(),
  products: z.array(pharmacyExpiredProductSchema),
});
