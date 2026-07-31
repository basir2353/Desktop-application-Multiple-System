import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { RESTAURANT_REPORT_DEFS } from "@platform/contracts";
import {
  popsBills,
  popsBranches,
  popsCashSessions,
  popsExpenses,
  popsIngredients,
  popsKitchenLineCancellations,
  popsKitchenTickets,
  popsSeatingSections,
  popsStockAdjustments,
  popsSuppliers,
  popsTables,
  popsVendorBills,
  popsVendorPayments,
  type PlatformPgDb,
} from "@platform/database-pg";
import { DRIZZLE } from "../drizzle/drizzle.tokens";
import { AccountingService } from "../accounting/accounting.service";

type BillLine = { label?: string; qty?: number; unitPrice?: number; station?: string; kitchen?: string };

@Injectable()
export class ReportsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PlatformPgDb,
    private readonly accounting: AccountingService,
  ) {}

  catalog() {
    return { reports: RESTAURANT_REPORT_DEFS.map((r) => ({ id: r.id, name: r.name, category: r.category })) };
  }

  async getReport(
    organizationId: string,
    branchCode: string,
    reportId: string,
    query: { from?: string; to?: string; fromTime?: string; toTime?: string } = {},
  ) {
    const def = RESTAURANT_REPORT_DEFS.find((r) => r.id === reportId);
    if (!def) throw new NotFoundException(`Unknown report: ${reportId}`);

    const branch = await this.resolveBranch(organizationId, branchCode);
    const today = new Date().toISOString().slice(0, 10);
    const from = query.from?.trim() || today;
    const to = query.to?.trim() || today;
    const fromTime = this.normalizeTime(query.fromTime, "00:00");
    const toTime = this.normalizeTime(query.toTime, "23:59");
    if (from > to) throw new BadRequestException("`from` must be on or before `to`");

    const generatedAt = new Date().toISOString();
    const base = {
      reportId: def.id,
      title: def.name,
      category: def.category,
      description: `${def.name} for ${branch.name}`,
      generatedAt,
      from,
      to,
      fromTime,
      toTime,
    };

    const range = { from, to, fromTime, toTime };

    switch (def.id) {
      case "sales-by-item":
        return { ...base, ...this.salesByItem(await this.completedBills(organizationId, branch.id, range)) };
      case "sales-by-kitchen":
        return { ...base, ...this.salesByKitchen(await this.completedBills(organizationId, branch.id, range)) };
      case "sales-by-employee":
        return { ...base, ...this.salesByEmployee(await this.completedBills(organizationId, branch.id, range)) };
      case "sales-by-order-type":
        return { ...base, ...this.salesByOrderType(await this.completedBills(organizationId, branch.id, range)) };
      case "sales-by-hall":
        return {
          ...base,
          ...(await this.salesByHall(organizationId, branch.id, range)),
        };
      case "delivery":
        return { ...base, ...this.deliveryReport(await this.completedBills(organizationId, branch.id, range)) };
      case "discount":
        return { ...base, ...this.discountReport(await this.completedBills(organizationId, branch.id, range)) };
      case "canceled-orders":
        return {
          ...base,
          ...(await this.canceledOrders(organizationId, branch.id, range)),
        };
      case "item-remove":
        return {
          ...base,
          ...(await this.itemRemove(organizationId, branch.id, range)),
        };
      case "cashier-out":
      case "cashier-overshort":
      case "cash-drawer":
        return {
          ...base,
          ...(await this.cashSessionReport(organizationId, branch.id, range, def.id)),
        };
      case "profit-loss": {
        const pl = await this.accounting.getReport(organizationId, branchCode, "profit-loss");
        const rows = (pl.rows ?? []).map((r) => {
          const row = r as {
            label: string;
            amount?: number;
            indent?: number;
            debit?: number;
            credit?: number;
            balance?: number;
          };
          return {
            label: row.label,
            amount: row.amount ?? row.balance,
            debit: row.debit,
            credit: row.credit,
            balance: row.balance,
            meta: row.indent != null ? `indent:${row.indent}` : undefined,
          };
        });
        const empty = !rows.some((r) => Math.abs(Number(r.amount ?? r.balance ?? 0)) > 0);
        return { ...base, rows, totals: pl.totals, empty };
      }
      case "expense":
        return { ...base, ...(await this.expenseReport(organizationId, branch.id, range)) };
      case "kitchen-printing-logs":
        return {
          ...base,
          ...(await this.kitchenPrintingLogs(organizationId, branch.id, range)),
        };
      case "kitchen-missing-log":
        return {
          ...base,
          ...(await this.kitchenMissingLog(organizationId, branch.id, range)),
        };
      case "table-server-change":
        return {
          ...base,
          ...(await this.tableServerChange(organizationId, branch.id, range)),
        };
      case "vendor-ledger":
        return { ...base, ...(await this.vendorLedger(organizationId, branch.id, range)) };
      case "vendors-balance":
        return { ...base, ...(await this.vendorsBalance(organizationId, branch.id)) };
      case "ingredients-usage":
        return { ...base, ...(await this.ingredientsUsage(organizationId, branch.id, range)) };
      case "ingredients-stock":
        return { ...base, ...(await this.ingredientsStock(organizationId, branch.id)) };
      default:
        throw new NotFoundException(`Unknown report: ${reportId}`);
    }
  }

  private normalizeTime(value: string | undefined, fallback: string): string {
    if (value && /^\d{2}:\d{2}$/.test(value)) return value;
    return fallback;
  }

  private async resolveBranch(organizationId: string, branchCode: string) {
    const code = branchCode.trim();
    if (!code) throw new BadRequestException("branchCode is required");
    const [branch] = await this.db
      .select()
      .from(popsBranches)
      .where(and(eq(popsBranches.organizationId, organizationId), eq(popsBranches.code, code)))
      .limit(1);
    if (!branch) throw new NotFoundException(`Branch not found: ${code}`);
    return branch;
  }

  private rangeStart(range: { from: string; fromTime: string }): Date {
    return new Date(`${range.from}T${range.fromTime}:00+05:00`);
  }

  private rangeEnd(range: { to: string; toTime: string }): Date {
    return new Date(`${range.to}T${range.toTime}:59.999+05:00`);
  }

  private parseLines(linesJson: string | null): BillLine[] {
    if (!linesJson) return [];
    try {
      const parsed = JSON.parse(linesJson) as BillLine[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private inferOrderType(tableLabel: string, notes: string | null): string {
    const t = (tableLabel ?? "").toLowerCase();
    const n = (notes ?? "").toLowerCase();
    if (t.includes("delivery") || n.startsWith("delivery") || n.includes(" · delivery")) return "Delivery";
    if (t.includes("takeaway") || t.includes("tw-") || n.startsWith("takeaway")) return "Takeaway";
    if (t.includes("online") || n.includes("online")) return "Online";
    if (t.includes("foodpanda") || n.includes("foodpanda")) return "Foodpanda";
    if (t.includes("staff")) return "Staff food";
    return "Dine-in";
  }

  private async completedBills(
    organizationId: string,
    branchId: string,
    range: { from: string; to: string; fromTime: string; toTime: string },
  ) {
    return this.db
      .select()
      .from(popsBills)
      .where(
        and(
          eq(popsBills.organizationId, organizationId),
          eq(popsBills.branchId, branchId),
          eq(popsBills.status, "completed"),
          gte(popsBills.createdAt, this.rangeStart(range)),
          lte(popsBills.createdAt, this.rangeEnd(range)),
        ),
      )
      .orderBy(desc(popsBills.createdAt));
  }

  private salesByItem(bills: Awaited<ReturnType<ReportsService["completedBills"]>>) {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      for (const line of this.parseLines(bill.linesJson)) {
        const label = (line.label ?? "Item").trim() || "Item";
        const qty = Number(line.qty ?? 0);
        const amount = qty * Number(line.unitPrice ?? 0);
        const cur = map.get(label) ?? { qty: 0, amount: 0 };
        cur.qty += qty;
        cur.amount += amount;
        map.set(label, cur);
      }
    }
    const rows = [...map.entries()]
      .map(([label, v]) => ({ label, qty: v.qty, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);
    return {
      rows,
      totals: {
        lines: rows.length,
        qty: rows.reduce((s, r) => s + r.qty, 0),
        amount: rows.reduce((s, r) => s + r.amount, 0),
      },
      empty: rows.length === 0,
    };
  }

  private salesByKitchen(bills: Awaited<ReturnType<ReportsService["completedBills"]>>) {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      for (const line of this.parseLines(bill.linesJson)) {
        const kitchen = (line.kitchen || line.station || "Main kitchen").trim() || "Main kitchen";
        const qty = Number(line.qty ?? 0);
        const amount = qty * Number(line.unitPrice ?? 0);
        const cur = map.get(kitchen) ?? { qty: 0, amount: 0 };
        cur.qty += qty;
        cur.amount += amount;
        map.set(kitchen, cur);
      }
    }
    // Fallback: if lines lack kitchen tags, bucket by station on bills via table mode
    if (map.size === 0) {
      for (const bill of bills) {
        const kitchen = "Main kitchen";
        const cur = map.get(kitchen) ?? { qty: 0, amount: 0 };
        cur.qty += 1;
        cur.amount += bill.totalPkr;
        map.set(kitchen, cur);
      }
    }
    const rows = [...map.entries()]
      .map(([label, v]) => ({ label, qty: v.qty, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);
    return {
      rows,
      totals: { amount: rows.reduce((s, r) => s + r.amount, 0) },
      empty: rows.length === 0,
    };
  }

  private salesByEmployee(bills: Awaited<ReturnType<ReportsService["completedBills"]>>) {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      const label = (bill.waiterName || "Unassigned").trim() || "Unassigned";
      const cur = map.get(label) ?? { qty: 0, amount: 0 };
      cur.qty += 1;
      cur.amount += bill.totalPkr;
      map.set(label, cur);
    }
    const rows = [...map.entries()]
      .map(([label, v]) => ({ label, qty: v.qty, amount: v.amount, meta: `${v.qty} orders` }))
      .sort((a, b) => b.amount - a.amount);
    return {
      rows,
      totals: { orders: rows.reduce((s, r) => s + (r.qty ?? 0), 0), amount: rows.reduce((s, r) => s + r.amount, 0) },
      empty: rows.length === 0,
    };
  }

  private salesByOrderType(bills: Awaited<ReturnType<ReportsService["completedBills"]>>) {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      const label = this.inferOrderType(bill.tableLabel, bill.notes);
      const cur = map.get(label) ?? { qty: 0, amount: 0 };
      cur.qty += 1;
      cur.amount += bill.totalPkr;
      map.set(label, cur);
    }
    const rows = [...map.entries()]
      .map(([label, v]) => ({ label, qty: v.qty, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);
    return {
      rows,
      totals: { amount: rows.reduce((s, r) => s + r.amount, 0) },
      empty: rows.length === 0,
    };
  }

  private async salesByHall(organizationId: string, branchId: string, range: { from: string; to: string; fromTime: string; toTime: string }) {
    const bills = await this.completedBills(organizationId, branchId, range);
    const tables = await this.db
      .select({
        tableNumber: popsTables.tableNumber,
        sectionName: popsSeatingSections.name,
      })
      .from(popsTables)
      .leftJoin(popsSeatingSections, eq(popsTables.sectionId, popsSeatingSections.id))
      .where(and(eq(popsTables.organizationId, organizationId), eq(popsTables.branchId, branchId)));

    const tableToHall = new Map<string, string>();
    for (const t of tables) {
      tableToHall.set(String(t.tableNumber), t.sectionName?.trim() || "Main hall");
    }

    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      const type = this.inferOrderType(bill.tableLabel, bill.notes);
      let hall = type === "Dine-in" ? "Main hall" : type;
      if (type === "Dine-in") {
        const num = (bill.tableLabel.match(/\d+/) ?? [])[0];
        if (num && tableToHall.has(num)) hall = tableToHall.get(num)!;
        else if (bill.tableLabel.includes("·")) {
          hall = bill.tableLabel.split("·")[0]?.trim() || hall;
        }
      }
      const cur = map.get(hall) ?? { qty: 0, amount: 0 };
      cur.qty += 1;
      cur.amount += bill.totalPkr;
      map.set(hall, cur);
    }
    const rows = [...map.entries()]
      .map(([label, v]) => ({ label, qty: v.qty, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);
    return {
      rows,
      totals: { amount: rows.reduce((s, r) => s + r.amount, 0) },
      empty: rows.length === 0,
    };
  }

  private deliveryReport(bills: Awaited<ReturnType<ReportsService["completedBills"]>>) {
    const delivery = bills.filter((b) => this.inferOrderType(b.tableLabel, b.notes) === "Delivery");
    const rows = delivery.map((b) => ({
      label: b.billRef,
      amount: b.totalPkr,
      qty: 1,
      meta: [b.notes, b.orderRef].filter(Boolean).join(" · "),
    }));
    return {
      rows,
      totals: {
        orders: rows.length,
        deliveryCharge: delivery.reduce((s, b) => s + (b.deliveryChargePkr ?? 0), 0),
        amount: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
      },
      empty: rows.length === 0,
    };
  }

  private discountReport(bills: Awaited<ReturnType<ReportsService["completedBills"]>>) {
    const discounted = bills.filter((b) => (b.discountPkr ?? 0) > 0);
    const rows = discounted.map((b) => ({
      label: b.billRef,
      amount: b.discountPkr,
      meta: `${b.waiterName} · total ${b.totalPkr}`,
    }));
    return {
      rows,
      totals: { orders: rows.length, discount: rows.reduce((s, r) => s + (r.amount ?? 0), 0) },
      empty: rows.length === 0,
    };
  }

  private async canceledOrders(organizationId: string, branchId: string, range: { from: string; to: string; fromTime: string; toTime: string }) {
    const voids = await this.db
      .select()
      .from(popsBills)
      .where(
        and(
          eq(popsBills.organizationId, organizationId),
          eq(popsBills.branchId, branchId),
          eq(popsBills.status, "void"),
          gte(popsBills.createdAt, this.rangeStart(range)),
          lte(popsBills.createdAt, this.rangeEnd(range)),
        ),
      )
      .orderBy(desc(popsBills.createdAt));

    const rows = voids.map((b) => ({
      label: b.billRef,
      amount: b.totalPkr,
      meta: `${b.tableLabel} · ${b.waiterName}`,
    }));
    return {
      rows,
      totals: { orders: rows.length, amount: rows.reduce((s, r) => s + (r.amount ?? 0), 0) },
      empty: rows.length === 0,
    };
  }

  private async itemRemove(organizationId: string, branchId: string, range: { from: string; to: string; fromTime: string; toTime: string }) {
    const rowsDb = await this.db
      .select()
      .from(popsKitchenLineCancellations)
      .where(
        and(
          eq(popsKitchenLineCancellations.organizationId, organizationId),
          eq(popsKitchenLineCancellations.branchId, branchId),
          gte(popsKitchenLineCancellations.canceledAt, this.rangeStart(range)),
          lte(popsKitchenLineCancellations.canceledAt, this.rangeEnd(range)),
        ),
      )
      .orderBy(desc(popsKitchenLineCancellations.canceledAt))
      .limit(500);

    const rows = rowsDb.map((r) => ({
      label: r.label,
      qty: r.qtyCanceled,
      amount: r.qtyCanceled * (r.unitPricePkr ?? 0),
      meta: `${r.ticketRef} · ${r.source} · ${r.canceledAt.toISOString()}`,
    }));
    return {
      rows,
      totals: {
        lines: rows.length,
        qty: rows.reduce((s, r) => s + (r.qty ?? 0), 0),
        amount: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
      },
      empty: rows.length === 0,
    };
  }

  private async cashSessionReport(
    organizationId: string,
    branchId: string,
    range: { from: string; to: string; fromTime: string; toTime: string },
    mode: "cashier-out" | "cashier-overshort" | "cash-drawer",
  ) {
    const sessions = await this.db
      .select()
      .from(popsCashSessions)
      .where(
        and(
          eq(popsCashSessions.organizationId, organizationId),
          eq(popsCashSessions.branchId, branchId),
          gte(popsCashSessions.openedAt, this.rangeStart(range)),
          lte(popsCashSessions.openedAt, this.rangeEnd(range)),
        ),
      )
      .orderBy(desc(popsCashSessions.openedAt));

    let filtered = sessions;
    if (mode === "cashier-out") filtered = sessions.filter((s) => s.status === "closed");
    if (mode === "cashier-overshort") {
      filtered = sessions.filter((s) => s.status === "closed" && (s.variancePkr ?? 0) !== 0);
    }

    const rows = filtered.map((s) => ({
      label: s.sessionRef,
      amount: mode === "cashier-overshort" ? s.variancePkr ?? 0 : s.countedCashPkr ?? s.expectedCashPkr ?? 0,
      meta: [
        s.openedBy,
        s.closedBy ? `closed by ${s.closedBy}` : "open",
        s.variancePkr != null ? `var ${s.variancePkr}` : null,
        s.openingFloatPkr != null ? `float ${s.openingFloatPkr}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      qty: s.variancePkr ?? undefined,
    }));

    return {
      rows,
      totals: {
        sessions: rows.length,
        variance: filtered.reduce((s, r) => s + (r.variancePkr ?? 0), 0),
        counted: filtered.reduce((s, r) => s + (r.countedCashPkr ?? 0), 0),
      },
      empty: rows.length === 0,
    };
  }

  private async expenseReport(organizationId: string, branchId: string, range: { from: string; to: string; fromTime: string; toTime: string }) {
    const rowsDb = await this.db
      .select()
      .from(popsExpenses)
      .where(
        and(
          eq(popsExpenses.organizationId, organizationId),
          eq(popsExpenses.branchId, branchId),
          gte(popsExpenses.expenseDate, range.from),
          lte(popsExpenses.expenseDate, range.to),
        ),
      )
      .orderBy(desc(popsExpenses.expenseDate));

    const rows = rowsDb.map((e) => ({
      label: e.category,
      amount: e.amountPkr,
      meta: [e.expenseDate, e.vendor, e.description].filter(Boolean).join(" · "),
    }));
    return {
      rows,
      totals: { amount: rows.reduce((s, r) => s + (r.amount ?? 0), 0), count: rows.length },
      empty: rows.length === 0,
    };
  }

  private async kitchenPrintingLogs(organizationId: string, branchId: string, range: { from: string; to: string; fromTime: string; toTime: string }) {
    const tickets = await this.db
      .select()
      .from(popsKitchenTickets)
      .where(
        and(
          eq(popsKitchenTickets.organizationId, organizationId),
          eq(popsKitchenTickets.branchId, branchId),
          gte(popsKitchenTickets.createdAt, this.rangeStart(range)),
          lte(popsKitchenTickets.createdAt, this.rangeEnd(range)),
        ),
      )
      .orderBy(desc(popsKitchenTickets.createdAt))
      .limit(500);

    const rows = tickets.map((t) => ({
      label: t.ticketRef,
      meta: [t.orderRef, t.stationLabel, t.status, t.createdByName, t.createdAt.toISOString()].filter(Boolean).join(" · "),
      amount: undefined,
      qty: 1,
    }));
    return { rows, totals: { tickets: rows.length }, empty: rows.length === 0 };
  }

  private async kitchenMissingLog(organizationId: string, branchId: string, range: { from: string; to: string; fromTime: string; toTime: string }) {
    // Tickets closed/canceled without a linked bill, plus line cancellations after KOT.
    const tickets = await this.db
      .select()
      .from(popsKitchenTickets)
      .where(
        and(
          eq(popsKitchenTickets.organizationId, organizationId),
          eq(popsKitchenTickets.branchId, branchId),
          gte(popsKitchenTickets.createdAt, this.rangeStart(range)),
          lte(popsKitchenTickets.createdAt, this.rangeEnd(range)),
        ),
      )
      .orderBy(desc(popsKitchenTickets.createdAt))
      .limit(500);

    const missing = tickets.filter(
      (t) => !t.billId && (t.status === "canceled" || t.status === "closed" || t.status === "void"),
    );
    const rows = missing.map((t) => ({
      label: t.ticketRef,
      meta: [t.orderRef, t.stationLabel, t.status, t.itemsSummary?.slice(0, 80)].filter(Boolean).join(" · "),
    }));
    return { rows, totals: { tickets: rows.length }, empty: rows.length === 0 };
  }

  private async tableServerChange(
    organizationId: string,
    branchId: string,
    range: { from: string; to: string; fromTime: string; toTime: string },
  ) {
    // Proxy: bills where table/waiter pairing is recorded — list dine-in bills as server assignments in range.
    // Dedicated audit table is not yet persisted; this surfaces active server coverage for the period.
    const bills = await this.completedBills(organizationId, branchId, range);
    const dineIn = bills.filter((b) => this.inferOrderType(b.tableLabel, b.notes) === "Dine-in");
    const rows = dineIn.map((b) => ({
      label: b.tableLabel,
      meta: `${b.waiterName} · ${b.billRef} · ${b.createdAt.toISOString()}`,
      amount: b.totalPkr,
    }));
    return { rows, totals: { assignments: rows.length }, empty: rows.length === 0 };
  }

  private async vendorLedger(organizationId: string, branchId: string, range: { from: string; to: string; fromTime: string; toTime: string }) {
    const bills = await this.db
      .select({
        billRef: popsVendorBills.billRef,
        amountPkr: popsVendorBills.amountPkr,
        createdAt: popsVendorBills.createdAt,
        supplierName: popsSuppliers.name,
      })
      .from(popsVendorBills)
      .leftJoin(popsSuppliers, eq(popsVendorBills.supplierId, popsSuppliers.id))
      .where(
        and(
          eq(popsVendorBills.organizationId, organizationId),
          eq(popsVendorBills.branchId, branchId),
          gte(popsVendorBills.createdAt, this.rangeStart(range)),
          lte(popsVendorBills.createdAt, this.rangeEnd(range)),
        ),
      )
      .orderBy(desc(popsVendorBills.createdAt));

    const payments = await this.db
      .select({
        paymentRef: popsVendorPayments.paymentRef,
        amountPkr: popsVendorPayments.amountPkr,
        paymentDate: popsVendorPayments.paymentDate,
        supplierName: popsSuppliers.name,
      })
      .from(popsVendorPayments)
      .innerJoin(popsVendorBills, eq(popsVendorPayments.vendorBillId, popsVendorBills.id))
      .leftJoin(popsSuppliers, eq(popsVendorBills.supplierId, popsSuppliers.id))
      .where(
        and(
          eq(popsVendorBills.organizationId, organizationId),
          eq(popsVendorBills.branchId, branchId),
          gte(popsVendorPayments.paymentDate, range.from),
          lte(popsVendorPayments.paymentDate, range.to),
        ),
      )
      .orderBy(desc(popsVendorPayments.paymentDate));

    const rows = [
      ...bills.map((b) => ({
        label: b.supplierName || "Vendor",
        debit: b.amountPkr,
        credit: 0,
        amount: b.amountPkr,
        meta: `Bill ${b.billRef} · ${b.createdAt.toISOString().slice(0, 10)}`,
      })),
      ...payments.map((p) => ({
        label: p.supplierName || "Vendor",
        debit: 0,
        credit: p.amountPkr,
        amount: -p.amountPkr,
        meta: `Payment ${p.paymentRef} · ${p.paymentDate}`,
      })),
    ];
    return {
      rows,
      totals: {
        bills: bills.reduce((s, b) => s + b.amountPkr, 0),
        payments: payments.reduce((s, p) => s + p.amountPkr, 0),
      },
      empty: rows.length === 0,
    };
  }

  private async vendorsBalance(organizationId: string, branchId: string) {
    const suppliers = await this.db
      .select()
      .from(popsSuppliers)
      .where(and(eq(popsSuppliers.organizationId, organizationId), eq(popsSuppliers.branchId, branchId)));

    const billSums = await this.db
      .select({
        supplierId: popsVendorBills.supplierId,
        total: sql<number>`coalesce(sum(${popsVendorBills.amountPkr}), 0)`,
        paid: sql<number>`coalesce(sum(${popsVendorBills.paidPkr}), 0)`,
      })
      .from(popsVendorBills)
      .where(and(eq(popsVendorBills.organizationId, organizationId), eq(popsVendorBills.branchId, branchId)))
      .groupBy(popsVendorBills.supplierId);

    const billMap = new Map(
      billSums.map((r) => [r.supplierId, { total: Number(r.total), paid: Number(r.paid) }]),
    );

    const rows = suppliers
      .map((s) => {
        const sums = billMap.get(s.id) ?? { total: 0, paid: 0 };
        const balance = sums.total - sums.paid;
        return {
          label: s.name,
          amount: balance,
          debit: sums.total,
          credit: sums.paid,
          balance,
          meta: s.phone ?? s.email ?? undefined,
        };
      })
      .sort((a, b) => Math.abs(b.balance ?? 0) - Math.abs(a.balance ?? 0));

    return {
      rows,
      totals: { outstanding: rows.reduce((s, r) => s + (r.balance ?? 0), 0), vendors: rows.length },
      empty: rows.length === 0,
    };
  }

  private async ingredientsUsage(organizationId: string, branchId: string, range: { from: string; to: string; fromTime: string; toTime: string }) {
    const adjustments = await this.db
      .select({
        type: popsStockAdjustments.type,
        qty: popsStockAdjustments.qty,
        reason: popsStockAdjustments.reason,
        createdAt: popsStockAdjustments.createdAt,
        name: popsIngredients.name,
        unitCostPkr: popsIngredients.unitCostPkr,
        unit: popsStockAdjustments.unit,
      })
      .from(popsStockAdjustments)
      .leftJoin(popsIngredients, eq(popsStockAdjustments.ingredientId, popsIngredients.id))
      .where(
        and(
          eq(popsStockAdjustments.organizationId, organizationId),
          eq(popsStockAdjustments.branchId, branchId),
          gte(popsStockAdjustments.createdAt, this.rangeStart(range)),
          lte(popsStockAdjustments.createdAt, this.rangeEnd(range)),
        ),
      )
      .orderBy(desc(popsStockAdjustments.createdAt))
      .limit(500);

    const usage = adjustments.filter((a) => a.type === "Remove" || /consume|usage|recipe/i.test(a.reason ?? ""));
    const rows = usage.map((a) => ({
      label: a.name || "Ingredient",
      qty: a.qty,
      amount: a.qty * (a.unitCostPkr ?? 0),
      meta: [a.type, a.unit, a.reason, a.createdAt.toISOString()].filter(Boolean).join(" · "),
    }));
    return {
      rows,
      totals: { qty: rows.reduce((s, r) => s + (r.qty ?? 0), 0), amount: rows.reduce((s, r) => s + (r.amount ?? 0), 0) },
      empty: rows.length === 0,
    };
  }

  private async ingredientsStock(organizationId: string, branchId: string) {
    const ingredients = await this.db
      .select()
      .from(popsIngredients)
      .where(and(eq(popsIngredients.organizationId, organizationId), eq(popsIngredients.branchId, branchId)))
      .orderBy(popsIngredients.name);

    const rows = ingredients.map((i) => ({
      label: i.name,
      qty: i.currentStock,
      amount: i.currentStock * i.unitCostPkr,
      meta: `${i.sku} · ${i.unit} · reorder ${i.reorderLevel}`,
    }));
    return {
      rows,
      totals: {
        items: rows.length,
        value: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
      },
      empty: rows.length === 0,
    };
  }
}
