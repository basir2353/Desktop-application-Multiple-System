import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, gte, sql } from "drizzle-orm";
import type { BillLine } from "@platform/contracts";
import {
  popsBills,
  popsIngredients,
  popsInventoryAuditLogs,
  popsMenuItems,
  popsMenuCategories,
  popsRecipeLines,
  popsRecipes,
  storeProducts,
  storeCookingUnitStock,
  storeCookingUnits,
  storeWarehouseStock,
  storeWarehouses,
  type PlatformPgDb,
} from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { AccountingHooksService } from "../accounting/accounting-hooks.service";

@Injectable()
export class InventoryDeductionService {
  private readonly logger = new Logger(InventoryDeductionService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly accountingHooks: AccountingHooksService,
  ) {}

  async deductForCompletedBill(
    organizationId: string,
    bill: typeof popsBills.$inferSelect,
    actorEmail = "pos@system",
  ): Promise<void> {
    if (bill.inventoryDeductedAt || bill.status !== "completed") return;

    let lines: BillLine[];
    try {
      lines = JSON.parse(bill.linesJson) as BillLine[];
    } catch {
      throw new BadRequestException(`Bill ${bill.billRef} has invalid line data`);
    }
    if (!Array.isArray(lines) || lines.length === 0) return;

    const menuItems = await this.db
      .select({
        id: popsMenuItems.id,
        name: popsMenuItems.name,
        portion: popsMenuItems.portion,
        categoryId: popsMenuItems.categoryId,
      })
      .from(popsMenuItems)
      .where(and(eq(popsMenuItems.branchId, bill.branchId), eq(popsMenuItems.isActive, true)));
    const menuCategories = await this.db
      .select({
        id: popsMenuCategories.id,
        cookingUnitId: popsMenuCategories.cookingUnitId,
      })
      .from(popsMenuCategories)
      .where(and(eq(popsMenuCategories.branchId, bill.branchId), eq(popsMenuCategories.isActive, true)));
    const activeUnits = await this.db
      .select({ id: storeCookingUnits.id })
      .from(storeCookingUnits)
      .where(and(
        eq(storeCookingUnits.organizationId, organizationId),
        eq(storeCookingUnits.branchId, bill.branchId),
        eq(storeCookingUnits.isActive, true),
      ));
    const activeUnitIds = new Set(activeUnits.map((unit) => unit.id));
    const cookingUnitByCategory = new Map(menuCategories.map((category) => [
      category.id,
      category.cookingUnitId && activeUnitIds.has(category.cookingUnitId) ? category.cookingUnitId : null,
    ]));

    const recipes = await this.db
      .select({
        id: popsRecipes.id,
        menuItemId: popsRecipes.menuItemId,
      })
      .from(popsRecipes)
      .where(
        and(
          eq(popsRecipes.branchId, bill.branchId),
          eq(popsRecipes.organizationId, organizationId),
          eq(popsRecipes.active, true),
        ),
      );

    const recipeByMenuItem = new Map<string, string>();
    for (const recipe of recipes) {
      if (recipe.menuItemId && !recipeByMenuItem.has(recipe.menuItemId)) {
        recipeByMenuItem.set(recipe.menuItemId, recipe.id);
      }
    }

    const recipeLineCache = new Map<string, (typeof popsRecipeLines.$inferSelect)[]>();
    const deductions = new Map<string, { ingredientId: string; cookingUnitId: string | null; qty: number }>();
    const detailParts: string[] = [];
    let cogsTotal = 0;

    for (const line of lines) {
      const menuItemId = this.resolveMenuItemId(line, menuItems);
      if (!menuItemId) {
        throw new BadRequestException(`Menu item for "${line.label}" could not be matched`);
      }

      const recipeId = recipeByMenuItem.get(menuItemId);
      if (!recipeId) {
        throw new BadRequestException(`No active recipe is configured for "${line.label}"`);
      }

      let recipeLines = recipeLineCache.get(recipeId);
      if (!recipeLines) {
        recipeLines = await this.db
          .select()
          .from(popsRecipeLines)
          .where(eq(popsRecipeLines.recipeId, recipeId));
        recipeLineCache.set(recipeId, recipeLines);
      }

      const cookingUnitId = cookingUnitByCategory.get(
        menuItems.find((item) => item.id === menuItemId)?.categoryId ?? "",
      ) ?? null;
      for (const recipeLine of recipeLines) {
        const deductQty = recipeLine.qty * line.qty;
        const key = `${recipeLine.ingredientId}:${cookingUnitId ?? "unassigned"}`;
        const previous = deductions.get(key);
        deductions.set(key, {
          ingredientId: recipeLine.ingredientId,
          cookingUnitId,
          qty: (previous?.qty ?? 0) + deductQty,
        });
      }
      detailParts.push(`${line.label} x${line.qty}`);
    }

    if (deductions.size === 0) {
      await this.db
        .update(popsBills)
        .set({ inventoryDeductedAt: new Date() })
        .where(eq(popsBills.id, bill.id));
      return;
    }

    const ingredientRows = new Map<string, typeof popsIngredients.$inferSelect>();
    const stockUpdates: {
      ingredient: typeof popsIngredients.$inferSelect;
      qty: number;
      newStock: number;
      unitCost: number;
      warehouseStockId?: string;
      cookingUnitId: string | null;
      cookingUnitStockId?: string;
      newCookingUnitStock?: number;
    }[] = [];
    const kitchenRows = await this.db
      .select({ id: storeWarehouses.id })
      .from(storeWarehouses)
      .where(and(eq(storeWarehouses.branchId, bill.branchId), eq(storeWarehouses.code, "KITCHEN")))
      .limit(1);
    const kitchenWarehouseId = kitchenRows[0]?.id;

    const ingredientRemaining = new Map<string, number>();
    const warehouseRemaining = new Map<string, number>();
    for (const deduction of deductions.values()) {
      const { ingredientId, cookingUnitId, qty } = deduction;
      const ingRows = await this.db
        .select()
        .from(popsIngredients)
        .where(
          and(
            eq(popsIngredients.id, ingredientId),
            eq(popsIngredients.organizationId, organizationId),
          ),
        )
        .limit(1);
      const ing = ingRows[0];
      if (!ing) throw new BadRequestException("Recipe ingredient no longer exists");
      ingredientRows.set(ingredientId, ing);

      const remaining = ingredientRemaining.get(ingredientId) ?? ing.currentStock;
      let newStock = remaining - qty;
      let unitCost = ing.unitCostPkr;
      let warehouseStockId: string | undefined;
      let cookingUnitStockId: string | undefined;
      let newCookingUnitStock: number | undefined;
      if (ing.storeProductId) {
        if (!kitchenWarehouseId) throw new BadRequestException("Kitchen warehouse is not configured");
        const [warehouseStock] = await this.db
          .select()
          .from(storeWarehouseStock)
          .where(and(
            eq(storeWarehouseStock.warehouseId, kitchenWarehouseId),
            eq(storeWarehouseStock.productId, ing.storeProductId),
          ))
          .limit(1);
        const remainingWarehouseQty =
          warehouseRemaining.get(ing.storeProductId) ?? warehouseStock?.quantity ?? 0;
        if (!warehouseStock || remainingWarehouseQty < qty) {
          throw new BadRequestException(`Insufficient Kitchen stock for ${ing.name}: need ${qty} ${ing.unit}`);
        }
        newStock = remainingWarehouseQty - qty;
        warehouseRemaining.set(ing.storeProductId, newStock);
        unitCost = warehouseStock.unitCostPkr || ing.unitCostPkr;
        warehouseStockId = warehouseStock.id;
        if (cookingUnitId) {
          const [unitStock] = await this.db
            .select()
            .from(storeCookingUnitStock)
            .where(and(
              eq(storeCookingUnitStock.cookingUnitId, cookingUnitId),
              eq(storeCookingUnitStock.productId, ing.storeProductId),
            ))
            .limit(1);
          if (!unitStock || unitStock.quantity < qty) {
            throw new BadRequestException(`Insufficient Cooking Unit stock for ${ing.name}: need ${qty} ${ing.unit}`);
          }
          cookingUnitStockId = unitStock.id;
          newCookingUnitStock = unitStock.quantity - qty;
          unitCost = unitStock.unitCostPkr || unitCost;
        }
      } else if (newStock < 0) {
        throw new BadRequestException(`Insufficient Kitchen stock for ${ing.name}: need ${qty} ${ing.unit}`);
      }
      ingredientRemaining.set(ingredientId, newStock);
      stockUpdates.push({
        ingredient: ing,
        qty,
        newStock,
        unitCost,
        warehouseStockId,
        cookingUnitId,
        cookingUnitStockId,
        newCookingUnitStock,
      });
      cogsTotal += Math.round(qty * unitCost);
    }

    await this.db.transaction(async (tx) => {
      for (const update of stockUpdates) {
        if (update.cookingUnitStockId && update.newCookingUnitStock !== undefined) {
          const [unitStock] = await tx
            .update(storeCookingUnitStock)
            .set({
              quantity: update.newCookingUnitStock,
              updatedAt: new Date(),
            })
            .where(and(
              eq(storeCookingUnitStock.id, update.cookingUnitStockId),
              gte(storeCookingUnitStock.quantity, update.qty),
            ))
            .returning({ id: storeCookingUnitStock.id });
          if (!unitStock) {
            throw new BadRequestException(`Cooking Unit stock changed for ${update.ingredient.name}`);
          }
        }
        if (update.warehouseStockId) {
          await tx
            .update(storeWarehouseStock)
            .set({ quantity: update.newStock, updatedAt: new Date() })
            .where(eq(storeWarehouseStock.id, update.warehouseStockId));
          const product = ingredientRows.get(update.ingredient.id)?.storeProductId;
          if (product) {
            const totals = await tx
              .select({ quantity: storeWarehouseStock.quantity })
              .from(storeWarehouseStock)
              .where(eq(storeWarehouseStock.productId, product));
            await tx.update(storeProducts)
              .set({ availableStock: totals.reduce((sum, row) => sum + row.quantity, 0) })
              .where(eq(storeProducts.id, product));
          }
        }
        await tx
          .update(popsIngredients)
          .set({ currentStock: update.newStock, unitCostPkr: update.unitCost })
          .where(eq(popsIngredients.id, update.ingredient.id));

        await tx.insert(popsInventoryAuditLogs).values({
          organizationId,
          branchId: bill.branchId,
          userEmail: actorEmail,
          action: "POS sale deduction",
          module: "Inventory",
          detail: `${bill.billRef}: ${update.ingredient.name} −${update.qty} ${update.ingredient.unit} (${
            update.cookingUnitId ? "Cooking Unit stock" : "Kitchen warehouse"
          }; ${lineSummary(detailParts)})`,
        });
      }
      await tx
        .update(popsBills)
        .set({ inventoryDeductedAt: new Date() })
        .where(eq(popsBills.id, bill.id));
    });

    if (cogsTotal > 0) {
      try {
        await this.accountingHooks.recordCogs(
          organizationId,
          bill.branchId,
          bill.billRef,
          cogsTotal,
          bill.billRef,
        );
      } catch (err) {
        this.logger.warn(
          `COGS entry failed for ${bill.billRef}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async reverseForVoidedBill(
    organizationId: string,
    bill: typeof popsBills.$inferSelect,
    actorEmail = "pos@system",
  ): Promise<void> {
    if (!bill.inventoryDeductedAt || bill.inventoryReversedAt) return;
    let lines: BillLine[];
    try {
      lines = JSON.parse(bill.linesJson) as BillLine[];
    } catch {
      throw new BadRequestException(`Bill ${bill.billRef} has invalid line data`);
    }
    const menuItems = await this.db.select({
      id: popsMenuItems.id,
      name: popsMenuItems.name,
      portion: popsMenuItems.portion,
      categoryId: popsMenuItems.categoryId,
    }).from(popsMenuItems).where(eq(popsMenuItems.branchId, bill.branchId));
    const menuCategories = await this.db.select({
      id: popsMenuCategories.id,
      cookingUnitId: popsMenuCategories.cookingUnitId,
    }).from(popsMenuCategories).where(eq(popsMenuCategories.branchId, bill.branchId));
    const activeUnits = await this.db.select({ id: storeCookingUnits.id }).from(storeCookingUnits).where(and(
      eq(storeCookingUnits.organizationId, organizationId),
      eq(storeCookingUnits.branchId, bill.branchId),
      eq(storeCookingUnits.isActive, true),
    ));
    const activeUnitIds = new Set(activeUnits.map((unit) => unit.id));
    const cookingUnitByCategory = new Map(menuCategories.map((category) => [
      category.id,
      category.cookingUnitId && activeUnitIds.has(category.cookingUnitId) ? category.cookingUnitId : null,
    ]));
    const recipes = await this.db.select({
      id: popsRecipes.id,
      menuItemId: popsRecipes.menuItemId,
    }).from(popsRecipes).where(and(
      eq(popsRecipes.organizationId, organizationId),
      eq(popsRecipes.branchId, bill.branchId),
      eq(popsRecipes.active, true),
    ));
    const recipeByMenuItem = new Map(recipes.filter((recipe) => recipe.menuItemId).map((recipe) => [recipe.menuItemId!, recipe.id]));
    const deductions = new Map<string, { ingredientId: string; cookingUnitId: string | null; qty: number }>();
    for (const line of lines) {
      const menuItemId = this.resolveMenuItemId(line, menuItems);
      const recipeId = menuItemId ? recipeByMenuItem.get(menuItemId) : undefined;
      if (!recipeId) continue;
      const recipeLines = await this.db.select().from(popsRecipeLines).where(eq(popsRecipeLines.recipeId, recipeId));
      const cookingUnitId = cookingUnitByCategory.get(
        menuItems.find((item) => item.id === menuItemId)?.categoryId ?? "",
      ) ?? null;
      for (const recipeLine of recipeLines) {
        const key = `${recipeLine.ingredientId}:${cookingUnitId ?? "unassigned"}`;
        const previous = deductions.get(key);
        deductions.set(key, {
          ingredientId: recipeLine.ingredientId,
          cookingUnitId,
          qty: (previous?.qty ?? 0) + recipeLine.qty * line.qty,
        });
      }
    }
    const [kitchen] = await this.db.select({ id: storeWarehouses.id }).from(storeWarehouses)
      .where(and(eq(storeWarehouses.branchId, bill.branchId), eq(storeWarehouses.code, "KITCHEN"))).limit(1);
    const ingredientRemaining = new Map<string, number>();
    for (const deduction of deductions.values()) {
      const { ingredientId, cookingUnitId, qty } = deduction;
      const [ingredient] = await this.db.select().from(popsIngredients).where(eq(popsIngredients.id, ingredientId)).limit(1);
      if (!ingredient) continue;
      const newIngredientStock = (ingredientRemaining.get(ingredientId) ?? ingredient.currentStock) + qty;
      ingredientRemaining.set(ingredientId, newIngredientStock);
      if (ingredient.storeProductId && kitchen) {
        const [stock] = await this.db.select().from(storeWarehouseStock).where(and(
          eq(storeWarehouseStock.warehouseId, kitchen.id),
          eq(storeWarehouseStock.productId, ingredient.storeProductId),
        )).limit(1);
        if (stock) {
          await this.db.update(storeWarehouseStock)
            .set({ quantity: stock.quantity + qty, updatedAt: new Date() })
            .where(eq(storeWarehouseStock.id, stock.id));
          if (cookingUnitId) {
            const [unitStock] = await this.db.select().from(storeCookingUnitStock).where(and(
              eq(storeCookingUnitStock.cookingUnitId, cookingUnitId),
              eq(storeCookingUnitStock.productId, ingredient.storeProductId),
            )).limit(1);
            if (unitStock) {
              await this.db.update(storeCookingUnitStock)
                .set({ quantity: unitStock.quantity + qty, updatedAt: new Date() })
                .where(eq(storeCookingUnitStock.id, unitStock.id));
            } else {
              await this.db.insert(storeCookingUnitStock).values({
                organizationId,
                branchId: bill.branchId,
                cookingUnitId,
                productId: ingredient.storeProductId,
                quantity: qty,
                unitCostPkr: stock.unitCostPkr || ingredient.unitCostPkr,
              });
            }
          }
          const totals = await this.db.select({ quantity: storeWarehouseStock.quantity })
            .from(storeWarehouseStock).where(eq(storeWarehouseStock.productId, ingredient.storeProductId));
          await this.db.update(storeProducts)
            .set({ availableStock: totals.reduce((sum, row) => sum + row.quantity, 0) })
            .where(eq(storeProducts.id, ingredient.storeProductId));
        }
      }
      await this.db.update(popsIngredients)
        .set({ currentStock: newIngredientStock })
        .where(eq(popsIngredients.id, ingredient.id));
      await this.db.insert(popsInventoryAuditLogs).values({
        organizationId,
        branchId: bill.branchId,
        userEmail: actorEmail,
        action: "POS void reversal",
        module: "Inventory",
        detail: `${bill.billRef}: ${ingredient.name} +${qty} ${ingredient.unit}`,
      });
    }
    await this.db.update(popsBills).set({ inventoryReversedAt: new Date() }).where(eq(popsBills.id, bill.id));
  }

  private resolveMenuItemId(
    line: BillLine,
    menuItems: { id: string; name: string; portion: string | null }[],
  ): string | null {
    if (line.menuItemId) {
      const direct = menuItems.find((m) => m.id === line.menuItemId);
      if (direct) return direct.id;
    }

    const norm = normalizeMenuLabel(line.label);
    const match = menuItems.find((item) => {
      const itemLabel = formatMenuItemLabel(item.name, item.portion);
      return (
        normalizeMenuLabel(itemLabel) === norm ||
        normalizeMenuLabel(item.name) === norm ||
        norm.includes(normalizeMenuLabel(item.name))
      );
    });
    return match?.id ?? null;
  }
}

function lineSummary(parts: string[]): string {
  return parts.slice(0, 3).join(", ") + (parts.length > 3 ? ` +${parts.length - 3} more` : "");
}

function normalizeMenuLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatMenuItemLabel(name: string, portion: string | null): string {
  if (!portion) return name;
  const label = portion.charAt(0).toUpperCase() + portion.slice(1);
  return `${name} (${label})`;
}
