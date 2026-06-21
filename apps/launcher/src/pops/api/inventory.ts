import {
  branchInventorySchema,
  ingredientSchema,
  inventoryAuditLogSchema,
  inventoryCategorySchema,
  inventoryDashboardSchema,
  inventoryReportSchema,
  goodsReceiptSchema,
  purchaseOrderSchema,
  productionBatchListSchema,
  productionBatchSchema,
  createProductionBatchSchema,
  recipeSchema,
  stockAdjustmentSchema,
  stockBatchSchema,
  stockCountSchema,
  supplierSchema,
  wasteRecordSchema,
  type BranchInventory,
  type CreateGoodsReceipt,
  type CreateIngredient,
  type CreateInventoryCategory,
  type CreatePurchaseOrder,
  type CreateProductionBatch,
  type CreateRecipe,
  type CreateStockAdjustment,
  type CreateStockCount,
  type CreateSupplier,
  type CreateWasteRecord,
  type Ingredient,
  type InventoryCategory,
  type InventoryDashboard,
  type InventoryReport,
  type GoodsReceipt,
  type PurchaseOrder,
  type ProductionBatch,
  type Recipe,
  type StockAdjustment,
  type StockCount,
  type Supplier,
  type UpdateAdjustmentStatus,
  type UpdateIngredient,
  type UpdateInventoryCategory,
  type UpdatePurchaseOrderStatus,
  type UpdateRecipe,
  type UpdateSupplier,
  type UpdateWasteStatus,
  type WasteRecord,
} from "@platform/contracts";
import { authFetch } from "../../lib/authFetch";

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new Error(err?.message ?? `${fallback}: ${res.status}`);
}

export async function fetchInventoryDashboard(branchCode: string): Promise<InventoryDashboard> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/inventory/dashboard?${params}`);
  if (!res.ok) await parseError(res, "Dashboard failed");
  return inventoryDashboardSchema.parse(await res.json());
}

export async function fetchBranchInventory(branchCode: string): Promise<BranchInventory> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/inventory?${params}`);
  if (!res.ok) await parseError(res, "Inventory failed");
  return branchInventorySchema.parse(await res.json());
}

export async function fetchInventoryReport(
  branchCode: string,
  reportId: string,
  options?: { filterDate?: string; dateMode?: "activity" | "expiry" | "order" },
): Promise<InventoryReport> {
  const params = new URLSearchParams({ branchCode });
  if (options?.filterDate) params.set("filterDate", options.filterDate);
  if (options?.dateMode) params.set("dateMode", options.dateMode);
  const res = await authFetch(`/v1/inventory/reports/${reportId}?${params}`);
  if (!res.ok) await parseError(res, "Report failed");
  return inventoryReportSchema.parse(await res.json());
}

export async function createInventoryCategory(input: CreateInventoryCategory): Promise<InventoryCategory> {
  const res = await authFetch("/v1/inventory/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create category failed");
  return inventoryCategorySchema.parse(await res.json());
}

export async function updateInventoryCategory(
  categoryId: string,
  input: UpdateInventoryCategory,
): Promise<InventoryCategory> {
  const res = await authFetch(`/v1/inventory/categories/${categoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update category failed");
  return inventoryCategorySchema.parse(await res.json());
}

export async function deleteInventoryCategory(categoryId: string): Promise<void> {
  const res = await authFetch(`/v1/inventory/categories/${categoryId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Delete category failed");
}

export async function createIngredient(input: CreateIngredient): Promise<Ingredient> {
  const res = await authFetch("/v1/inventory/ingredients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create ingredient failed");
  return ingredientSchema.parse(await res.json());
}

export async function updateIngredient(ingredientId: string, input: UpdateIngredient): Promise<Ingredient> {
  const res = await authFetch(`/v1/inventory/ingredients/${ingredientId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update ingredient failed");
  return ingredientSchema.parse(await res.json());
}

export async function deleteIngredient(ingredientId: string): Promise<void> {
  const res = await authFetch(`/v1/inventory/ingredients/${ingredientId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Delete ingredient failed");
}

export async function createSupplier(input: CreateSupplier): Promise<Supplier> {
  const res = await authFetch("/v1/inventory/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create supplier failed");
  return supplierSchema.parse(await res.json());
}

export async function updateSupplier(supplierId: string, input: UpdateSupplier): Promise<Supplier> {
  const res = await authFetch(`/v1/inventory/suppliers/${supplierId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update supplier failed");
  return supplierSchema.parse(await res.json());
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  const res = await authFetch(`/v1/inventory/suppliers/${supplierId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Delete supplier failed");
}

export async function createPurchaseOrder(input: CreatePurchaseOrder): Promise<PurchaseOrder> {
  const res = await authFetch("/v1/inventory/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create PO failed");
  return purchaseOrderSchema.parse(await res.json());
}

export async function updatePurchaseOrderStatus(
  poId: string,
  input: UpdatePurchaseOrderStatus,
): Promise<PurchaseOrder> {
  const res = await authFetch(`/v1/inventory/purchase-orders/${poId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update PO failed");
  return purchaseOrderSchema.parse(await res.json());
}

export async function createGoodsReceipt(input: CreateGoodsReceipt): Promise<GoodsReceipt> {
  const res = await authFetch("/v1/inventory/goods-receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create GRN failed");
  return goodsReceiptSchema.parse(await res.json());
}

export async function createRecipe(input: CreateRecipe): Promise<Recipe> {
  const res = await authFetch("/v1/inventory/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create recipe failed");
  return recipeSchema.parse(await res.json());
}

export async function updateRecipe(recipeId: string, input: UpdateRecipe): Promise<Recipe> {
  const res = await authFetch(`/v1/inventory/recipes/${recipeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update recipe failed");
  return recipeSchema.parse(await res.json());
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const res = await authFetch(`/v1/inventory/recipes/${recipeId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Delete recipe failed");
}

export async function createStockAdjustment(input: CreateStockAdjustment): Promise<StockAdjustment> {
  const res = await authFetch("/v1/inventory/adjustments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create adjustment failed");
  return stockAdjustmentSchema.parse(await res.json());
}

export async function updateAdjustmentStatus(
  adjustmentId: string,
  input: UpdateAdjustmentStatus,
): Promise<StockAdjustment> {
  const res = await authFetch(`/v1/inventory/adjustments/${adjustmentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update adjustment failed");
  return stockAdjustmentSchema.parse(await res.json());
}

export async function createWasteRecord(input: CreateWasteRecord): Promise<WasteRecord> {
  const res = await authFetch("/v1/inventory/waste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create waste failed");
  return wasteRecordSchema.parse(await res.json());
}

export async function updateWasteStatus(wasteId: string, input: UpdateWasteStatus): Promise<WasteRecord> {
  const res = await authFetch(`/v1/inventory/waste/${wasteId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update waste failed");
  return wasteRecordSchema.parse(await res.json());
}

export async function createStockCount(input: CreateStockCount): Promise<StockCount> {
  const res = await authFetch("/v1/inventory/stock-counts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create stock count failed");
  return stockCountSchema.parse(await res.json());
}

export async function completeStockCount(
  countId: string,
  applyAdjustments = true,
): Promise<StockCount> {
  const res = await authFetch(`/v1/inventory/stock-counts/${countId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applyAdjustments }),
  });
  if (!res.ok) await parseError(res, "Complete stock count failed");
  return stockCountSchema.parse(await res.json());
}

export async function fetchProductionBatches(branchCode: string): Promise<ProductionBatch[]> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/inventory/production?${params}`);
  if (!res.ok) await parseError(res, "Production batches failed");
  return productionBatchListSchema.parse(await res.json()).batches;
}

export async function createProductionBatch(input: CreateProductionBatch): Promise<ProductionBatch> {
  const body = createProductionBatchSchema.parse(input);
  const res = await authFetch("/v1/inventory/production", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseError(res, "Create production batch failed");
  return productionBatchSchema.parse(await res.json());
}

export async function postProductionBatch(batchId: string): Promise<ProductionBatch> {
  const res = await authFetch(`/v1/inventory/production/${batchId}/post`, { method: "POST" });
  if (!res.ok) await parseError(res, "Post production failed");
  return productionBatchSchema.parse(await res.json());
}

export const INVENTORY_REPORTS = [
  { id: "current-stock", name: "Current Stock", category: "Inventory" as const },
  { id: "low-stock", name: "Low Stock", category: "Inventory" as const },
  { id: "expiry", name: "Expiry Report", category: "Inventory" as const },
  { id: "valuation", name: "Inventory Valuation", category: "Inventory" as const },
  { id: "consumption", name: "Ingredient Consumption", category: "Restaurant" as const },
  { id: "recipe-cost", name: "Recipe Cost", category: "Restaurant" as const },
  { id: "waste", name: "Waste Analysis", category: "Restaurant" as const },
  { id: "purchases", name: "Purchase Report", category: "Purchase" as const },
  { id: "suppliers", name: "Supplier Report", category: "Supplier" as const },
];

export type { StockBatch } from "@platform/contracts";
export { stockBatchSchema, inventoryAuditLogSchema };
