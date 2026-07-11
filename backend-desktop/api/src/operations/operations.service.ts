import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import type { CreatePopsBranch } from "@platform/contracts";
import { and, eq, sql } from "drizzle-orm";
import {
  organizations,
  popsActiveOrders,
  popsAlerts,
  popsBranches,
  popsDailySales,
  popsIngredients,
  popsInventoryItems,
  popsKitchenTickets,
  popsSales,
  type PlatformPgDb,
} from "@platform/database-pg";
import { AccountingService } from "../accounting/accounting.service";
import { BillingService } from "../billing/billing.service";
import { DRIZZLE } from "../drizzle/drizzle.tokens";

type CompletedOrder = Awaited<ReturnType<BillingService["listOrders"]>>["orders"][number];

type BranchSeed = {
  code: string;
  name: string;
  city: string;
  todaySales: number;
  yesterdaySales: number;
  recentSales: { channel: string; ref: string; amountPkr: number; payment: string; minutesAgo: number }[];
  activeOrders: { channel: string; count: number }[];
  kitchen: {
    ticketRef: string;
    priority: string;
    status: string;
    stationLabel?: string;
    orderRef?: string;
    itemsSummary?: string;
    minsAgo?: number;
  }[];
  inventory: { sku: string; name: string; qty: number; minQty: number }[];
  alerts: { text: string; tone: string }[];
};

const BRANCH_SEEDS: BranchSeed[] = [
  {
    code: "ISB-GT",
    name: "POPS Blue Area",
    city: "Islamabad",
    todaySales: 184_320,
    yesterdaySales: 164_571,
    recentSales: [
      { channel: "dine_in", ref: "ORD-1046", amountPkr: 6780, payment: "Card", minutesAgo: 4 },
      { channel: "takeaway", ref: "TW-12", amountPkr: 2100, payment: "Cash", minutesAgo: 8 },
      { channel: "delivery", ref: "DL-2201", amountPkr: 3450, payment: "COD", minutesAgo: 16 },
      { channel: "dine_in", ref: "ORD-1045", amountPkr: 12_400, payment: "Split", minutesAgo: 20 },
    ],
    activeOrders: [
      { channel: "dine_in", count: 8 },
      { channel: "takeaway", count: 10 },
      { channel: "delivery", count: 5 },
    ],
    kitchen: [
      {
        ticketRef: "KOT-901",
        priority: "normal",
        status: "new",
        stationLabel: "T1",
        orderRef: "ORD-1042",
        itemsSummary: "Chicken Karahi x1, Raita x2",
      },
      {
        ticketRef: "KOT-902",
        priority: "priority",
        status: "cooking",
        stationLabel: "TW-12",
        itemsSummary: "Chicken Biryani x3, Soft drink x3",
        minsAgo: 8,
      },
      {
        ticketRef: "KOT-903",
        priority: "normal",
        status: "ready",
        stationLabel: "DL-04",
        itemsSummary: "Mutton Handi x1, Seekh Kabab x1",
        minsAgo: 14,
      },
      {
        ticketRef: "KOT-904",
        priority: "priority",
        status: "cooking",
        stationLabel: "T6",
        orderRef: "ORD-1046",
        itemsSummary: "Family Combo x1",
        minsAgo: 3,
      },
    ],
    inventory: [
      { sku: "RM-001", name: "Chicken (kg)", qty: 42, minQty: 30 },
      { sku: "RM-014", name: "Cooking oil (L)", qty: 8, minQty: 20 },
      { sku: "RM-022", name: "Basmati rice (bag)", qty: 15, minQty: 10 },
      { sku: "FG-003", name: "Spice mix (house)", qty: 3, minQty: 5 },
      { sku: "RM-031", name: "Tomato paste", qty: 6, minQty: 12 },
      { sku: "RM-044", name: "Naan dough", qty: 9, minQty: 15 },
      { sku: "RM-052", name: "Soft drink syrup", qty: 4, minQty: 8 },
      { sku: "RM-061", name: "Disposable trays", qty: 18, minQty: 25 },
      { sku: "RM-070", name: "Mint leaves", qty: 2, minQty: 5 },
      { sku: "RM-081", name: "Yogurt (L)", qty: 7, minQty: 10 },
      { sku: "RM-090", name: "Ghee (kg)", qty: 5, minQty: 8 },
    ],
    alerts: [
      { text: "PRA retry queue: 1 invoice", tone: "warning" },
      { text: "Shift 2 cash drawer variance Rs 120 (within tolerance)", tone: "info" },
    ],
  },
  {
    code: "LHR-DHA",
    name: "POPS DHA Phase 5",
    city: "Lahore",
    todaySales: 421_900,
    yesterdaySales: 398_000,
    recentSales: [
      { channel: "dine_in", ref: "ORD-2201", amountPkr: 9200, payment: "Card", minutesAgo: 3 },
      { channel: "delivery", ref: "DL-3302", amountPkr: 4100, payment: "COD", minutesAgo: 11 },
      { channel: "takeaway", ref: "TW-88", amountPkr: 1800, payment: "Cash", minutesAgo: 14 },
      { channel: "dine_in", ref: "ORD-2198", amountPkr: 15_600, payment: "Split", minutesAgo: 22 },
    ],
    activeOrders: [
      { channel: "dine_in", count: 14 },
      { channel: "takeaway", count: 18 },
      { channel: "delivery", count: 9 },
    ],
    kitchen: [
      { ticketRef: "KOT-701", priority: "priority", status: "cooking" },
      { ticketRef: "KOT-702", priority: "normal", status: "new" },
      { ticketRef: "KOT-703", priority: "normal", status: "cooking" },
      { ticketRef: "KOT-704", priority: "priority", status: "cooking" },
      { ticketRef: "KOT-705", priority: "normal", status: "new" },
      { ticketRef: "KOT-706", priority: "normal", status: "cooking" },
      { ticketRef: "KOT-707", priority: "normal", status: "ready" },
      { ticketRef: "KOT-708", priority: "priority", status: "cooking" },
      { ticketRef: "KOT-709", priority: "normal", status: "new" },
      { ticketRef: "KOT-710", priority: "normal", status: "cooking" },
      { ticketRef: "KOT-711", priority: "normal", status: "cooking" },
    ],
    inventory: [
      { sku: "RM-001", name: "Chicken (kg)", qty: 28, minQty: 30 },
      { sku: "RM-014", name: "Cooking oil (L)", qty: 6, minQty: 20 },
      { sku: "RM-022", name: "Basmati rice (bag)", qty: 9, minQty: 10 },
      { sku: "FG-003", name: "Spice mix (house)", qty: 2, minQty: 5 },
      { sku: "RM-031", name: "Tomato paste", qty: 4, minQty: 12 },
      { sku: "RM-044", name: "Naan dough", qty: 7, minQty: 15 },
      { sku: "RM-052", name: "Soft drink syrup", qty: 3, minQty: 8 },
      { sku: "RM-061", name: "Disposable trays", qty: 11, minQty: 25 },
      { sku: "RM-070", name: "Mint leaves", qty: 1, minQty: 5 },
      { sku: "RM-081", name: "Yogurt (L)", qty: 5, minQty: 10 },
      { sku: "RM-090", name: "Ghee (kg)", qty: 4, minQty: 8 },
      { sku: "RM-100", name: "Lemon (kg)", qty: 3, minQty: 6 },
      { sku: "RM-110", name: "Onion (kg)", qty: 12, minQty: 20 },
      { sku: "RM-120", name: "Garlic (kg)", qty: 6, minQty: 8 },
      { sku: "RM-130", name: "Green chili", qty: 2, minQty: 5 },
    ],
    alerts: [
      { text: "Kitchen SLA yellow — 3 tickets over 12m", tone: "warning" },
      { text: "Sync completed 2m ago", tone: "info" },
    ],
  },
  {
    code: "KHI-CLF",
    name: "POPS Clifton",
    city: "Karachi",
    todaySales: 298_100,
    yesterdaySales: 310_500,
    recentSales: [
      { channel: "delivery", ref: "DL-4401", amountPkr: 5200, payment: "COD", minutesAgo: 2 },
      { channel: "dine_in", ref: "ORD-3301", amountPkr: 7400, payment: "Card", minutesAgo: 9 },
      { channel: "takeaway", ref: "TW-201", amountPkr: 1650, payment: "Cash", minutesAgo: 17 },
      { channel: "delivery", ref: "DL-4398", amountPkr: 2890, payment: "Card", minutesAgo: 25 },
    ],
    activeOrders: [
      { channel: "dine_in", count: 6 },
      { channel: "takeaway", count: 7 },
      { channel: "delivery", count: 8 },
    ],
    kitchen: [
      { ticketRef: "KOT-501", priority: "normal", status: "cooking" },
      { ticketRef: "KOT-502", priority: "priority", status: "cooking" },
      { ticketRef: "KOT-503", priority: "normal", status: "new" },
      { ticketRef: "KOT-504", priority: "normal", status: "cooking" },
      { ticketRef: "KOT-505", priority: "normal", status: "ready" },
    ],
    inventory: [
      { sku: "RM-001", name: "Chicken (kg)", qty: 35, minQty: 30 },
      { sku: "RM-014", name: "Cooking oil (L)", qty: 12, minQty: 20 },
      { sku: "RM-022", name: "Basmati rice (bag)", qty: 11, minQty: 10 },
      { sku: "FG-003", name: "Spice mix (house)", qty: 4, minQty: 5 },
      { sku: "RM-031", name: "Tomato paste", qty: 5, minQty: 12 },
    ],
    alerts: [
      { text: "Delivery rider shortage — 2 orders waiting", tone: "warning" },
      { text: "PRA submissions up to date", tone: "info" },
    ],
  },
  {
    code: "HQ-01",
    name: "Head Office (monitoring)",
    city: "Islamabad",
    todaySales: 0,
    yesterdaySales: 0,
    recentSales: [],
    activeOrders: [],
    kitchen: [],
    inventory: [],
    alerts: [{ text: "Monitoring view — select a store branch for live ops", tone: "info" }],
  },
];

@Injectable()
export class OperationsService implements OnModuleInit {
  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly billing: BillingService,
    private readonly accounting: AccountingService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedIfEmpty();
    await this.backfillSalesFromDailyRollups();
  }

  /** One-time alignment: move legacy daily rollups into sale rows so live totals match transactions. */
  async backfillSalesFromDailyRollups(): Promise<void> {
    const branches = await this.db.select().from(popsBranches);
    const todayStart = startOfDay(new Date());
    const tomorrowStart = startOfDay(new Date(Date.now() + 86_400_000));
    const yesterdayStart = startOfDay(new Date(Date.now() - 86_400_000));
    const todayKey = todayStart.toISOString().slice(0, 10);
    const yesterdayKey = yesterdayStart.toISOString().slice(0, 10);

    for (const branch of branches) {
      const dailyRows = await this.db
        .select()
        .from(popsDailySales)
        .where(eq(popsDailySales.branchId, branch.id));

      for (const daily of dailyRows) {
        const rangeStart = daily.salesDate === todayKey ? todayStart : daily.salesDate === yesterdayKey ? yesterdayStart : null;
        const rangeEnd = daily.salesDate === todayKey ? tomorrowStart : daily.salesDate === yesterdayKey ? todayStart : null;
        if (!rangeStart || !rangeEnd) continue;

        const [sumRow] = await this.db
          .select({ total: sql<number>`coalesce(sum(${popsSales.amountPkr}), 0)::int` })
          .from(popsSales)
          .where(
            and(
              eq(popsSales.branchId, branch.id),
              sql`${popsSales.soldAt} >= ${rangeStart}`,
              sql`${popsSales.soldAt} < ${rangeEnd}`,
            ),
          );

        const currentTotal = sumRow?.total ?? 0;
        const remainder = daily.amountPkr - currentTotal;
        if (remainder <= 0) continue;

        const soldAt =
          daily.salesDate === todayKey
            ? new Date(todayStart.getTime() + 6 * 60 * 60_000)
            : new Date(yesterdayStart.getTime() + 6 * 60 * 60_000);

        await this.db.insert(popsSales).values({
          organizationId: branch.organizationId,
          branchId: branch.id,
          soldAt,
          channel: "dine_in",
          ref: "DAY-TOTAL",
          amountPkr: remainder,
          payment: "Various",
        });
      }
    }
  }

  async seedIfEmpty(): Promise<void> {
    const existing = await this.db.select({ id: popsBranches.id }).from(popsBranches).limit(1);
    if (existing.length > 0) return;

    const org = await this.db.select({ id: organizations.id }).from(organizations).limit(1);
    const organizationId = org[0]?.id;
    if (!organizationId) return;

    for (const seed of BRANCH_SEEDS) {
      const [branch] = await this.db
        .insert(popsBranches)
        .values({
          organizationId,
          code: seed.code,
          name: seed.name,
          city: seed.city,
        })
        .returning();

      if (!branch) continue;

      await this.accounting.ensureBranchChart(organizationId, branch.id);

      const now = Date.now();
      const todayRecentSum = seed.recentSales.reduce((sum, sale) => sum + sale.amountPkr, 0);
      const todayRemainder = Math.max(0, seed.todaySales - todayRecentSum);
      const yesterdayRemainder = Math.max(0, seed.yesterdaySales);

      for (const sale of seed.recentSales) {
        await this.db.insert(popsSales).values({
          organizationId,
          branchId: branch.id,
          soldAt: new Date(now - sale.minutesAgo * 60_000),
          channel: sale.channel,
          ref: sale.ref,
          amountPkr: sale.amountPkr,
          payment: sale.payment,
        });
      }

      if (todayRemainder > 0) {
        await this.db.insert(popsSales).values({
          organizationId,
          branchId: branch.id,
          soldAt: new Date(now - 180 * 60_000),
          channel: "dine_in",
          ref: "DAY-TOTAL",
          amountPkr: todayRemainder,
          payment: "Various",
        });
      }

      if (yesterdayRemainder > 0) {
        await this.db.insert(popsSales).values({
          organizationId,
          branchId: branch.id,
          soldAt: new Date(now - 86_400_000 - 120 * 60_000),
          channel: "dine_in",
          ref: "DAY-TOTAL",
          amountPkr: yesterdayRemainder,
          payment: "Various",
        });
      }

      for (const order of seed.activeOrders) {
        for (let i = 0; i < order.count; i++) {
          await this.db.insert(popsActiveOrders).values({
            organizationId,
            branchId: branch.id,
            channel: order.channel,
          });
        }
      }

      for (const ticket of seed.kitchen) {
        const minsAgo = ticket.minsAgo ?? 0;
        const startedAt =
          ticket.status === "cooking" || ticket.status === "ready"
            ? new Date(Date.now() - minsAgo * 60_000)
            : null;
        await this.db.insert(popsKitchenTickets).values({
          organizationId,
          branchId: branch.id,
          ticketRef: ticket.ticketRef,
          orderRef: ticket.orderRef ?? null,
          stationLabel: ticket.stationLabel ?? "Counter",
          itemsSummary: ticket.itemsSummary ?? "",
          priority: ticket.priority,
          status: ticket.status,
          startedAt,
        });
      }

      for (const item of seed.inventory) {
        await this.db.insert(popsInventoryItems).values({
          organizationId,
          branchId: branch.id,
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          minQty: item.minQty,
        });
      }

      for (let i = 0; i < seed.alerts.length; i++) {
        const alert = seed.alerts[i];
        if (!alert) continue;
        await this.db.insert(popsAlerts).values({
          organizationId,
          branchId: branch.id,
          text: alert.text,
          tone: alert.tone,
          sortOrder: i,
        });
      }
    }
  }

  async createBranch(organizationId: string, input: CreatePopsBranch) {
    const name = input.name.trim();
    const city = input.city.trim();
    let code = normalizeBranchCode(input.code ?? name);
    if (!code) code = `BR-${Date.now().toString(36).toUpperCase()}`.slice(0, 16);

    const existing = await this.db
      .select({ id: popsBranches.id })
      .from(popsBranches)
      .where(and(eq(popsBranches.organizationId, organizationId), eq(popsBranches.code, code)))
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictException(`Branch code already exists: ${code}`);
    }

    const [row] = await this.db
      .insert(popsBranches)
      .values({ organizationId, code, name, city })
      .returning({
        id: popsBranches.id,
        code: popsBranches.code,
        name: popsBranches.name,
        city: popsBranches.city,
      });

    if (!row) throw new BadRequestException("Failed to create branch");
    await this.accounting.ensureBranchChart(organizationId, row.id);
    return row;
  }

  async listBranches(organizationId: string) {
    const rows = await this.db
      .select({
        id: popsBranches.id,
        code: popsBranches.code,
        name: popsBranches.name,
        city: popsBranches.city,
      })
      .from(popsBranches)
      .where(eq(popsBranches.organizationId, organizationId))
      .orderBy(popsBranches.name);

    return rows;
  }

  async getDashboard(organizationId: string, branchCode: string) {
    const branch = await this.db
      .select()
      .from(popsBranches)
      .where(and(eq(popsBranches.organizationId, organizationId), eq(popsBranches.code, branchCode)))
      .limit(1);

    const row = branch[0];
    if (!row) throw new NotFoundException(`Branch not found: ${branchCode}`);

    const { orders } = await this.billing.listOrders(organizationId, branchCode);
    const completedOrders = completedOrdersFromList(orders);
    const todayKey = karachiDateKey(new Date());
    const yesterdayKey = karachiDateKey(new Date(Date.now() - 86_400_000));

    const todayOrders = completedOrders.filter((o) => karachiDateKey(o.createdAt) === todayKey);
    const yesterdayOrders = completedOrders.filter((o) => karachiDateKey(o.createdAt) === yesterdayKey);

    const todayAmount = sumOrderTotals(todayOrders);
    const yesterdayAmount = sumOrderTotals(yesterdayOrders);
    const changePercent =
      yesterdayAmount > 0 ? Math.round(((todayAmount - yesterdayAmount) / yesterdayAmount) * 100) : 0;

    const kitchenRows = await this.db
      .select()
      .from(popsKitchenTickets)
      .where(
        and(
          eq(popsKitchenTickets.branchId, row.id),
          sql`${popsKitchenTickets.status} != 'done'`,
        ),
      );

    const activeByChannel = { dine_in: 0, takeaway: 0, delivery: 0 };
    for (const order of orders) {
      if (order.status !== "held" && order.status !== "open") continue;
      const channel = orderChannelKey(order.tableLabel);
      activeByChannel[channel] += 1;
    }
    for (const ticket of kitchenRows) {
      const channel = ticketChannelKey(ticket.stationLabel, ticket.orderRef);
      activeByChannel[channel] += 1;
    }
    const dineIn = activeByChannel.dine_in;
    const takeaway = activeByChannel.takeaway;
    const delivery = activeByChannel.delivery;

    const priorityCount = kitchenRows.filter((t) => t.priority === "priority").length;
    const slaStatus =
      kitchenRows.length > 12 ? "red" : kitchenRows.length > 8 ? "yellow" : "green";

    const ingredientRows = await this.db
      .select({
        sku: popsIngredients.sku,
        name: popsIngredients.name,
        qty: popsIngredients.currentStock,
        minQty: popsIngredients.reorderLevel,
      })
      .from(popsIngredients)
      .where(
        and(eq(popsIngredients.branchId, row.id), eq(popsIngredients.organizationId, organizationId)),
      );

    const lowStock = ingredientRows.filter((i) => i.minQty > 0 && i.qty < i.minQty);
    const critical = lowStock.filter((i) => i.qty < i.minQty * 0.5);

    const recentOrders = [...completedOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    const alertRows = await this.db
      .select()
      .from(popsAlerts)
      .where(eq(popsAlerts.branchId, row.id))
      .orderBy(popsAlerts.sortOrder);

    const inventoryAlerts = lowStock.map((item) => ({
      id: `inv-${item.sku}`,
      text: `${item.sku} ${item.name.toLowerCase()} below reorder (${item.qty}/${item.minQty})`,
      tone: (item.qty < item.minQty * 0.5 ? "danger" : "warning") as "danger" | "warning",
    }));

    const mergedAlerts = [
      ...inventoryAlerts,
      ...alertRows.map((a) => ({
        id: a.id,
        text: a.text,
        tone: a.tone as "danger" | "warning" | "info",
      })),
    ];

    return {
      branchCode: row.code,
      metrics: {
        liveSales: { amountPkr: todayAmount, changePercent },
        activeOrders: {
          total: dineIn + takeaway + delivery,
          dineIn,
          takeaway,
          delivery,
        },
        kitchenQueue: {
          total: kitchenRows.length,
          priority: priorityCount,
          slaStatus: slaStatus as "green" | "yellow" | "red",
        },
        lowStock: {
          skuCount: lowStock.length,
          criticalCount: critical.length,
        },
      },
      recentSales: recentOrders.map((order) => ({
        time: formatTime(new Date(order.createdAt)),
        type: billChannelLabel(order.tableLabel),
        ref: order.orderRef ?? order.billRef,
        amount: order.total,
        payment: "Paid",
      })),
      alerts: mergedAlerts,
    };
  }
}

/** Same rules as launcher `payableCompletedOrders` (Orders page + dashboard). */
function completedOrdersFromList(orders: CompletedOrder[]): CompletedOrder[] {
  return orders.filter(
    (o) => o.status === "completed" && o.total > 0 && !o.billRef.endsWith("-SEED"),
  );
}

function sumOrderTotals(orders: CompletedOrder[]): number {
  return orders.reduce((sum, o) => sum + o.total, 0);
}

function karachiDateKey(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof date === "string" ? new Date(date) : date);
}

function orderChannelKey(tableLabel: string): "dine_in" | "takeaway" | "delivery" {
  const label = tableLabel.trim().toLowerCase();
  if (label === "delivery" || label.startsWith("dl-")) return "delivery";
  if (label.includes("takeaway") || label.startsWith("tw-")) return "takeaway";
  return "dine_in";
}

function ticketChannelKey(
  stationLabel: string,
  orderRef: string | null,
): "dine_in" | "takeaway" | "delivery" {
  const station = stationLabel.trim().toLowerCase();
  const ref = (orderRef ?? "").trim().toLowerCase();
  if (station.startsWith("dl-") || ref.startsWith("dl-")) return "delivery";
  if (station.startsWith("tw-") || ref.startsWith("tw-")) return "takeaway";
  return "dine_in";
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function billChannelLabel(tableLabel: string): "Dine-in" | "Takeaway" | "Delivery" {
  const label = tableLabel.trim().toLowerCase();
  if (label === "delivery" || label.startsWith("dl-")) return "Delivery";
  if (label.includes("takeaway") || label.startsWith("tw-")) return "Takeaway";
  return "Dine-in";
}

function normalizeBranchCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 16);
}
