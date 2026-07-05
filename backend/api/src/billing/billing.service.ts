import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { CompleteBill, CreateBill, UpdateBill } from "@platform/contracts";
import {
  organizationMemberships,
  popsBills,
  popsBranches,
  popsRiders,
  users,
  type PlatformPgDb,
} from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { AccountingHooksService } from "../accounting/accounting-hooks.service";
import { ClosingService } from "../closing/closing.service";
import { InventoryDeductionService } from "../inventory/inventory-deduction.service";

type BillTotals = {
  subtotal: number;
  discount: number;
  service: number;
  servicePct: number;
  tax: number;
  taxPct: number;
  deliveryCharge: number;
  total: number;
};

@Injectable()
export class BillingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly inventoryDeduction: InventoryDeductionService,
    private readonly accountingHooks: AccountingHooksService,
    private readonly closing: ClosingService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.seedSampleBillsIfEmpty();
    } catch (err) {
      this.logger.warn(
        `Bill seed skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async seedSampleBillsIfEmpty(): Promise<void> {
    const existing = await this.db.select({ id: popsBills.id }).from(popsBills).limit(1);
    if (existing.length > 0) return;

    const branches = await this.db.select().from(popsBranches);
    for (const branch of branches) {
      const sampleLines = [
        { label: "Chicken Karahi (Full)", qty: 1, unitPrice: 2890 },
        { label: "Raita", qty: 2, unitPrice: 80 },
      ];
      const subtotal = 3050;
      const servicePct = 10;
      const taxPct = 15;
      const service = 305;
      const tax = 503;
      await this.db.insert(popsBills).values({
        organizationId: branch.organizationId,
        branchId: branch.id,
        billRef: `BILL-${branch.code}-SEED`,
        orderRef: "ORD-1042",
        tableLabel: "T1",
        waiterId: null,
        waiterName: "Waiter 1",
        linesJson: JSON.stringify(sampleLines),
        notes: "Sample completed order",
        subtotalPkr: subtotal,
        discountPkr: 0,
        servicePkr: service,
        servicePct,
        taxPkr: tax,
        taxPct,
        totalPkr: subtotal + service + tax,
        paymentsJson: JSON.stringify([{ method: "cash", amount: subtotal + service + tax }]),
        status: "completed",
        createdAt: new Date(Date.now() - 45 * 60_000),
      });
    }
  }

  async listWaiters(organizationId: string) {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          eq(organizationMemberships.role, "waiter"),
        ),
      )
      .orderBy(users.email);

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: waiterDisplayName(row.email),
    }));
  }

  async listOrders(organizationId: string, branchCode: string) {
    const branch = await this.resolveBranch(organizationId, branchCode);
    const rows = await this.db
      .select()
      .from(popsBills)
      .where(
        and(
          eq(popsBills.branchId, branch.id),
          ne(popsBills.status, "void"),
        ),
      )
      .orderBy(desc(popsBills.createdAt));

    const riderNames = await this.loadRiderNames(
      rows.map((row) => row.riderId).filter((id): id is string => Boolean(id)),
    );

    return {
      branchCode: branch.code,
      orders: rows.map((row) =>
        this.mapBill(row, row.riderId ? (riderNames.get(row.riderId) ?? null) : null),
      ),
    };
  }

  async createBill(organizationId: string, input: CreateBill) {
    const branch = await this.resolveBranch(organizationId, input.branchCode);
    await this.closing.assertOrdersNotPaused(branch.id);
    if (input.tableLabel.trim().toLowerCase().includes("delivery") && !input.riderId) {
      throw new BadRequestException("A rider is required for delivery orders.");
    }
    const waiter = await this.resolveWaiterInfo(organizationId, input);
    const status = input.status ?? "completed";
    const totals = this.computeBillTotals(input);

    if (status === "completed") {
      const payments = this.normalizePayments(input.payments, totals.total);
      this.assertPaymentsCoverTotal(payments, totals.total);
      return this.insertBill(organizationId, branch.id, input, waiter, totals, status, payments);
    }

    return this.insertBill(organizationId, branch.id, input, waiter, totals, status, []);
  }

  async completeBill(organizationId: string, billId: string, input: CompleteBill) {
    const rows = await this.db
      .select()
      .from(popsBills)
      .where(eq(popsBills.id, billId))
      .limit(1);
    const existing = rows[0];
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException("Bill not found");
    }
    if (existing.status !== "held") {
      throw new BadRequestException("Only held bills can be completed");
    }

    const servicePct = input.servicePct ?? existing.servicePct;
    const taxPct = input.taxPct ?? existing.taxPct;
    const totals = this.computeBillTotalsFromAmounts(
      existing.subtotalPkr,
      existing.discountPkr,
      servicePct,
      taxPct,
      existing.deliveryChargePkr,
    );
    const payments = this.normalizePayments(input.payments, totals.total);
    this.assertPaymentsCoverTotal(payments, totals.total);

    const [row] = await this.db
      .update(popsBills)
      .set({
        servicePkr: totals.service,
        servicePct: totals.servicePct,
        taxPkr: totals.tax,
        taxPct: totals.taxPct,
        totalPkr: totals.total,
        paymentsJson: JSON.stringify(payments),
        status: "completed",
      })
      .where(eq(popsBills.id, billId))
      .returning();

    if (!row) throw new NotFoundException("Bill not found");

    await this.finalizeCompletedBill(organizationId, row);
    return this.mapBill(row);
  }

  async updateBill(organizationId: string, billId: string, input: UpdateBill) {
    const rows = await this.db
      .select()
      .from(popsBills)
      .where(eq(popsBills.id, billId))
      .limit(1);
    const existing = rows[0];
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException("Bill not found");
    }
    if (existing.status !== "held") {
      throw new BadRequestException("Only held bills can be edited");
    }

    const existingLines = this.parseBillLines(existing.linesJson);
    const lines = input.lines ?? existingLines;
    if (lines.length === 0) {
      throw new BadRequestException("Bill must include at least one item");
    }

    const nextTableLabel = input.tableLabel?.trim() ?? existing.tableLabel;
    const nextRiderId = input.riderId !== undefined ? input.riderId : existing.riderId;
    if (nextTableLabel.toLowerCase().includes("delivery") && !nextRiderId) {
      throw new BadRequestException("A rider is required for delivery orders.");
    }

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const servicePct = input.servicePct ?? existing.servicePct;
    const taxPct = input.taxPct ?? existing.taxPct;
    const deliveryCharge = input.deliveryChargePkr ?? existing.deliveryChargePkr;
    let discount = existing.discountPkr;
    if (input.discountPkr != null) {
      discount = Math.min(Math.round(input.discountPkr), subtotal);
    } else if (input.discountPct != null) {
      discount = Math.round(subtotal * (input.discountPct / 100));
    } else if (input.lines !== undefined) {
      const prevSubtotal = existing.subtotalPkr;
      discount =
        prevSubtotal > 0
          ? Math.min(Math.round((existing.discountPkr / prevSubtotal) * subtotal), subtotal)
          : 0;
    }

    const totals = this.computeBillTotalsFromAmounts(
      subtotal,
      discount,
      servicePct,
      taxPct,
      deliveryCharge,
    );

    const [row] = await this.db
      .update(popsBills)
      .set({
        ...(input.tableLabel !== undefined ? { tableLabel: input.tableLabel.trim() } : {}),
        linesJson: JSON.stringify(lines),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        subtotalPkr: totals.subtotal,
        discountPkr: totals.discount,
        servicePkr: totals.service,
        servicePct: totals.servicePct,
        taxPkr: totals.tax,
        taxPct: totals.taxPct,
        totalPkr: totals.total,
        ...(input.riderId !== undefined ? { riderId: input.riderId } : {}),
        deliveryChargePkr: totals.deliveryCharge,
      })
      .where(eq(popsBills.id, billId))
      .returning();

    if (!row) throw new NotFoundException("Bill not found");
    return this.mapBill(row);
  }

  private parseBillLines(linesJson: string | null): CreateBill["lines"] {
    if (!linesJson) return [];
    try {
      const parsed = JSON.parse(linesJson) as CreateBill["lines"];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async insertBill(
    organizationId: string,
    branchId: string,
    input: CreateBill,
    waiter: { id: string | null; name: string },
    totals: BillTotals,
    status: "held" | "completed" | "void" | "open",
    payments: { method: string; amount: number }[],
  ) {
    const billRef = `BILL-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    const [row] = await this.db
      .insert(popsBills)
      .values({
        organizationId,
        branchId,
        billRef,
        orderRef: input.orderRef?.trim() || null,
        tableLabel: input.tableLabel.trim(),
        waiterId: waiter.id,
        waiterName: waiter.name,
        linesJson: JSON.stringify(input.lines),
        notes: input.notes?.trim() || null,
        subtotalPkr: totals.subtotal,
        discountPkr: totals.discount,
        servicePkr: totals.service,
        servicePct: totals.servicePct,
        taxPkr: totals.tax,
        taxPct: totals.taxPct,
        totalPkr: totals.total,
        paymentsJson: payments.length > 0 ? JSON.stringify(payments) : null,
        splitGroupRef: input.splitGroupRef?.trim() || null,
        riderId: input.riderId ?? null,
        deliveryChargePkr: totals.deliveryCharge,
        status,
      })
      .returning();

    if (!row) throw new BadRequestException("Failed to create bill");

    if (status === "completed") {
      await this.finalizeCompletedBill(organizationId, row);
    }

    return this.mapBill(row);
  }

  private async finalizeCompletedBill(
    organizationId: string,
    row: typeof popsBills.$inferSelect,
  ): Promise<void> {
    try {
      await this.inventoryDeduction.deductForCompletedBill(organizationId, row);
    } catch (err) {
      this.logger.warn(
        `Inventory deduction failed for ${row.billRef}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    try {
      await this.accountingHooks.recordSaleFromBill(organizationId, row.branchId, row);
    } catch (err) {
      this.logger.warn(
        `Accounting entry failed for ${row.billRef}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private computeBillTotals(input: CreateBill): BillTotals {
    const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const servicePct = input.servicePct ?? 10;
    const taxPct = input.taxPct ?? 15;
    const discount =
      input.discountPkr != null && input.discountPkr > 0
        ? Math.min(Math.round(input.discountPkr), subtotal)
        : Math.round(subtotal * ((input.discountPct ?? 0) / 100));
    const deliveryCharge = input.deliveryChargePkr ?? 0;
    return this.computeBillTotalsFromAmounts(subtotal, discount, servicePct, taxPct, deliveryCharge);
  }

  private computeBillTotalsFromAmounts(
    subtotal: number,
    discount: number,
    servicePct: number,
    taxPct: number,
    deliveryCharge = 0,
  ): BillTotals {
    const afterDisc = subtotal - discount;
    const service = Math.round(afterDisc * (servicePct / 100));
    const tax = Math.round((afterDisc + service) * (taxPct / 100));
    const total = afterDisc + service + tax + deliveryCharge;
    return { subtotal, discount, service, servicePct, tax, taxPct, deliveryCharge, total };
  }

  private normalizePayments(
    payments: CreateBill["payments"] | CompleteBill["payments"] | undefined,
    total: number,
  ) {
    if (!payments || payments.length === 0) {
      return [{ method: "cash" as const, amount: total }];
    }
    return payments
      .filter((p) => p.amount > 0)
      .map((p) => ({ method: p.method, amount: Math.round(p.amount) }));
  }

  private assertPaymentsCoverTotal(
    payments: { method: string; amount: number }[],
    total: number,
  ): void {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    if (paid < total) {
      throw new BadRequestException(`Payments (Rs ${paid}) do not cover bill total (Rs ${total})`);
    }
  }

  private async loadRiderNames(riderIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(riderIds)];
    if (unique.length === 0) return new Map();

    const rows = await this.db
      .select({ id: popsRiders.id, name: popsRiders.name })
      .from(popsRiders)
      .where(inArray(popsRiders.id, unique));

    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private mapBill(row: typeof popsBills.$inferSelect, riderName: string | null = null) {
    const lines = JSON.parse(row.linesJson) as CreateBill["lines"];
    let payments: { method: string; amount: number }[] = [];
    if (row.paymentsJson) {
      try {
        payments = JSON.parse(row.paymentsJson) as { method: string; amount: number }[];
      } catch {
        payments = [];
      }
    }
    return {
      id: row.id,
      billRef: row.billRef,
      orderRef: row.orderRef,
      tableLabel: row.tableLabel,
      waiterId: row.waiterId,
      waiterName: row.waiterName,
      lines,
      notes: row.notes,
      subtotal: row.subtotalPkr,
      discount: row.discountPkr,
      service: row.servicePkr,
      servicePct: row.servicePct,
      tax: row.taxPkr,
      taxPct: row.taxPct,
      total: row.totalPkr,
      payments,
      splitGroupRef: row.splitGroupRef ?? null,
      riderId: row.riderId,
      riderName,
      deliveryChargePkr: row.deliveryChargePkr,
      status: row.status as "held" | "completed" | "void" | "open",
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async resolveBranch(organizationId: string, branchCode: string) {
    const code = branchCode.trim();
    const rows = await this.db
      .select()
      .from(popsBranches)
      .where(and(eq(popsBranches.organizationId, organizationId), eq(popsBranches.code, code)))
      .limit(1);
    const branch = rows[0];
    if (!branch) throw new NotFoundException(`Branch not found: ${code}`);
    return branch;
  }

  private async resolveWaiterInfo(
    organizationId: string,
    input: CreateBill,
  ): Promise<{ id: string | null; name: string }> {
    if (input.waiterId) {
      const rows = await this.db
        .select({
          id: users.id,
          email: users.email,
        })
        .from(organizationMemberships)
        .innerJoin(users, eq(users.id, organizationMemberships.userId))
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.role, "waiter"),
            eq(users.id, input.waiterId),
          ),
        )
        .limit(1);

      const row = rows[0];
      if (!row) throw new NotFoundException("Waiter not found");
      return { id: row.id, name: waiterDisplayName(row.email) };
    }

    return {
      id: null,
      name: input.waiterName?.trim() || "POS Counter",
    };
  }
}

function waiterDisplayName(email: string): string {
  const local = email.split("@")[0] ?? email;
  const words = local.replace(/[._-]+/g, " ").trim().split(/\s+/);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
