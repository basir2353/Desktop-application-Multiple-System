import {
  storeCategorySchema,
  storeBrandSchema,
  storeUnitSchema,
  storeProductSchema,
  storeProductBatchSchema,
  storeDashboardSchema,
  storeSupplierSchema,
  storeCustomerSchema,
  storeWarehouseSchema,
  storePurchaseRequisitionSchema,
  storePurchaseOrderSchema,
  storePurchaseOrderDetailSchema,
  storeGrnSchema,
  storeInventoryTransactionSchema,
  storeStockTransferSchema,
  storeStockAdjustmentSchema,
  storeStockAuditSchema,
  storeSaleSchema,
  storeProfitLossSchema,
  storeStockReportSchema,
  storeShiftSchema,
  storePromotionSchema,
  storePosShortcutSchema,
  storeCouponSchema,
  storeGiftCardSchema,
  storeSaleReturnSchema,
  storePurchaseReturnSchema,
  storePeakHoursReportSchema,
  storeEmployeeReportSchema,
  storeWastageReportSchema,
  storeCustomerDetailSchema,
  storeCashMovementSchema,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

async function parseError(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const j = (await res.json()) as { message?: string | string[] };
    if (typeof j.message === "string") msg = j.message;
    else if (Array.isArray(j.message)) msg = j.message.join(", ");
  } catch {
    // ignore
  }
  throw new Error(msg);
}

function parseArray<T>(schema: { parse: (v: unknown) => T }, json: unknown): T[] {
  if (!Array.isArray(json)) throw new Error("Invalid response");
  return json.map((row) => schema.parse(row));
}

function qs(branchCode: string, extra?: Record<string, string>): string {
  return new URLSearchParams({ branchCode, ...extra }).toString();
}

export async function fetchStoreDashboard(branchCode: string) {
  const res = await authFetch(`/v1/store/dashboard?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load store dashboard");
  return storeDashboardSchema.parse(await res.json());
}

export async function fetchStoreCategories(branchCode: string) {
  const res = await authFetch(`/v1/store/categories?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load categories");
  return parseArray(storeCategorySchema, await res.json());
}

export async function createStoreCategory(body: unknown) {
  const res = await authFetch("/v1/store/categories", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create category");
  return storeCategorySchema.parse(await res.json());
}

export async function fetchStoreBrands(branchCode: string) {
  const res = await authFetch(`/v1/store/brands?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load brands");
  return parseArray(storeBrandSchema, await res.json());
}

export async function createStoreBrand(body: unknown) {
  const res = await authFetch("/v1/store/brands", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create brand");
  return storeBrandSchema.parse(await res.json());
}

export async function fetchStoreUnits(branchCode: string) {
  const res = await authFetch(`/v1/store/units?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load units");
  return parseArray(storeUnitSchema, await res.json());
}

export async function createStoreUnit(body: unknown) {
  const res = await authFetch("/v1/store/units", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create unit");
  return storeUnitSchema.parse(await res.json());
}

export async function fetchStoreProducts(branchCode: string) {
  const res = await authFetch(`/v1/store/products?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load products");
  return parseArray(storeProductSchema, await res.json());
}

export async function createStoreProduct(body: unknown) {
  const res = await authFetch("/v1/store/products", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create product");
  return storeProductSchema.parse(await res.json());
}

export async function deleteStoreProduct(productId: string) {
  const res = await authFetch(`/v1/store/products/${productId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Failed to delete product");
}

export async function fetchStoreBatches(branchCode: string) {
  const res = await authFetch(`/v1/store/batches?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load batches");
  return parseArray(storeProductBatchSchema, await res.json());
}

export async function recordStoreStockMovement(body: unknown) {
  const res = await authFetch("/v1/store/inventory/movement", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to record stock movement");
  return storeProductSchema.parse(await res.json());
}

export async function fetchStoreTransactions(branchCode: string) {
  const res = await authFetch(`/v1/store/inventory/transactions?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load transactions");
  return parseArray(storeInventoryTransactionSchema, await res.json());
}

export async function fetchStoreSuppliers(branchCode: string) {
  const res = await authFetch(`/v1/store/suppliers?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load suppliers");
  return parseArray(storeSupplierSchema, await res.json());
}

export async function createStoreSupplier(body: unknown) {
  const res = await authFetch("/v1/store/suppliers", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create supplier");
  return storeSupplierSchema.parse(await res.json());
}

export async function fetchStoreCustomers(branchCode: string) {
  const res = await authFetch(`/v1/store/customers?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load customers");
  return parseArray(storeCustomerSchema, await res.json());
}

export async function createStoreCustomer(body: unknown) {
  const res = await authFetch("/v1/store/customers", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create customer");
  return storeCustomerSchema.parse(await res.json());
}

export async function fetchStoreWarehouses(branchCode: string) {
  const res = await authFetch(`/v1/store/warehouses?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load warehouses");
  return parseArray(storeWarehouseSchema, await res.json());
}

export async function createStoreWarehouse(body: unknown) {
  const res = await authFetch("/v1/store/warehouses", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create warehouse");
  return storeWarehouseSchema.parse(await res.json());
}

export async function fetchStoreRequisitions(branchCode: string) {
  const res = await authFetch(`/v1/store/purchase/requisitions?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load requisitions");
  return parseArray(storePurchaseRequisitionSchema, await res.json());
}

export async function createStoreRequisition(body: unknown) {
  const res = await authFetch("/v1/store/purchase/requisitions", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create requisition");
  return storePurchaseRequisitionSchema.parse(await res.json());
}

export async function fetchStorePurchaseOrders(branchCode: string) {
  const res = await authFetch(`/v1/store/purchase/orders?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load purchase orders");
  return parseArray(storePurchaseOrderSchema, await res.json());
}

export async function fetchStorePurchaseOrder(orderId: string) {
  const res = await authFetch(`/v1/store/purchase/orders/${orderId}`);
  if (!res.ok) await parseError(res, "Failed to load purchase order");
  return storePurchaseOrderDetailSchema.parse(await res.json());
}

export async function createStorePurchaseOrder(body: unknown) {
  const res = await authFetch("/v1/store/purchase/orders", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create purchase order");
  return storePurchaseOrderDetailSchema.parse(await res.json());
}

export async function approveStorePurchaseOrder(orderId: string) {
  const res = await authFetch(`/v1/store/purchase/orders/${orderId}/approve`, { method: "PATCH" });
  if (!res.ok) await parseError(res, "Failed to approve purchase order");
  return storePurchaseOrderDetailSchema.parse(await res.json());
}

export async function fetchStoreGrn(branchCode: string) {
  const res = await authFetch(`/v1/store/purchase/grn?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load GRN");
  return parseArray(storeGrnSchema, await res.json());
}

export async function createStoreGrn(body: unknown) {
  const res = await authFetch("/v1/store/purchase/grn", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create GRN");
  return storeGrnSchema.parse(await res.json());
}

export async function fetchStoreTransfers(branchCode: string) {
  const res = await authFetch(`/v1/store/transfers?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load transfers");
  return parseArray(storeStockTransferSchema, await res.json());
}

export async function createStoreTransfer(body: unknown) {
  const res = await authFetch("/v1/store/transfers", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create transfer");
  return storeStockTransferSchema.parse(await res.json());
}

export async function completeStoreTransfer(transferId: string) {
  const res = await authFetch(`/v1/store/transfers/${transferId}/complete`, { method: "PATCH" });
  if (!res.ok) await parseError(res, "Failed to complete transfer");
}

export async function fetchStoreAdjustments(branchCode: string) {
  const res = await authFetch(`/v1/store/adjustments?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load adjustments");
  return parseArray(storeStockAdjustmentSchema, await res.json());
}

export async function createStoreAdjustment(body: unknown) {
  const res = await authFetch("/v1/store/adjustments", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create adjustment");
  return storeStockAdjustmentSchema.parse(await res.json());
}

export async function approveStoreAdjustment(adjustmentId: string) {
  const res = await authFetch(`/v1/store/adjustments/${adjustmentId}/approve`, { method: "PATCH" });
  if (!res.ok) await parseError(res, "Failed to approve adjustment");
}

export async function fetchStoreAudits(branchCode: string) {
  const res = await authFetch(`/v1/store/audits?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load audits");
  return parseArray(storeStockAuditSchema, await res.json());
}

export async function createStoreAudit(body: unknown) {
  const res = await authFetch("/v1/store/audits", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create audit");
  return storeStockAuditSchema.parse(await res.json());
}

export async function approveStoreAudit(auditId: string) {
  const res = await authFetch(`/v1/store/audits/${auditId}/approve`, { method: "PATCH" });
  if (!res.ok) await parseError(res, "Failed to approve audit");
}

export async function fetchStoreSales(branchCode: string, status?: string) {
  const params: Record<string, string> = { branchCode };
  if (status) params.status = status;
  const res = await authFetch(`/v1/store/sales?${new URLSearchParams(params)}`);
  if (!res.ok) await parseError(res, "Failed to load sales");
  return parseArray(storeSaleSchema, await res.json());
}

export async function createStoreSale(body: unknown) {
  const res = await authFetch("/v1/store/sales", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create sale");
  return storeSaleSchema.parse(await res.json());
}

export async function completeStoreHeldSale(saleId: string, body: unknown) {
  const res = await authFetch(`/v1/store/sales/${saleId}/complete`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to complete held sale");
  return storeSaleSchema.parse(await res.json());
}

export async function voidStoreHeldSale(saleId: string) {
  const res = await authFetch(`/v1/store/sales/${saleId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Failed to void held sale");
}

export async function fetchStoreShifts(branchCode: string) {
  const res = await authFetch(`/v1/store/shifts?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load shifts");
  return parseArray(storeShiftSchema, await res.json());
}

export async function fetchStoreOpenShift(branchCode: string, terminalId?: string) {
  const params: Record<string, string> = { branchCode };
  if (terminalId) params.terminalId = terminalId;
  const res = await authFetch(`/v1/store/shifts/open?${new URLSearchParams(params)}`);
  if (res.status === 404) return null;
  if (!res.ok) await parseError(res, "Failed to load open shift");
  const json = await res.json();
  return json ? storeShiftSchema.parse(json) : null;
}

export async function openStoreShift(body: unknown) {
  const res = await authFetch("/v1/store/shifts/open", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to open shift");
  return storeShiftSchema.parse(await res.json());
}

export async function closeStoreShift(shiftId: string, body: unknown) {
  const res = await authFetch(`/v1/store/shifts/${shiftId}/close`, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to close shift");
  return storeShiftSchema.parse(await res.json());
}

export async function fetchStorePromotions(branchCode: string) {
  const res = await authFetch(`/v1/store/promotions?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load promotions");
  return parseArray(storePromotionSchema, await res.json());
}

export async function createStorePromotion(body: unknown) {
  const res = await authFetch("/v1/store/promotions", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create promotion");
  return storePromotionSchema.parse(await res.json());
}

export async function toggleStorePromotion(promotionId: string, isActive: boolean) {
  const res = await authFetch(`/v1/store/promotions/${promotionId}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) await parseError(res, "Failed to toggle promotion");
}

export async function fetchStorePosShortcuts(branchCode: string) {
  const res = await authFetch(`/v1/store/pos-shortcuts?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load POS shortcuts");
  return parseArray(storePosShortcutSchema, await res.json());
}

export async function upsertStorePosShortcut(body: unknown) {
  const res = await authFetch("/v1/store/pos-shortcuts", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to save shortcut");
  return storePosShortcutSchema.parse(await res.json());
}

export async function deleteStorePosShortcut(shortcutId: string) {
  const res = await authFetch(`/v1/store/pos-shortcuts/${shortcutId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Failed to delete shortcut");
}

export async function syncStoreInventory(branchCode: string) {
  const res = await authFetch(`/v1/store/inventory/sync?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to sync inventory");
  return res.json() as Promise<{ syncedAt: string; products: Array<{ id: string; sku: string; name: string; availableStock: number; isWeighed: boolean }> }>;
}

export async function fetchStoreStockReport(branchCode: string, from?: string, to?: string) {
  const params: Record<string, string> = { branchCode };
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await authFetch(`/v1/store/reports/stock?${new URLSearchParams(params)}`);
  if (!res.ok) await parseError(res, "Failed to load stock report");
  return storeStockReportSchema.parse(await res.json());
}

export async function fetchStoreProfitLoss(branchCode: string, from?: string, to?: string) {
  const params: Record<string, string> = { branchCode };
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await authFetch(`/v1/store/reports/profit-loss?${new URLSearchParams(params)}`);
  if (!res.ok) await parseError(res, "Failed to load profit/loss report");
  return storeProfitLossSchema.parse(await res.json());
}

export async function lookupStoreProduct(branchCode: string, q: string) {
  const res = await authFetch(`/v1/store/products/lookup?${new URLSearchParams({ branchCode, q })}`);
  if (!res.ok) await parseError(res, "Product not found");
  return res.json() as Promise<{ id: string; sku: string; name: string; barcode: string | null; sellingPrice: number; isWeighed: boolean; availableStock: number; priceLabel: string }>;
}

export async function fetchStoreCustomerDetail(customerId: string) {
  const res = await authFetch(`/v1/store/customers/${customerId}`);
  if (!res.ok) await parseError(res, "Failed to load customer");
  return storeCustomerDetailSchema.parse(await res.json());
}

export async function updateStoreCustomerTier(customerId: string, membershipTier: string) {
  const res = await authFetch(`/v1/store/customers/${customerId}/tier`, { method: "PATCH", body: JSON.stringify({ membershipTier }) });
  if (!res.ok) await parseError(res, "Failed to update tier");
  return storeCustomerDetailSchema.parse(await res.json());
}

export async function recordStoreCashMovement(body: unknown) {
  const res = await authFetch("/v1/store/cash-movements", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to record cash movement");
  return storeCashMovementSchema.parse(await res.json());
}

export async function fetchStoreCashMovements(shiftId: string) {
  const res = await authFetch(`/v1/store/cash-movements?shiftId=${shiftId}`);
  if (!res.ok) await parseError(res, "Failed to load cash movements");
  return parseArray(storeCashMovementSchema, await res.json());
}

export async function fetchStoreCoupons(branchCode: string) {
  const res = await authFetch(`/v1/store/coupons?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load coupons");
  return parseArray(storeCouponSchema, await res.json());
}

export async function createStoreCoupon(body: unknown) {
  const res = await authFetch("/v1/store/coupons", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create coupon");
  return storeCouponSchema.parse(await res.json());
}

export async function validateStoreCoupon(body: unknown) {
  const res = await authFetch("/v1/store/coupons/validate", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Invalid coupon");
  return res.json() as Promise<{ code: string; name: string; discount: number }>;
}

export async function fetchStoreGiftCards(branchCode: string) {
  const res = await authFetch(`/v1/store/gift-cards?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load gift cards");
  return parseArray(storeGiftCardSchema, await res.json());
}

export async function createStoreGiftCard(body: unknown) {
  const res = await authFetch("/v1/store/gift-cards", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create gift card");
  return storeGiftCardSchema.parse(await res.json());
}

export async function validateStoreGiftCard(body: unknown) {
  const res = await authFetch("/v1/store/gift-cards/validate", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Invalid gift card");
  return res.json() as Promise<{ cardNumber: string; balancePkr: number }>;
}

export async function fetchStoreSaleReturns(branchCode: string) {
  const res = await authFetch(`/v1/store/returns/sales?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load returns");
  return parseArray(storeSaleReturnSchema, await res.json());
}

export async function createStoreSaleReturn(body: unknown) {
  const res = await authFetch("/v1/store/returns/sales", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create return");
  return storeSaleReturnSchema.parse(await res.json());
}

export async function fetchStorePurchaseReturns(branchCode: string) {
  const res = await authFetch(`/v1/store/returns/purchase?${qs(branchCode)}`);
  if (!res.ok) await parseError(res, "Failed to load purchase returns");
  return parseArray(storePurchaseReturnSchema, await res.json());
}

export async function createStorePurchaseReturn(body: unknown) {
  const res = await authFetch("/v1/store/returns/purchase", { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) await parseError(res, "Failed to create purchase return");
  return storePurchaseReturnSchema.parse(await res.json());
}

export async function fetchStorePeakHoursReport(branchCode: string, from?: string, to?: string) {
  const params: Record<string, string> = { branchCode };
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await authFetch(`/v1/store/reports/peak-hours?${new URLSearchParams(params)}`);
  if (!res.ok) await parseError(res, "Failed to load peak hours report");
  return storePeakHoursReportSchema.parse(await res.json());
}

export async function fetchStoreEmployeeReport(branchCode: string, from?: string, to?: string) {
  const params: Record<string, string> = { branchCode };
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await authFetch(`/v1/store/reports/employees?${new URLSearchParams(params)}`);
  if (!res.ok) await parseError(res, "Failed to load employee report");
  return storeEmployeeReportSchema.parse(await res.json());
}

export async function fetchStoreWastageReport(branchCode: string, from?: string, to?: string) {
  const params: Record<string, string> = { branchCode };
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await authFetch(`/v1/store/reports/wastage?${new URLSearchParams(params)}`);
  if (!res.ok) await parseError(res, "Failed to load wastage report");
  return storeWastageReportSchema.parse(await res.json());
}
