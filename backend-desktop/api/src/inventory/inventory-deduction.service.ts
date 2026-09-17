import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { BillLine } from "@platform/contracts";
import { parseRecipePortionConfig, pickRecipeForSale, recipePortionFactorForLabel } from "@platform/contracts";
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

/** Recipe consume qty with up to 3 decimal places (supports 0.5 Kg Half portions). */
function recipeConsumeQty(recipeQty: number, lineQty: number, portionFactor: number): number {
  const raw = Number(recipeQty) * Number(lineQty) * Number(portionFactor);
  if (!(raw > 0) || !Number.isFinite(raw)) return 0;
  return Math.round(raw * 1000) / 1000;
}

function pickRecipeForBillLine<T extends {
  id: string;
  name?: string | null;
  menuItemId: string | null;
  portionSize: string | null;
  createdAt: Date;
}>(
  recipes: T[],
  menuItemId: string | null,
  lineLabel: string,
  linesByRecipeId: Map<string, unknown[]>,
): T | undefined {
  const newestLast = [...recipes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return pickRecipeForSale(
    newestLast,
    { menuItemId, itemName: lineLabel, lineLabel },
    (recipe) => (linesByRecipeId.get(recipe.id)?.length ?? 0) > 0,
  );
}

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
      .where(eq(popsMenuItems.branchId, bill.branchId));
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
        name: popsRecipes.name,
        menuItemId: popsRecipes.menuItemId,
        portionSize: popsRecipes.portionSize,
        createdAt: popsRecipes.createdAt,
      })
      .from(popsRecipes)
      .where(
        and(
          eq(popsRecipes.branchId, bill.branchId),
          eq(popsRecipes.organizationId, organizationId),
          eq(popsRecipes.active, true),
        ),
      );

    const recipeIds = recipes.map((recipe) => recipe.id);
    const allRecipeLines = recipeIds.length
      ? await this.db.select().from(popsRecipeLines).where(inArray(popsRecipeLines.recipeId, recipeIds))
      : [];
    const recipeLineCache = new Map<string, (typeof popsRecipeLines.$inferSelect)[]>();
    for (const line of allRecipeLines) {
      const list = recipeLineCache.get(line.recipeId) ?? [];
      list.push(line);
      recipeLineCache.set(line.recipeId, list);
    }

    const deductions = new Map<string, { ingredientId: string; cookingUnitId: string | null; qty: number }>();
    const detailParts: string[] = [];
    let cogsTotal = 0;

    for (const line of lines) {
      const menuItemId = this.resolveMenuItemId(line, menuItems);
      const recipe = pickRecipeForBillLine(recipes, menuItemId, line.label, recipeLineCache);
      if (!recipe) {
        // Closing POS must not fail when recipes are not configured yet.
        this.logger.warn(`Skip inventory for "${line.label}" on ${bill.billRef}: no active recipe`);
        continue;
      }

      const recipeLines = recipeLineCache.get(recipe.id) ?? [];

      if (recipeLines.length === 0) {
        this.logger.warn(`Skip inventory for "${line.label}" on ${bill.billRef}: recipe has no ingredients`);
        continue;
      }

      const portion = parseRecipePortionConfig(recipe.portionSize);
      const portionFactor = recipePortionFactorForLabel(line.label, portion.factors, portion.base);

      const cookingUnitId = cookingUnitByCategory.get(
        menuItems.find((item) => item.id === menuItemId)?.categoryId ?? "",
      ) ?? null;
      for (const recipeLine of recipeLines) {
        const deductQty = recipeConsumeQty(recipeLine.qty, line.qty, portionFactor);
        if (deductQty <= 0) continue;
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
      warehouseQty: number;
      newStock: number;
      unitCost: number;
      warehouseStockId?: string;
      warehouseNewQty?: number;
      cookingUnitId: string | null;
      cookingUnitStockId?: string;
      newCookingUnitStock?: number;
    }[] = [];
    const warehouseRows = await this.db
      .select({ id: storeWarehouses.id, code: storeWarehouses.code, name: storeWarehouses.name })
      .from(storeWarehouses)
      .where(eq(storeWarehouses.branchId, bill.branchId));
    const kitchenWarehouseId =
      warehouseRows.find((row) => row.code === "KITCHEN")?.id ??
      warehouseRows.find((row) => /kitchen/i.test(row.name))?.id;

    const ingredientRemaining = new Map<string, number>();
    const warehouseRemaining = new Map<string, number>();
    const cookingUnitRemaining = new Map<string, number>();
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
      if (!ing) {
        this.logger.warn(`Skip inventory on ${bill.billRef}: ingredient ${ingredientId} missing`);
        continue;
      }
      ingredientRows.set(ingredientId, ing);

      const remaining = ingredientRemaining.get(ingredientId) ?? ing.currentStock;
      let unitCost = ing.unitCostPkr;
      let warehouseStockId: string | undefined;
      let warehouseQty = 0;
      let warehouseNewQty: number | undefined;
      let cookingUnitStockId: string | undefined;
      let newCookingUnitStock: number | undefined;

      if (ing.storeProductId) {
        if (!kitchenWarehouseId) {
          this.logger.warn(
            `No Kitchen warehouse on ${bill.billRef}; skip stock deduct for ${ing.name} (will not pull from Store)`,
          );
        } else {
          const stocks = await this.db
            .select({
              id: storeWarehouseStock.id,
              warehouseId: storeWarehouseStock.warehouseId,
              quantity: storeWarehouseStock.quantity,
              unitCostPkr: storeWarehouseStock.unitCostPkr,
              code: storeWarehouses.code,
            })
            .from(storeWarehouseStock)
            .innerJoin(storeWarehouses, eq(storeWarehouseStock.warehouseId, storeWarehouses.id))
            .where(
              and(
                eq(storeWarehouseStock.productId, ing.storeProductId),
                eq(storeWarehouses.branchId, bill.branchId),
                eq(storeWarehouseStock.warehouseId, kitchenWarehouseId),
              ),
            );
          const kitchenStock = stocks
            .map((row) => ({
              ...row,
              remainingQty: warehouseRemaining.get(row.id) ?? row.quantity,
            }))
            .filter((row) => row.remainingQty > 0)
            .sort((a, b) => b.remainingQty - a.remainingQty)[0];

          if (!kitchenStock) {
            this.logger.warn(
              `No Kitchen stock for ${ing.name} on ${bill.billRef}; need ${qty} ${ing.unit}. Transfer from Store→Kitchen first.`,
            );
          } else if (cookingUnitId) {
            // Menu category → kitchen section: deduct ONLY from that section (never steal other sections).
            const [unitStock] = await this.db
              .select()
              .from(storeCookingUnitStock)
              .where(
                and(
                  eq(storeCookingUnitStock.cookingUnitId, cookingUnitId),
                  eq(storeCookingUnitStock.productId, ing.storeProductId),
                  eq(storeCookingUnitStock.branchId, bill.branchId),
                ),
              )
              .limit(1);
            const unitKey = unitStock?.id ?? `${cookingUnitId}:${ing.storeProductId}`;
            const unitAvail = cookingUnitRemaining.get(unitKey) ?? (unitStock?.quantity ?? 0);
            const takeQty = Math.min(qty, unitAvail, kitchenStock.remainingQty);
            if (takeQty <= 0) {
              this.logger.warn(
                `Section stock empty for ${ing.name} on ${bill.billRef}: need ${qty} ${ing.unit} from cooking unit ${cookingUnitId}`,
              );
            } else {
              warehouseQty = takeQty;
              warehouseNewQty = kitchenStock.remainingQty - takeQty;
              warehouseRemaining.set(kitchenStock.id, warehouseNewQty);
              warehouseStockId = kitchenStock.id;
              unitCost = (unitStock?.unitCostPkr || kitchenStock.unitCostPkr || ing.unitCostPkr);
              if (unitStock) {
                cookingUnitStockId = unitStock.id;
                newCookingUnitStock = unitAvail - takeQty;
                cookingUnitRemaining.set(unitKey, newCookingUnitStock);
              }
              if (takeQty < qty) {
                this.logger.warn(
                  `Section short for ${ing.name} on ${bill.billRef}: need ${qty} ${ing.unit}, took ${takeQty} from assigned section`,
                );
              }
            }
          } else {
            // No section on category: only spend Kitchen qty that is not allocated to any section.
            const sectionRows = await this.db
              .select({
                id: storeCookingUnitStock.id,
                quantity: storeCookingUnitStock.quantity,
              })
              .from(storeCookingUnitStock)
              .where(
                and(
                  eq(storeCookingUnitStock.branchId, bill.branchId),
                  eq(storeCookingUnitStock.productId, ing.storeProductId),
                ),
              );
            let sectionHeld = 0;
            for (const row of sectionRows) {
              sectionHeld += cookingUnitRemaining.get(row.id) ?? row.quantity;
            }
            const unassigned = Math.max(0, kitchenStock.remainingQty - sectionHeld);
            const takeQty = Math.min(qty, unassigned);
            if (takeQty <= 0) {
              this.logger.warn(
                `No unassigned Kitchen stock for ${ing.name} on ${bill.billRef}: need ${qty} ${ing.unit} (all qty is in sections)`,
              );
            } else {
              warehouseQty = takeQty;
              warehouseNewQty = kitchenStock.remainingQty - takeQty;
              warehouseRemaining.set(kitchenStock.id, warehouseNewQty);
              warehouseStockId = kitchenStock.id;
              unitCost = kitchenStock.unitCostPkr || ing.unitCostPkr;
              if (takeQty < qty) {
                this.logger.warn(
                  `Unassigned Kitchen short for ${ing.name} on ${bill.billRef}: need ${qty} ${ing.unit}, took ${takeQty}`,
                );
              }
            }
          }
        }
      }

      // Linked products: only deduct what the section/Kitchen actually had. Unlinked: full recipe qty.
      const takeQty = ing.storeProductId ? warehouseQty : qty;
      if (takeQty <= 0) {
        continue;
      }
      // Section-tagged sales must update cooking-unit ledger (or skip if row missing mid-flight).
      if (ing.storeProductId && cookingUnitId && !cookingUnitStockId) {
        this.logger.warn(
          `Skip ${ing.name} on ${bill.billRef}: cooking unit ${cookingUnitId} has no stock row`,
        );
        // Roll back staged kitchen take so we do not orphan warehouse vs section.
        if (warehouseStockId && warehouseNewQty !== undefined) {
          warehouseRemaining.set(warehouseStockId, warehouseNewQty + warehouseQty);
        }
        continue;
      }
      const newStock = remaining - takeQty;
      ingredientRemaining.set(ingredientId, newStock);
      stockUpdates.push({
        ingredient: ing,
        qty: takeQty,
        warehouseQty,
        newStock,
        unitCost,
        warehouseStockId,
        warehouseNewQty,
        cookingUnitId,
        cookingUnitStockId,
        newCookingUnitStock,
      });
      cogsTotal += Math.round(takeQty * unitCost);
    }

    if (stockUpdates.length === 0) {
      await this.db
        .update(popsBills)
        .set({ inventoryDeductedAt: new Date() })
        .where(eq(popsBills.id, bill.id));
      return;
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
              gte(storeCookingUnitStock.quantity, update.warehouseQty),
            ))
            .returning({ id: storeCookingUnitStock.id });
          if (!unitStock) {
            throw new BadRequestException(`Cooking Unit stock changed for ${update.ingredient.name}`);
          }
        }
        if (update.warehouseStockId && update.warehouseNewQty !== undefined) {
          await tx
            .update(storeWarehouseStock)
            .set({ quantity: update.warehouseNewQty, updatedAt: new Date() })
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
            update.cookingUnitId
              ? `section ${update.cookingUnitId.slice(0, 8)}…`
              : update.warehouseStockId
                ? "unassigned kitchen"
                : "ingredient stock"
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
      name: popsRecipes.name,
      menuItemId: popsRecipes.menuItemId,
      portionSize: popsRecipes.portionSize,
      createdAt: popsRecipes.createdAt,
    }).from(popsRecipes).where(and(
      eq(popsRecipes.organizationId, organizationId),
      eq(popsRecipes.branchId, bill.branchId),
      eq(popsRecipes.active, true),
    ));
    const recipeIds = recipes.map((recipe) => recipe.id);
    const allRecipeLines = recipeIds.length
      ? await this.db.select().from(popsRecipeLines).where(inArray(popsRecipeLines.recipeId, recipeIds))
      : [];
    const recipeLineCache = new Map<string, (typeof popsRecipeLines.$inferSelect)[]>();
    for (const recipeLine of allRecipeLines) {
      const list = recipeLineCache.get(recipeLine.recipeId) ?? [];
      list.push(recipeLine);
      recipeLineCache.set(recipeLine.recipeId, list);
    }
    const deductions = new Map<string, { ingredientId: string; cookingUnitId: string | null; qty: number }>();
    for (const line of lines) {
      const menuItemId = this.resolveMenuItemId(line, menuItems);
      const recipe = pickRecipeForBillLine(recipes, menuItemId, line.label, recipeLineCache);
      if (!recipe) continue;
      const recipeLines = recipeLineCache.get(recipe.id) ?? [];
      const portion = parseRecipePortionConfig(recipe.portionSize);
      const portionFactor = recipePortionFactorForLabel(line.label, portion.factors, portion.base);
      const cookingUnitId = cookingUnitByCategory.get(
        menuItems.find((item) => item.id === menuItemId)?.categoryId ?? "",
      ) ?? null;
      for (const recipeLine of recipeLines) {
        const deductQty = recipeConsumeQty(recipeLine.qty, line.qty, portionFactor);
        if (deductQty <= 0) continue;
        const key = `${recipeLine.ingredientId}:${cookingUnitId ?? "unassigned"}`;
        const previous = deductions.get(key);
        deductions.set(key, {
          ingredientId: recipeLine.ingredientId,
          cookingUnitId,
          qty: (previous?.qty ?? 0) + deductQty,
        });
      }
    }
    const warehouses = await this.db.select({ id: storeWarehouses.id, code: storeWarehouses.code, name: storeWarehouses.name })
      .from(storeWarehouses).where(eq(storeWarehouses.branchId, bill.branchId));
    const kitchen =
      warehouses.find((row) => row.code === "KITCHEN") ??
      warehouses.find((row) => /kitchen/i.test(row.name)) ??
      warehouses[0];
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
        const target = stock ?? (await this.db.select().from(storeWarehouseStock).where(
          eq(storeWarehouseStock.productId, ingredient.storeProductId),
        ).limit(1))[0];
        if (target) {
          await this.db.update(storeWarehouseStock)
            .set({ quantity: target.quantity + qty, updatedAt: new Date() })
            .where(eq(storeWarehouseStock.id, target.id));
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
                unitCostPkr: target.unitCostPkr || ingredient.unitCostPkr,
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
