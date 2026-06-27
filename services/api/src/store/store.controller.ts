import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  createStoreBrandSchema,
  createStoreCategorySchema,
  createStoreCustomerSchema,
  createStoreGrnSchema,
  createStoreProductSchema,
  createStorePurchaseOrderSchema,
  createStorePurchaseRequisitionSchema,
  createStoreSaleSchema,
  createStoreStockAdjustmentSchema,
  createStoreStockAuditSchema,
  createStoreStockTransferSchema,
  createStoreSupplierSchema,
  createStoreUnitSchema,
  createStoreWarehouseSchema,
  stockMovementSchema,
} from "@platform/contracts";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AccessJwtPayload } from "../auth/jwt.types";
import { PermissionsGuard } from "../users/permissions.guard";
import { RequirePermissions } from "../users/require-permission.decorator";
import { StoreService } from "./store.service";

@Controller("v1/store")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Get("dashboard")
  @RequirePermissions("pops.read")
  getDashboard(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.getDashboard(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("categories")
  @RequirePermissions("pops.read")
  listCategories(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listCategories(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("categories")
  @RequirePermissions("pops.inventory.manage")
  createCategory(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createCategory(user.organizationId, createStoreCategorySchema.parse(body));
  }

  @Get("brands")
  @RequirePermissions("pops.read")
  listBrands(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listBrands(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("brands")
  @RequirePermissions("pops.inventory.manage")
  createBrand(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createBrand(user.organizationId, createStoreBrandSchema.parse(body));
  }

  @Get("units")
  @RequirePermissions("pops.read")
  listUnits(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listUnits(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("units")
  @RequirePermissions("pops.inventory.manage")
  createUnit(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createUnit(user.organizationId, createStoreUnitSchema.parse(body));
  }

  @Get("products")
  @RequirePermissions("pops.read")
  listProducts(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listProducts(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("products")
  @RequirePermissions("pops.inventory.manage")
  createProduct(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createProduct(user.organizationId, createStoreProductSchema.parse(body));
  }

  @Delete("products/:productId")
  @RequirePermissions("pops.inventory.manage")
  deleteProduct(@CurrentUser() user: AccessJwtPayload, @Param("productId") productId: string) {
    return this.store.deleteProduct(user.organizationId, productId);
  }

  @Get("batches")
  @RequirePermissions("pops.read")
  listBatches(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listBatches(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("inventory/movement")
  @RequirePermissions("pops.inventory.manage")
  recordMovement(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.recordStockMovement(user.organizationId, stockMovementSchema.parse(body));
  }

  @Get("inventory/transactions")
  @RequirePermissions("pops.read")
  listTransactions(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listInventoryTransactions(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("suppliers")
  @RequirePermissions("pops.read")
  listSuppliers(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listSuppliers(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("suppliers")
  @RequirePermissions("pops.inventory.manage")
  createSupplier(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createSupplier(user.organizationId, createStoreSupplierSchema.parse(body));
  }

  @Get("customers")
  @RequirePermissions("pops.read")
  listCustomers(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listCustomers(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("customers")
  @RequirePermissions("pops.read")
  createCustomer(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createCustomer(user.organizationId, createStoreCustomerSchema.parse(body));
  }

  @Get("warehouses")
  @RequirePermissions("pops.read")
  listWarehouses(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listWarehouses(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("warehouses")
  @RequirePermissions("pops.inventory.manage")
  createWarehouse(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createWarehouse(user.organizationId, createStoreWarehouseSchema.parse(body));
  }

  @Get("purchase/requisitions")
  @RequirePermissions("pops.read")
  listRequisitions(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listPurchaseRequisitions(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("purchase/requisitions")
  @RequirePermissions("pops.inventory.manage")
  createRequisition(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createPurchaseRequisition(user.organizationId, createStorePurchaseRequisitionSchema.parse(body));
  }

  @Get("purchase/orders")
  @RequirePermissions("pops.read")
  listPurchaseOrders(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listPurchaseOrders(user.organizationId, branchCode?.trim() ?? "");
  }

  @Get("purchase/orders/:orderId")
  @RequirePermissions("pops.read")
  getPurchaseOrder(@CurrentUser() user: AccessJwtPayload, @Param("orderId") orderId: string) {
    return this.store.getPurchaseOrder(user.organizationId, orderId);
  }

  @Post("purchase/orders")
  @RequirePermissions("pops.inventory.manage")
  createPurchaseOrder(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createPurchaseOrder(user.organizationId, createStorePurchaseOrderSchema.parse(body));
  }

  @Patch("purchase/orders/:orderId/approve")
  @RequirePermissions("pops.inventory.manage")
  approvePurchaseOrder(@CurrentUser() user: AccessJwtPayload, @Param("orderId") orderId: string) {
    return this.store.approvePurchaseOrder(user.organizationId, orderId);
  }

  @Get("purchase/grn")
  @RequirePermissions("pops.read")
  listGrn(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listGrn(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("purchase/grn")
  @RequirePermissions("pops.inventory.manage")
  createGrn(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createGrn(user.organizationId, createStoreGrnSchema.parse(body));
  }

  @Get("transfers")
  @RequirePermissions("pops.read")
  listTransfers(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listStockTransfers(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("transfers")
  @RequirePermissions("pops.inventory.manage")
  createTransfer(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createStockTransfer(user.organizationId, createStoreStockTransferSchema.parse(body));
  }

  @Patch("transfers/:transferId/complete")
  @RequirePermissions("pops.inventory.manage")
  completeTransfer(@CurrentUser() user: AccessJwtPayload, @Param("transferId") transferId: string) {
    return this.store.completeStockTransfer(user.organizationId, transferId);
  }

  @Get("adjustments")
  @RequirePermissions("pops.read")
  listAdjustments(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listStockAdjustments(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("adjustments")
  @RequirePermissions("pops.inventory.manage")
  createAdjustment(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createStockAdjustment(user.organizationId, createStoreStockAdjustmentSchema.parse(body));
  }

  @Patch("adjustments/:adjustmentId/approve")
  @RequirePermissions("pops.inventory.manage")
  approveAdjustment(@CurrentUser() user: AccessJwtPayload, @Param("adjustmentId") adjustmentId: string) {
    return this.store.approveStockAdjustment(user.organizationId, adjustmentId);
  }

  @Get("audits")
  @RequirePermissions("pops.read")
  listAudits(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listStockAudits(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("audits")
  @RequirePermissions("pops.inventory.manage")
  createAudit(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createStockAudit(user.organizationId, createStoreStockAuditSchema.parse(body));
  }

  @Patch("audits/:auditId/approve")
  @RequirePermissions("pops.inventory.manage")
  approveAudit(@CurrentUser() user: AccessJwtPayload, @Param("auditId") auditId: string) {
    return this.store.approveStockAudit(user.organizationId, auditId);
  }

  @Get("sales")
  @RequirePermissions("pops.read")
  listSales(@CurrentUser() user: AccessJwtPayload, @Query("branchCode") branchCode: string) {
    return this.store.listSales(user.organizationId, branchCode?.trim() ?? "");
  }

  @Post("sales")
  @RequirePermissions("pops.read")
  createSale(@CurrentUser() user: AccessJwtPayload, @Body() body: unknown) {
    return this.store.createSale(user.organizationId, createStoreSaleSchema.parse(body));
  }

  @Get("reports/stock")
  @RequirePermissions("pops.read")
  getStockReport(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.store.getStockReport(user.organizationId, branchCode?.trim() ?? "", from?.trim(), to?.trim());
  }

  @Get("reports/profit-loss")
  @RequirePermissions("pops.read")
  getProfitLoss(
    @CurrentUser() user: AccessJwtPayload,
    @Query("branchCode") branchCode: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.store.getProfitLoss(user.organizationId, branchCode?.trim() ?? "", from?.trim(), to?.trim());
  }
}
