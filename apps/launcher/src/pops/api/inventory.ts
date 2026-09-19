import {
  branchInventorySchema,
  ingredientSchema,
  inventoryAuditLogSchema,
  inventoryCategorySchema,
  inventoryCookingUnitSchema,
  inventoryCookingUnitListSchema,
  inventoryCookingUnitStockSchema,
  inventoryTransferListSchema,
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
  type InventoryCookingUnit,
  type InventoryCookingUnitStock,
  type InventoryTransfer,
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
  type UpdatePurchaseOrder,
  type UpdatePurchaseOrderStatus,
  type UpdateRecipe,
  type UpdateSupplier,
  type UpdateWasteStatus,
  type WasteRecord,
  inventoryWarehouseListSchema,
  inventoryWarehouseSchema,
  type CreateInventoryTransfer,
  type CreateInventoryCookingUnit,
  type CreateInventoryWarehouse,
  type UpdateInventoryCookingUnit,
  type UpdateInventoryWarehouse,
  type CreateIngredientLink,
  type InventoryWarehouse,
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

export async function fetchInventoryWarehouses(branchCode: string): Promise<{
  branchCode: string;
  warehouses: InventoryWarehouse[];
  stock: { warehouseId: string; productId: string; quantity: number }[];
}> {
  const res = await authFetch(`/v1/inventory/warehouses?${new URLSearchParams({ branchCode })}`);
  if (!res.ok) await parseError(res, "Warehouses failed");
  const parsed = inventoryWarehouseListSchema.parse(await res.json());
  return { ...parsed, stock: parsed.stock ?? [] };
}

export async function createInventoryWarehouse(input: CreateInventoryWarehouse): Promise<InventoryWarehouse> {
  const res = await authFetch("/v1/inventory/warehouses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create store failed");
  return inventoryWarehouseSchema.parse(await res.json());
}

export async function updateInventoryWarehouse(
  warehouseId: string,
  input: UpdateInventoryWarehouse,
): Promise<InventoryWarehouse> {
  const res = await authFetch(`/v1/inventory/warehouses/${warehouseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update store failed");
  return inventoryWarehouseSchema.parse(await res.json());
}

export async function deleteInventoryWarehouse(warehouseId: string): Promise<void> {
  const res = await authFetch(`/v1/inventory/warehouses/${warehouseId}`, { method: "DELETE" });
  if (!res.ok) await parseError(res, "Delete store failed");
}

export async function fetchInventoryCookingUnits(branchCode: string): Promise<{
  branchCode: string;
  units: InventoryCookingUnit[];
}> {
  const res = await authFetch(`/v1/inventory/cooking-units?${new URLSearchParams({ branchCode })}`);
  if (!res.ok) await parseError(res, "Cooking Units failed");
  return inventoryCookingUnitListSchema.parse(await res.json());
}

export async function fetchInventoryCookingUnitStock(
  branchCode: string,
  cookingUnitId?: string,
): Promise<InventoryCookingUnitStock[]> {
  const params = new URLSearchParams({ branchCode });
  if (cookingUnitId) params.set("cookingUnitId", cookingUnitId);
  const res = await authFetch(`/v1/inventory/cooking-units/stock?${params}`);
  if (!res.ok) await parseError(res, "Cooking Unit stock failed");
  return inventoryCookingUnitStockSchema.array().parse(await res.json());
}

export async function fetchInventoryTransfers(branchCode: string): Promise<{
  branchCode: string;
  transfers: InventoryTransfer[];
}> {
  const res = await authFetch(`/v1/inventory/transfers?${new URLSearchParams({ branchCode })}`);
  if (!res.ok) await parseError(res, "Transfers failed");
  return inventoryTransferListSchema.parse(await res.json());
}

export async function createInventoryCookingUnit(input: CreateInventoryCookingUnit): Promise<InventoryCookingUnit> {
  const res = await authFetch("/v1/inventory/cooking-units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Create Cooking Unit failed");
  const row = await res.json() as Omit<InventoryCookingUnit, "totalStock"> & { totalStock?: number };
  return inventoryCookingUnitSchema.parse({ ...row, totalStock: row.totalStock ?? 0 });
}

export async function updateInventoryCookingUnit(
  cookingUnitId: string,
  input: UpdateInventoryCookingUnit,
): Promise<InventoryCookingUnit> {
  const res = await authFetch(`/v1/inventory/cooking-units/${cookingUnitId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Update Cooking Unit failed");
  const row = await res.json() as Omit<InventoryCookingUnit, "totalStock"> & { totalStock?: number };
  return inventoryCookingUnitSchema.parse({ ...row, totalStock: row.totalStock ?? 0 });
}

export async function linkIngredientToStoreProduct(input: CreateIngredientLink): Promise<Ingredient> {
  const res = await authFetch("/v1/inventory/ingredient-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Ingredient mapping failed");
  return ingredientSchema.parse(await res.json());
}

export async function createInventoryTransfer(input: CreateInventoryTransfer) {
  const res = await authFetch("/v1/inventory/transfers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) await parseError(res, "Stock transfer failed");
  return res.json() as Promise<{
    reference: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    itemCount: number;
  }>;
}

/** Soft-parse recipe/ingredient rows so one bad record cannot blank the POS check. */
function softParseRecipes(raw: unknown): Recipe[] {
  if (!Array.isArray(raw)) return [];
  const out: Recipe[] = [];
  for (const row of raw) {
    const parsed = recipeSchema.safeParse(row);
    if (parsed.success) {
      out.push(parsed.data);
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    if (typeof obj.id !== "string" || typeof obj.name !== "string") continue;
    const ingredients = Array.isArray(obj.ingredients)
      ? obj.ingredients
          .map((line) => {
            if (!line || typeof line !== "object") return null;
            const item = line as Record<string, unknown>;
            if (typeof item.ingredientId !== "string") return null;
            return {
              id: typeof item.id === "string" ? item.id : item.ingredientId,
              ingredientId: item.ingredientId,
              ingredient: typeof item.ingredient === "string" ? item.ingredient : "—",
              qty: Number(item.qty) || 0,
              unit: typeof item.unit === "string" ? item.unit : "Piece",
            };
          })
          .filter((line): line is NonNullable<typeof line> => Boolean(line))
      : [];
    out.push({
      id: obj.id,
      name: obj.name,
      menuItemId: typeof obj.menuItemId === "string" ? obj.menuItemId : null,
      menuItem: typeof obj.menuItem === "string" ? obj.menuItem : null,
      version: typeof obj.version === "string" ? obj.version : "1",
      portionSize: typeof obj.portionSize === "string" ? obj.portionSize : null,
      portionFactors:
        obj.portionFactors && typeof obj.portionFactors === "object"
          ? (obj.portionFactors as Record<string, number>)
          : undefined,
      ingredients,
      totalCost: Number(obj.totalCost) || 0,
      active: obj.active !== false,
    });
  }
  return out;
}

function softParseIngredients(raw: unknown): Ingredient[] {
  if (!Array.isArray(raw)) return [];
  const out: Ingredient[] = [];
  for (const row of raw) {
    const parsed = ingredientSchema.safeParse(row);
    if (parsed.success) {
      out.push(parsed.data);
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    if (typeof obj.id !== "string" || typeof obj.name !== "string") continue;
    out.push({
      id: obj.id,
      categoryId: typeof obj.categoryId === "string" ? obj.categoryId : null,
      categoryName: typeof obj.categoryName === "string" ? obj.categoryName : null,
      storeProductId: typeof obj.storeProductId === "string" ? obj.storeProductId : null,
      sku: typeof obj.sku === "string" ? obj.sku : "",
      name: obj.name,
      unit: (typeof obj.unit === "string" && obj.unit.trim() ? obj.unit.trim() : "Piece") as Ingredient["unit"],
      currentStock: Number(obj.currentStock) || 0,
      onHandStock: obj.onHandStock != null ? Number(obj.onHandStock) : undefined,
      storeStock: obj.storeStock != null ? Number(obj.storeStock) : undefined,
      kitchenStock: obj.kitchenStock != null ? Number(obj.kitchenStock) : undefined,
      kitchenSections: Array.isArray(obj.kitchenSections)
        ? (obj.kitchenSections as Ingredient["kitchenSections"])
        : undefined,
      minStock: Number(obj.minStock) || 0,
      reorderLevel: Number(obj.reorderLevel) || 0,
      maxStock: Number(obj.maxStock) || 0,
      unitCost: Number(obj.unitCost) || 0,
    });
  }
  return out;
}

export async function fetchBranchInventory(branchCode: string): Promise<BranchInventory> {
  const params = new URLSearchParams({ branchCode });
  const res = await authFetch(`/v1/inventory?${params}`);
  if (!res.ok) await parseError(res, "Inventory failed");
  const raw: unknown = await res.json();
  const parsed = branchInventorySchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Keep inventory screens usable when one nested field is unexpected.
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fallback = branchInventorySchema.safeParse({
    branchCode: typeof obj.branchCode === "string" ? obj.branchCode : branchCode,
    categories: Array.isArray(obj.categories) ? obj.categories : [],
    ingredients: softParseIngredients(obj.ingredients),
    suppliers: Array.isArray(obj.suppliers) ? obj.suppliers : [],
    purchaseOrders: Array.isArray(obj.purchaseOrders) ? obj.purchaseOrders : [],
    goodsReceipts: Array.isArray(obj.goodsReceipts) ? obj.goodsReceipts : [],
    stockBatches: Array.isArray(obj.stockBatches) ? obj.stockBatches : [],
    recipes: softParseRecipes(obj.recipes),
    adjustments: Array.isArray(obj.adjustments) ? obj.adjustments : [],
    wasteRecords: Array.isArray(obj.wasteRecords) ? obj.wasteRecords : [],
    stockCounts: Array.isArray(obj.stockCounts) ? obj.stockCounts : [],
    auditLogs: Array.isArray(obj.auditLogs) ? obj.auditLogs : [],
  });
  if (fallback.success) return fallback.data;
  throw new Error("Inventory response could not be read. Reopen Inventory or sign in again.");
}

/** POS sale check: prefer lightweight sale-check API, then soft full inventory. */
export async function fetchBranchInventoryForPos(
  branchCode: string,
): Promise<{ recipes: Recipe[]; ingredients: Ingredient[] }> {
  const params = new URLSearchParams({ branchCode });

  try {
    const light = await authFetch(`/v1/inventory/sale-check?${params}`);
    // 404 = older API without sale-check — fall through. Other errors also fall through.
    if (light.ok) {
      const raw: unknown = await light.json();
      const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      return {
        recipes: softParseRecipes(obj.recipes),
        ingredients: softParseIngredients(obj.ingredients),
      };
    }
  } catch {
    /* fall through to full inventory */
  }

  try {
    const res = await authFetch(`/v1/inventory?${params}`);
    if (!res.ok) await parseError(res, "Inventory failed");
    const raw: unknown = await res.json();
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
      recipes: softParseRecipes(obj.recipes),
      ingredients: softParseIngredients(obj.ingredients),
    };
  } catch (err) {
    // Last resort: empty snapshot (POS add-time / pay-time handle missing data).
    throw err instanceof Error ? err : new Error("Inventory failed");
  }
}

export async function fetchInventoryReport(
  branchCode: string,
  reportId: string,
  options?: {
    filterDate?: string;
    dateFrom?: string;
    dateTo?: string;
    dateMode?: "activity" | "expiry" | "order";
    cookingUnitId?: string;
  },
): Promise<InventoryReport> {
  const params = new URLSearchParams({ branchCode });
  if (options?.filterDate) params.set("filterDate", options.filterDate);
  if (options?.dateFrom) params.set("dateFrom", options.dateFrom);
  if (options?.dateTo) params.set("dateTo", options.dateTo);
  if (options?.dateMode) params.set("dateMode", options.dateMode);
  if (options?.cookingUnitId) params.set("cookingUnitId", options.cookingUnitId);
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

export async function updatePurchaseOrder(
  poId: string,
  input: UpdatePurchaseOrder,
): Promise<PurchaseOrder> {
  const res = await authFetch(`/v1/inventory/purchase-orders/${poId}`, {
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
  { id: "stock-transfers", name: "Cooking unit transfer history", category: "Inventory" as const },
  { id: "stock-transfers-by-section", name: "Cooking unit transfer report", category: "Inventory" as const },
  { id: "consumption", name: "Ingredient Consumption", category: "Restaurant" as const },
  { id: "recipe-cost", name: "Recipe Cost", category: "Restaurant" as const },
  { id: "waste", name: "Waste Analysis", category: "Restaurant" as const },
  { id: "cooking-unit-stock", name: "Cooking unit stock in hand", category: "Restaurant" as const },
  { id: "purchases", name: "Purchase Report", category: "Purchase" as const },
  { id: "suppliers", name: "Supplier Report", category: "Supplier" as const },
];

export type { StockBatch } from "@platform/contracts";
export { stockBatchSchema, inventoryAuditLogSchema };
