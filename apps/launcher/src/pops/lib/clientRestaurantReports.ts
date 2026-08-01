import type { Bill, RestaurantReport } from "@platform/contracts";
import { RESTAURANT_REPORT_DEFS } from "@platform/contracts";
import {
  fetchAccountingReport,
  fetchBankAccounts,
  fetchBankTransactions,
  fetchCashMovements,
  fetchCashSessions,
  fetchCustomerInvoices,
  fetchExpenses,
  fetchVendorBills,
} from "../api/accounting";
import { fetchCompletedOrders } from "../api/billing";
import { fetchEmployeeAdvances, fetchEmployees } from "../api/hr";
import { fetchBranchInventory, fetchInventoryReport } from "../api/inventory";
import { fetchKitchenCancellations, fetchKitchenTickets } from "../api/kitchen";
import { fetchBranchFloor } from "../api/tables";
import { karachiDateKey, karachiTime, timeToMinutes } from "./orderSales";

type BillLine = { label?: string; qty?: number; unitPrice?: number; kitchen?: string; station?: string };

function parseLines(bill: Bill): BillLine[] {
  return Array.isArray(bill.lines) ? (bill.lines as BillLine[]) : [];
}

function normalizeTime(value?: string, fallback = "00:00"): string {
  if (value && /^\d{2}:\d{2}$/.test(value)) return value;
  return fallback;
}

function inRange(
  iso: string,
  from?: string,
  to?: string,
  fromTime?: string,
  toTime?: string,
): boolean {
  const day = karachiDateKey(iso);
  if (from && day < from) return false;
  if (to && day > to) return false;

  const startT = normalizeTime(fromTime, "00:00");
  const endT = normalizeTime(toTime, "23:59");
  const mins = timeToMinutes(karachiTime(iso));

  if (from && day === from && mins < timeToMinutes(startT)) return false;
  if (to && day === to && mins > timeToMinutes(endT)) return false;
  return true;
}

function inferOrderType(tableLabel: string, notes?: string | null): string {
  const t = (tableLabel ?? "").toLowerCase();
  const n = (notes ?? "").toLowerCase();
  if (t.includes("delivery") || n.startsWith("delivery")) return "Delivery";
  if (t.includes("takeaway") || t.startsWith("tw-") || n.startsWith("takeaway")) return "Takeaway";
  if (t.includes("online") || n.includes("online")) return "Online";
  if (t.includes("foodpanda") || n.includes("foodpanda")) return "Foodpanda";
  if (t.includes("staff")) return "Staff food";
  return "Dine-in";
}

function base(
  reportId: string,
  from?: string,
  to?: string,
): Pick<RestaurantReport, "reportId" | "title" | "category" | "description" | "generatedAt" | "from" | "to"> {
  const def = RESTAURANT_REPORT_DEFS.find((r) => r.id === reportId);
  return {
    reportId,
    title: def?.name ?? reportId,
    category: def?.category ?? "Reports",
    description: `${def?.name ?? reportId} (local aggregate)`,
    generatedAt: new Date().toISOString(),
    from: from ?? null,
    to: to ?? null,
  };
}

/** Builds restaurant reports from existing live APIs when /v1/reports is not deployed yet. */
export async function buildClientRestaurantReport(
  branchCode: string,
  reportId: string,
  options?: { from?: string; to?: string; fromTime?: string; toTime?: string },
): Promise<RestaurantReport> {
  const from = options?.from;
  const to = options?.to;
  const fromTime = options?.fromTime;
  const toTime = options?.toTime;
  const meta = base(reportId, from, to);

  if (reportId === "profit-loss") {
    try {
      const pl = await fetchAccountingReport(branchCode, "profit-loss");
      const rows = pl.rows.map((r) => ({
        label: r.label,
        amount: r.amount,
        meta: r.indent ? `indent:${r.indent}` : undefined,
      }));
      const empty = !rows.some((r) => Math.abs(Number(r.amount ?? 0)) > 0);
      return { ...meta, rows, totals: pl.totals, empty };
    } catch {
      return { ...meta, rows: [], empty: true };
    }
  }

  if (reportId === "ingredients-stock") {
    try {
      const inv = await fetchInventoryReport(branchCode, "current-stock");
      const data = (inv.data as { sku?: string; name?: string; stock?: string; value?: number }[]) ?? [];
      const rows = Array.isArray(data)
        ? data.map((r) => ({
            label: String(r.name ?? r.sku ?? "Item"),
            amount: Number(r.value ?? 0),
            meta: String(r.stock ?? ""),
          }))
        : [];
      return { ...meta, rows, empty: rows.length === 0 };
    } catch {
      const branchInv = await fetchBranchInventory(branchCode);
      const rows = branchInv.ingredients.map((i) => ({
        label: i.name,
        qty: i.currentStock,
        amount: i.currentStock * i.unitCost,
        meta: `${i.sku} · ${i.unit}`,
      }));
      return { ...meta, rows, empty: rows.length === 0 };
    }
  }

  if (reportId === "ingredients-usage") {
    try {
      const inv = await fetchInventoryReport(branchCode, "consumption");
      const data = (inv.data as { ingredient?: string; name?: string; qty?: number; reason?: string }[]) ?? [];
      const rows = Array.isArray(data)
        ? data.map((r) => ({
            label: String(r.ingredient ?? r.name ?? "Ingredient"),
            qty: Number(r.qty ?? 0),
            meta: String(r.reason ?? ""),
          }))
        : [];
      return { ...meta, rows, empty: rows.length === 0 };
    } catch {
      return { ...meta, rows: [], empty: true };
    }
  }

  if (reportId === "expense") {
    const expenses = await fetchExpenses(branchCode);
    const rows = expenses
      .filter((e) => inRange(e.expenseDate, from, to, fromTime, toTime))
      .map((e) => ({
        label: e.category,
        amount: e.amount,
        meta: [e.expenseDate, e.vendor, e.description].filter(Boolean).join(" · "),
      }));
    return {
      ...meta,
      rows,
      totals: { amount: rows.reduce((s, r) => s + (r.amount ?? 0), 0), count: rows.length },
      empty: rows.length === 0,
    };
  }

  if (reportId === "cashier-out" || reportId === "cashier-overshort" || reportId === "cash-drawer") {
    const sessions = await fetchCashSessions(branchCode);
    let filtered = sessions.filter((s) => inRange(s.openedAt, from, to, fromTime, toTime));
    if (reportId === "cashier-out") filtered = filtered.filter((s) => s.status === "closed");
    if (reportId === "cashier-overshort") {
      filtered = filtered.filter((s) => s.status === "closed" && (s.variance ?? 0) !== 0);
    }
    const rows = filtered.map((s) => ({
      label: s.sessionRef,
      amount:
        reportId === "cashier-overshort" ? s.variance ?? 0 : s.countedCash ?? s.expectedCash ?? 0,
      meta: [s.openedBy, s.closedBy ? `closed by ${s.closedBy}` : "open", s.variance != null ? `var ${s.variance}` : null]
        .filter(Boolean)
        .join(" · "),
    }));
    return {
      ...meta,
      rows,
      totals: {
        sessions: rows.length,
        variance: filtered.reduce((s, r) => s + (r.variance ?? 0), 0),
      },
      empty: rows.length === 0,
    };
  }

  if (reportId === "cash-report") {
    const allBills = await fetchCompletedOrders(branchCode);
    const bills = allBills.filter(
      (b) => b.status === "completed" && inRange(b.createdAt, from, to, fromTime, toTime),
    );
    const voidBills = allBills.filter(
      (b) => b.status === "void" && inRange(b.createdAt, from, to, fromTime, toTime),
    );

    let serviceCharges = 0;
    let deliveryCharges = 0;
    let discountTotal = 0;
    let tax16 = 0;
    let tax8 = 0;
    let taxOther = 0;
    let cashReceived = 0;
    let cardReceived = 0;
    let walletReceived = 0;
    let bankPosReceived = 0;
    let serviceQty = 0;
    let deliveryQty = 0;
    let discountQty = 0;
    let tax16Qty = 0;
    let tax8Qty = 0;
    let taxOtherQty = 0;
    let cashQty = 0;
    let cardQty = 0;
    let walletQty = 0;
    let bankPosQty = 0;
    let canceledAmount = 0;

    for (const bill of bills) {
      const service = bill.service ?? 0;
      if (service > 0) {
        serviceCharges += service;
        serviceQty += 1;
      }
      const delivery = bill.deliveryChargePkr ?? 0;
      if (delivery > 0) {
        deliveryCharges += delivery;
        deliveryQty += 1;
      }
      const discount = bill.discount ?? 0;
      if (discount > 0) {
        discountTotal += discount;
        discountQty += 1;
      }
      const tax = bill.tax ?? 0;
      const pct = bill.taxPct ?? 0;
      if (tax > 0) {
        if (pct >= 12) {
          tax16 += tax;
          tax16Qty += 1;
        } else if (pct > 0) {
          tax8 += tax;
          tax8Qty += 1;
        } else {
          taxOther += tax;
          taxOtherQty += 1;
        }
      }
      let billCash = 0;
      let billCard = 0;
      let billWallet = 0;
      let billBank = 0;
      for (const p of bill.payments ?? []) {
        const amount = Math.max(0, Math.round(Number(p.amount ?? 0)));
        if (p.method === "cash") billCash += amount;
        else if (p.method === "card") billCard += amount;
        else if (p.method === "wallet") billWallet += amount;
        else if (p.method === "bank") billBank += amount;
      }
      if (billCash > 0) {
        cashReceived += billCash;
        cashQty += 1;
      }
      if (billCard > 0) {
        cardReceived += billCard;
        cardQty += 1;
      }
      if (billWallet > 0) {
        walletReceived += billWallet;
        walletQty += 1;
      }
      if (billBank > 0) {
        bankPosReceived += billBank;
        bankPosQty += 1;
      }
    }

    for (const bill of voidBills) {
      canceledAmount += bill.total ?? 0;
    }

    let paidIn = 0;
    let paidOut = 0;
    let paidInQty = 0;
    let paidOutQty = 0;
    try {
      const sessions = await fetchCashSessions(branchCode);
      const ranged = sessions.filter((s) => inRange(s.openedAt, from, to, fromTime, toTime));
      for (const session of ranged) {
        try {
          const movements = await fetchCashMovements(session.id);
          for (const m of movements) {
            if (!inRange(m.createdAt, from, to, fromTime, toTime)) continue;
            if (m.type === "paid_in") {
              paidIn += m.amountPkr;
              paidInQty += 1;
            } else if (m.type === "paid_out") {
              paidOut += m.amountPkr;
              paidOutQty += 1;
            }
          }
        } catch {
          // ignore per-session movement failures
        }
      }
    } catch {
      // ignore cash session failures
    }

    const remainingCash = cashReceived + paidIn - paidOut;

    const rows: { label: string; amount: number; qty: number; meta?: string; section: string }[] = [
      {
        section: "deliveryCharges",
        label: "Total delivery charges",
        amount: deliveryCharges,
        qty: deliveryQty,
        meta: "Click to see delivery bills",
      },
      {
        section: "serviceCharges",
        label: "Service charges collected",
        amount: serviceCharges,
        qty: serviceQty,
        meta: "Click to see bills",
      },
      {
        section: "tax16",
        label: "16% tax collected",
        amount: tax16,
        qty: tax16Qty,
        meta: "Cash payment rate · click for bills",
      },
      {
        section: "tax8",
        label: "8% tax collected",
        amount: tax8,
        qty: tax8Qty,
        meta: "Card / online / bank rate · click for bills",
      },
    ];
    if (taxOther > 0 || taxOtherQty > 0) {
      rows.push({
        section: "taxOther",
        label: "Other tax collected",
        amount: taxOther,
        qty: taxOtherQty,
        meta: "Non 8%/16% bills",
      });
    }
    rows.push(
      {
        section: "discount",
        label: "Discount given",
        amount: discountTotal,
        qty: discountQty,
        meta: "Click to see discounted bills",
      },
      {
        section: "canceledOrders",
        label: "Canceled orders",
        amount: canceledAmount,
        qty: voidBills.length,
        meta: "Void bills in range",
      },
      {
        section: "cashReceived",
        label: "Cash received (POS)",
        amount: cashReceived,
        qty: cashQty,
        meta: "Click to see cash bills",
      },
      {
        section: "remainingCash",
        label: "Remaining cash available",
        amount: remainingCash,
        qty: cashQty + paidInQty + paidOutQty,
        meta: `Cash ${cashReceived} + paid in ${paidIn} − paid out ${paidOut}`,
      },
      {
        section: "cardReceived",
        label: "Card received",
        amount: cardReceived,
        qty: cardQty,
        meta: "Click to see card bills",
      },
      {
        section: "walletReceived",
        label: "Wallet / online received",
        amount: walletReceived,
        qty: walletQty,
        meta: "Click to see wallet bills",
      },
    );

    let bankReceived = 0;
    let bankDepositQty = 0;
    try {
      const [accounts, txns] = await Promise.all([
        fetchBankAccounts(branchCode),
        fetchBankTransactions(branchCode),
      ]);
      const depositsByAccount = new Map<string, { amount: number; qty: number }>();
      for (const t of txns) {
        if (t.type !== "deposit") continue;
        const day = t.txnDate.slice(0, 10);
        if (from && day < from) continue;
        if (to && day > to) continue;
        const cur = depositsByAccount.get(t.bankAccountId) ?? { amount: 0, qty: 0 };
        cur.amount += t.amount;
        cur.qty += 1;
        depositsByAccount.set(t.bankAccountId, cur);
      }
      for (const acct of accounts) {
        const received = depositsByAccount.get(acct.id) ?? { amount: 0, qty: 0 };
        bankReceived += received.amount;
        bankDepositQty += received.qty;
        rows.push({
          section: `bank:${acct.id}`,
          label: `Bank · ${acct.name}`,
          amount: received.amount,
          qty: received.qty,
          meta: [acct.bankName, acct.accountNumber, `balance ${acct.balance}`].filter(Boolean).join(" · "),
        });
      }
    } catch {
      // ignore bank API failures
    }

    if (bankPosReceived > 0 || bankPosQty > 0) {
      rows.push({
        section: "bankPos",
        label: "Bank transfer (POS sales)",
        amount: bankPosReceived,
        qty: bankPosQty,
        meta: "Not linked to a specific bank account",
      });
      bankReceived += bankPosReceived;
      bankDepositQty += bankPosQty;
    }

    return {
      ...meta,
      rows,
      totals: {
        deliveryCharges,
        serviceCharges,
        tax16,
        tax8,
        taxOther,
        discount: discountTotal,
        canceledOrders: canceledAmount,
        canceledQty: voidBills.length,
        cashReceived,
        remainingCash,
        cardReceived,
        walletReceived,
        bankReceived,
        bills: bills.length,
        serviceQty,
        deliveryQty,
        discountQty,
        tax16Qty,
        tax8Qty,
        cashQty,
        cardQty,
        walletQty,
        bankDepositQty,
      },
      empty: bills.length === 0 && voidBills.length === 0 && remainingCash === 0 && bankReceived === 0,
    };
  }

  if (reportId === "item-remove") {
    const data = await fetchKitchenCancellations(branchCode, { from, to });
    const rows = data.cancellations
      .filter((c) => inRange(c.canceledAt, from, to, fromTime, toTime))
      .map((c) => ({
        label: c.label,
        qty: c.qtyCanceled,
        amount: c.qtyCanceled * (c.unitPricePkr ?? 0),
        meta: `${c.ticketRef} · ${c.source}`,
      }));
    return {
      ...meta,
      rows,
      totals: {
        qty: rows.reduce((s, r) => s + (r.qty ?? 0), 0),
        amount: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
      },
      empty: rows.length === 0,
    };
  }

  if (reportId === "canceled-orders") {
    const voidBills = (await fetchCompletedOrders(branchCode)).filter(
      (b) => b.status === "void" && inRange(b.createdAt, from, to, fromTime, toTime),
    );
    const rows = voidBills.map((b) => ({
      label: b.billRef,
      amount: b.total,
      meta: `${b.tableLabel} · ${b.waiterName}`,
    }));
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "kitchen-printing-logs" || reportId === "kitchen-missing-log") {
    const tickets = await fetchKitchenTickets(branchCode, { scope: "all" });
    const ranged = tickets.filter((t) => inRange(t.createdAt, from, to, fromTime, toTime));
    if (reportId === "kitchen-missing-log") {
      const cancels = await fetchKitchenCancellations(branchCode, { from, to });
      const rows = [
        ...cancels.cancellations.map((c) => ({
          label: c.label,
          qty: c.qtyCanceled,
          meta: `Missing after KOT · ${c.ticketRef} · ${c.source}`,
        })),
        ...ranged
          .filter((t) => t.status === "new" || t.status === "cooking")
          .map((t) => ({
            label: t.ticketRef,
            meta: `Still open · ${t.stationLabel} · ${t.status}`,
          })),
      ];
      return { ...meta, rows, empty: rows.length === 0 };
    }
    const rows = ranged.map((t) => ({
      label: t.ticketRef,
      qty: 1,
      meta: [t.orderRef, t.stationLabel, t.status, t.createdAt].filter(Boolean).join(" · "),
    }));
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "vendor-ledger" || reportId === "vendors-balance") {
    const vendorBills = await fetchVendorBills(branchCode);
    if (reportId === "vendors-balance") {
      const map = new Map<string, { debit: number; credit: number }>();
      for (const b of vendorBills) {
        const name = b.supplierName || "Vendor";
        const cur = map.get(name) ?? { debit: 0, credit: 0 };
        cur.debit += b.amount;
        cur.credit += b.paid ?? 0;
        map.set(name, cur);
      }
      const rows = [...map.entries()].map(([label, v]) => ({
        label,
        debit: v.debit,
        credit: v.credit,
        balance: v.debit - v.credit,
        amount: v.debit - v.credit,
      }));
      return { ...meta, rows, empty: rows.length === 0 };
    }
    const rows = vendorBills
      .filter((b) => inRange(b.createdAt, from, to, fromTime, toTime))
      .map((b) => ({
        label: b.supplierName || "Vendor",
        debit: b.amount,
        credit: b.paid ?? 0,
        amount: b.amount,
        meta: `Bill ${b.billRef}`,
      }));
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "customer-ledger") {
    const invoices = await fetchCustomerInvoices(branchCode);
    const ranged = invoices.filter((inv) => inRange(inv.createdAt, from, to, fromTime, toTime));
    const map = new Map<
      string,
      { debit: number; credit: number; balance: number; qty: number; phone: string | null }
    >();
    for (const inv of ranged) {
      const key = `${inv.customerName}|${inv.customerPhone ?? ""}`;
      const cur = map.get(key) ?? {
        debit: 0,
        credit: 0,
        balance: 0,
        qty: 0,
        phone: inv.customerPhone,
      };
      cur.debit += inv.amount;
      cur.credit += inv.paid;
      cur.balance += inv.balance;
      cur.qty += 1;
      map.set(key, cur);
    }
    const rows = [...map.entries()]
      .map(([key, v]) => {
        const label = key.split("|")[0] || "Customer";
        return {
          label,
          debit: v.debit,
          credit: v.credit,
          balance: v.balance,
          amount: v.balance,
          qty: v.qty,
          meta: [v.phone, `${v.qty} invoice(s)`, `outstanding ${v.balance}`].filter(Boolean).join(" · "),
        };
      })
      .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
    return {
      ...meta,
      rows,
      totals: {
        debit: rows.reduce((s, r) => s + (r.debit ?? 0), 0),
        credit: rows.reduce((s, r) => s + (r.credit ?? 0), 0),
        balance: rows.reduce((s, r) => s + (r.balance ?? 0), 0),
        customers: rows.length,
      },
      empty: rows.length === 0,
    };
  }

  if (reportId === "employee-ledger") {
    const [employees, advances, allBills] = await Promise.all([
      fetchEmployees(branchCode),
      fetchEmployeeAdvances(branchCode).catch(() => []),
      fetchCompletedOrders(branchCode),
    ]);
    const bills = allBills.filter(
      (b) => b.status === "completed" && inRange(b.createdAt, from, to, fromTime, toTime),
    );
    const salesByName = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      const name = (bill.waiterName || "").trim().toLowerCase();
      if (!name) continue;
      const cur = salesByName.get(name) ?? { qty: 0, amount: 0 };
      cur.qty += 1;
      cur.amount += bill.total;
      salesByName.set(name, cur);
    }
    const advanceById = new Map(advances.map((a) => [a.employeeId, a]));
    const rows = employees
      .filter((e) => e.employmentStatus !== "terminated")
      .map((e) => {
        const adv = advanceById.get(e.id);
        const openAdvance = adv?.openAdvancePkr ?? 0;
        const sales = salesByName.get(e.displayName.trim().toLowerCase()) ?? { qty: 0, amount: 0 };
        const remaining = Math.max(0, e.baseSalaryPkr - openAdvance);
        return {
          label: e.displayName,
          debit: e.baseSalaryPkr,
          credit: openAdvance,
          balance: remaining,
          amount: sales.amount,
          qty: sales.qty,
          meta: [
            e.jobTitle,
            e.employeeCode,
            `advances ${adv?.openAdvanceCount ?? 0}`,
            sales.qty > 0 ? `${sales.qty} sales` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      ...meta,
      rows,
      totals: {
        salary: rows.reduce((s, r) => s + (r.debit ?? 0), 0),
        advances: rows.reduce((s, r) => s + (r.credit ?? 0), 0),
        remaining: rows.reduce((s, r) => s + (r.balance ?? 0), 0),
        sales: rows.reduce((s, r) => s + (r.amount ?? 0), 0),
        employees: rows.length,
      },
      empty: rows.length === 0,
    };
  }

  const bills = (await fetchCompletedOrders(branchCode)).filter(
    (b) => b.status === "completed" && inRange(b.createdAt, from, to, fromTime, toTime),
  );

  if (reportId === "sales-by-item") {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      for (const line of parseLines(bill)) {
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
      ...meta,
      rows,
      totals: { amount: rows.reduce((s, r) => s + r.amount, 0), qty: rows.reduce((s, r) => s + r.qty, 0) },
      empty: rows.length === 0,
    };
  }

  if (reportId === "sales-by-employee") {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      const label = (bill.waiterName || "Unassigned").trim() || "Unassigned";
      const cur = map.get(label) ?? { qty: 0, amount: 0 };
      cur.qty += 1;
      cur.amount += bill.total;
      map.set(label, cur);
    }
    const rows = [...map.entries()]
      .map(([label, v]) => ({ label, qty: v.qty, amount: v.amount, meta: `${v.qty} orders` }))
      .sort((a, b) => b.amount - a.amount);
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "delivery") {
    const delivery = bills.filter((b) => inferOrderType(b.tableLabel, b.notes) === "Delivery");
    const rows = delivery.map((b) => ({
      label: b.billRef,
      amount: b.total,
      meta: b.notes ?? "",
    }));
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "discount") {
    const discounted = bills.filter((b) => (b.discount ?? 0) > 0);
    const rows = discounted.map((b) => ({
      label: b.billRef,
      amount: b.discount,
      meta: `${b.waiterName} · total ${b.total}`,
    }));
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "sales-by-order-type") {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      const label = inferOrderType(bill.tableLabel, bill.notes);
      const cur = map.get(label) ?? { qty: 0, amount: 0 };
      cur.qty += 1;
      cur.amount += bill.total;
      map.set(label, cur);
    }
    const rows = [...map.entries()]
      .map(([label, v]) => ({ label, qty: v.qty, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount);
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "sales-by-kitchen") {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      for (const line of parseLines(bill)) {
        const kitchen = (line.kitchen || line.station || "Main kitchen").trim() || "Main kitchen";
        const qty = Number(line.qty ?? 0);
        const amount = qty * Number(line.unitPrice ?? 0);
        const cur = map.get(kitchen) ?? { qty: 0, amount: 0 };
        cur.qty += qty;
        cur.amount += amount;
        map.set(kitchen, cur);
      }
    }
    if (map.size === 0) {
      map.set("Main kitchen", {
        qty: bills.length,
        amount: bills.reduce((s, b) => s + b.total, 0),
      });
    }
    const rows = [...map.entries()].map(([label, v]) => ({ label, qty: v.qty, amount: v.amount }));
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "table-server-change") {
    const dineIn = bills.filter((b) => inferOrderType(b.tableLabel, b.notes) === "Dine-in");
    const rows = dineIn.map((b) => ({
      label: b.tableLabel,
      amount: b.total,
      meta: `${b.waiterName} · ${b.billRef} · ${b.createdAt}`,
    }));
    return { ...meta, rows, empty: rows.length === 0 };
  }

  if (reportId === "sales-by-hall") {
    const tableToHall = new Map<string, string>();
    try {
      const floor = await fetchBranchFloor(branchCode);
      const sectionName = new Map(floor.sections.map((s) => [s.id, s.name]));
      for (const t of floor.tables) {
        tableToHall.set(String(t.tableNumber), sectionName.get(t.sectionId) ?? "Main hall");
      }
    } catch {
      // ignore
    }
    const map = new Map<string, { qty: number; amount: number }>();
    for (const bill of bills) {
      const type = inferOrderType(bill.tableLabel, bill.notes);
      let hall = type === "Dine-in" ? "Main hall" : type;
      if (type === "Dine-in") {
        const num = (bill.tableLabel.match(/\d+/) ?? [])[0];
        if (num && tableToHall.has(num)) hall = tableToHall.get(num)!;
        else if (bill.tableLabel.includes("·")) hall = bill.tableLabel.split("·")[0]?.trim() || hall;
      }
      const cur = map.get(hall) ?? { qty: 0, amount: 0 };
      cur.qty += 1;
      cur.amount += bill.total;
      map.set(hall, cur);
    }
    const rows = [...map.entries()].map(([label, v]) => ({ label, qty: v.qty, amount: v.amount }));
    return { ...meta, rows, empty: rows.length === 0 };
  }

  return { ...meta, rows: [], empty: true };
}
