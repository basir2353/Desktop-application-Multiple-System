import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  fetchCashMovements,
  fetchCustomerInvoices,
  fetchExpenses,
  fetchOpenCashSession,
  fetchVendorBills,
} from "../src/api/accounting";
import { fetchOrders } from "../src/api/billing";
import { fetchEmployeeAdvances } from "../src/api/hr";
import { fetchKitchenCancellations, fetchKitchenTickets } from "../src/api/kitchen";
import { DateRangeFilter, defaultDateRange, type DateRangeValue } from "../src/components/DateRangeFilter";
import { AdminShell } from "../src/components/AdminBottomNav";
import { Card, Notice, Screen, StatCard, Subtitle, colors } from "../src/components/ui";
import { inDateRange } from "../src/lib/dateRange";
import {
  chargesReportFromOrders,
  discountRowsFromOrders,
  filterOrdersByDateRange,
  formatPkr,
} from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type TabId =
  | "cash"
  | "customer"
  | "charges"
  | "discount"
  | "canceled"
  | "edited"
  | "party"
  | "salary"
  | "expense";

const TABS: { id: TabId; label: string }[] = [
  { id: "cash", label: "Cash" },
  { id: "customer", label: "Customer" },
  { id: "charges", label: "Charges" },
  { id: "discount", label: "Discount" },
  { id: "canceled", label: "Canceled" },
  { id: "edited", label: "Edited" },
  { id: "party", label: "Party" },
  { id: "salary", label: "Salary" },
  { id: "expense", label: "Expense" },
];

export default function AdminReportsScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const branchCode = branch?.code;
  const [tab, setTab] = useState<TabId>("cash");
  const [range, setRange] = useState<DateRangeValue>(defaultDateRange);

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", branchCode],
    queryFn: () => fetchOrders(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });
  const invoicesQuery = useQuery({
    queryKey: ["admin", "receivable", branchCode],
    queryFn: () => fetchCustomerInvoices(branchCode!),
    enabled:
      allowed &&
      Boolean(branchCode) &&
      (tab === "party" || tab === "charges" || tab === "customer"),
  });
  const vendorsQuery = useQuery({
    queryKey: ["admin", "payable", branchCode],
    queryFn: () => fetchVendorBills(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "party",
  });
  const advancesQuery = useQuery({
    queryKey: ["admin", "advances", branchCode],
    queryFn: () => fetchEmployeeAdvances(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "salary",
  });
  const expensesQuery = useQuery({
    queryKey: ["admin", "expenses", branchCode],
    queryFn: () => fetchExpenses(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "expense",
  });
  const cashSessionQuery = useQuery({
    queryKey: ["admin", "cash-session-open", branchCode],
    queryFn: () => fetchOpenCashSession(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "cash",
  });
  const cashMovesQuery = useQuery({
    queryKey: ["admin", "cash-movements", cashSessionQuery.data?.id],
    queryFn: () => fetchCashMovements(cashSessionQuery.data!.id),
    enabled: allowed && Boolean(cashSessionQuery.data?.id) && tab === "cash",
  });
  const cancelsQuery = useQuery({
    queryKey: ["admin", "cancellations", branchCode, range.from, range.to],
    queryFn: () =>
      fetchKitchenCancellations(branchCode!, {
        from: range.from,
        to: range.to,
      }),
    enabled: allowed && Boolean(branchCode) && tab === "canceled",
  });
  const kitchenAllQuery = useQuery({
    queryKey: ["admin", "kitchen-all", branchCode],
    queryFn: () => fetchKitchenTickets(branchCode!, { scope: "all" }),
    enabled: allowed && Boolean(branchCode) && tab === "edited",
  });

  const rangedOrders = useMemo(
    () => filterOrdersByDateRange(ordersQuery.data ?? [], range.from, range.to),
    [ordersQuery.data, range.from, range.to],
  );
  const charges = useMemo(() => chargesReportFromOrders(rangedOrders), [rangedOrders]);
  const discounts = useMemo(() => discountRowsFromOrders(rangedOrders), [rangedOrders]);

  const canceledRows = useMemo(() => {
    const list = cancelsQuery.data?.cancellations ?? [];
    const byTicket = new Map<
      string,
      {
        label: string;
        amount: number;
        qty: number;
        by: string | null;
        reason: string | null;
        station: string;
        when: string;
      }
    >();
    for (const c of list) {
      if (c.source !== "order_close") continue;
      if (!inDateRange(c.canceledAt, range.from, range.to)) continue;
      const cur = byTicket.get(c.ticketId) ?? {
        label: c.orderRef?.trim() || c.ticketRef,
        amount: 0,
        qty: 0,
        by: c.canceledByName,
        reason: c.reason ?? null,
        station: c.stationLabel,
        when: c.canceledAt,
      };
      cur.amount += c.qtyCanceled * (c.unitPricePkr ?? 0);
      cur.qty += c.qtyCanceled;
      if (!cur.reason && c.reason) cur.reason = c.reason;
      if (!cur.by && c.canceledByName) cur.by = c.canceledByName;
      byTicket.set(c.ticketId, cur);
    }
    const rows = [...byTicket.values()].sort((a, b) => b.when.localeCompare(a.when));
    return {
      rows,
      totalAmount: rows.reduce((s, r) => s + r.amount, 0),
      totalQty: rows.reduce((s, r) => s + r.qty, 0),
    };
  }, [cancelsQuery.data, range.from, range.to]);

  const editedRows = useMemo(() => {
    const tickets = (kitchenAllQuery.data ?? [])
      .filter((t) => Boolean(t.updatedByName?.trim()) && inDateRange(t.createdAt, range.from, range.to))
      .map((t) => ({
        label: t.orderRef?.trim() || t.ticketRef,
        amount: null as number | null,
        meta: [
          t.stationLabel,
          t.createdByName ? `Taken ${t.createdByName}` : null,
          t.updatedByName ? `Updated ${t.updatedByName}` : null,
          t.status,
        ]
          .filter(Boolean)
          .join(" · "),
        when: t.createdAt,
      }));
    const bills = (ordersQuery.data ?? [])
      .filter((b) => Boolean(b.updatedByName?.trim()) && inDateRange(b.createdAt, range.from, range.to))
      .map((b) => ({
        label: b.orderRef?.trim() || b.billRef,
        amount: b.total,
        meta: [
          b.tableLabel,
          b.waiterName ? `Taken ${b.waiterName}` : null,
          b.updatedByName ? `Updated ${b.updatedByName}` : null,
          b.status,
        ]
          .filter(Boolean)
          .join(" · "),
        when: b.createdAt,
      }));
    const rows = [...tickets, ...bills].sort((a, b) => b.when.localeCompare(a.when));
    return { rows, count: rows.length };
  }, [kitchenAllQuery.data, ordersQuery.data, range.from, range.to]);

  const partyRows = useMemo(() => {
    const customers = new Map<string, { name: string; phone: string | null; balance: number }>();
    for (const inv of invoicesQuery.data ?? []) {
      if (!inDateRange(inv.createdAt, range.from, range.to)) continue;
      const key = `${inv.customerName}|${inv.customerPhone ?? ""}`;
      const existing = customers.get(key);
      if (existing) existing.balance += inv.balance;
      else customers.set(key, { name: inv.customerName, phone: inv.customerPhone, balance: inv.balance });
    }
    const vendors = new Map<string, { name: string; balance: number }>();
    for (const bill of vendorsQuery.data ?? []) {
      if (!inDateRange(bill.createdAt, range.from, range.to)) continue;
      const existing = vendors.get(bill.supplierId);
      if (existing) existing.balance += bill.balance;
      else vendors.set(bill.supplierId, { name: bill.supplierName, balance: bill.balance });
    }
    return {
      customers: [...customers.values()].sort((a, b) => b.balance - a.balance),
      vendors: [...vendors.values()].sort((a, b) => b.balance - a.balance),
      customerTotal: [...customers.values()].reduce((s, r) => s + r.balance, 0),
      vendorTotal: [...vendors.values()].reduce((s, r) => s + r.balance, 0),
    };
  }, [invoicesQuery.data, vendorsQuery.data, range.from, range.to]);

  const salaryRows = useMemo(() => {
    const rows = (advancesQuery.data ?? []).map((row) => ({
      ...row,
      remainingPkr: Math.max(0, row.baseSalaryPkr - row.openAdvancePkr),
    }));
    return {
      rows: rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
      totalRemaining: rows.reduce((s, r) => s + r.remainingPkr, 0),
      totalAdvances: rows.reduce((s, r) => s + r.openAdvancePkr, 0),
    };
  }, [advancesQuery.data]);

  const expenseRows = useMemo(() => {
    const rows = (expensesQuery.data ?? []).filter((e) => {
      const key = e.expenseDate?.slice(0, 10) || e.createdAt;
      return inDateRange(key.length === 10 ? `${key}T12:00:00Z` : key, range.from, range.to);
    });
    return {
      rows,
      total: rows.reduce((s, e) => s + e.amount, 0),
    };
  }, [expensesQuery.data, range.from, range.to]);

  if (!allowed) return <Redirect href="/" />;
  if (!branchCode) {
    return (
      <AdminShell tab="more" noPadding>
        <Screen>
          <Notice>Select a branch on the Admin Dashboard first.</Notice>
        </Screen>
      </AdminShell>
    );
  }

  return (
    <AdminShell tab="more" noPadding>
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 40 }}>
        <Subtitle>
          {branch?.name ?? branchCode} · {branchCode}
          {"\n"}
          Reports · Asia/Karachi
        </Subtitle>

        <Card>
          <DateRangeFilter value={range} onChange={setRange} />
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: on ? colors.accent : colors.border,
                  backgroundColor: on ? colors.accent : colors.card,
                }}
              >
                <Text style={{ color: on ? colors.accentText : colors.text, fontWeight: "700", fontSize: 12 }}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === "cash" ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard
                label="Drawer"
                value={cashSessionQuery.data ? "Open" : "Closed"}
                hint="Cashier In / Out"
                accent={cashSessionQuery.data ? colors.success : colors.muted}
              />
              <StatCard
                label="Expected"
                value={formatPkr(cashSessionQuery.data?.liveExpectedCash ?? 0)}
                hint="Live drawer"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard
                label="Pay In"
                value={formatPkr(
                  (cashMovesQuery.data ?? [])
                    .filter((m) => m.type === "paid_in")
                    .reduce((s, m) => s + m.amountPkr, 0),
                )}
                accent={colors.success}
              />
              <StatCard
                label="Paying Out"
                value={formatPkr(
                  (cashMovesQuery.data ?? [])
                    .filter((m) => m.type === "paid_out")
                    .reduce((s, m) => s + m.amountPkr, 0),
                )}
                accent={colors.warning}
              />
            </View>
            <Card>
              <Subtitle>Session movements</Subtitle>
              {!cashSessionQuery.data ? (
                <Text style={{ color: colors.muted, marginTop: 8 }}>
                  No open drawer — use Cash drawer → Cashier In.
                </Text>
              ) : (cashMovesQuery.data ?? []).length === 0 ? (
                <Text style={{ color: colors.muted, marginTop: 8 }}>No pay in / out yet.</Text>
              ) : (
                [...(cashMovesQuery.data ?? [])]
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                  )
                  .map((m) => (
                    <View
                      key={m.id}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                          {m.type === "paid_in" ? "Pay In / Cashier In" : "Paying Out"}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={2}>
                          {m.reason}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: m.type === "paid_in" ? colors.success : colors.warning,
                          fontWeight: "800",
                        }}
                      >
                        {m.type === "paid_in" ? "+" : "−"}
                        {formatPkr(m.amountPkr)}
                      </Text>
                    </View>
                  ))
              )}
            </Card>
          </>
        ) : null}

        {tab === "customer" ? (
          <>
            <StatCard
              label="Customer outstanding"
              value={formatPkr(partyRows.customerTotal)}
              hint={`${partyRows.customers.length} parties · update in Ledgers`}
              accent={colors.success}
            />
            <Card>
              <Subtitle>Customer report</Subtitle>
              {partyRows.customers.length === 0 ? (
                <Text style={{ color: colors.muted, marginTop: 8 }}>
                  No customer balances in this range.
                </Text>
              ) : (
                partyRows.customers.map((c) => (
                  <View
                    key={`${c.name}-${c.phone}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{c.name}</Text>
                      {c.phone ? (
                        <Text style={{ color: colors.muted, fontSize: 11 }}>{c.phone}</Text>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.success, fontWeight: "800" }}>
                      {formatPkr(c.balance)}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}

        {tab === "charges" ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard label="Sales total" value={formatPkr(charges.salesTotal)} hint={`${charges.orderCount} orders`} accent={colors.success} />
              <StatCard label="Service charges" value={formatPkr(charges.serviceCharges)} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard label="Delivery charges" value={formatPkr(charges.deliveryCharges)} />
              <StatCard label="Tax collected" value={formatPkr(charges.tax)} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard label="Discounts given" value={formatPkr(charges.discount)} accent={colors.warning} />
              <StatCard label="Net (after disc)" value={formatPkr(charges.netAfterDiscount)} />
            </View>
          </>
        ) : null}

        {tab === "discount" ? (
          <>
            <StatCard label="Total discount" value={formatPkr(discounts.total)} hint={`${discounts.rows.length} bills`} accent={colors.warning} />
            <Card>
              {discounts.rows.length === 0 ? (
                <Text style={{ color: colors.muted }}>No discounts in this range.</Text>
              ) : (
                discounts.rows.map((row) => (
                  <View
                    key={`${row.ref}-${row.time}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{row.ref}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {row.time} · {row.channel}
                      </Text>
                    </View>
                    <Text style={{ color: colors.warning, fontWeight: "800" }}>-{formatPkr(row.discount)}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}

        {tab === "canceled" ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard
                label="Canceled orders"
                value={String(canceledRows.rows.length)}
                hint={`${canceledRows.totalQty} items`}
                accent="#f87171"
              />
              <StatCard
                label="Value"
                value={formatPkr(canceledRows.totalAmount)}
                hint="Order cancels"
                accent="#f87171"
              />
            </View>
            <Card>
              {cancelsQuery.isLoading ? (
                <Text style={{ color: colors.muted }}>Loading…</Text>
              ) : cancelsQuery.isError ? (
                <Notice>{(cancelsQuery.error as Error).message}</Notice>
              ) : canceledRows.rows.length === 0 ? (
                <Text style={{ color: colors.muted }}>
                  No canceled orders in this range. Cancel from POS/mobile with a reason to log here.
                </Text>
              ) : (
                canceledRows.rows.map((row) => (
                  <View
                    key={`${row.label}-${row.when}`}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      gap: 2,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, flex: 1 }}>
                        {row.label}
                      </Text>
                      <Text style={{ color: "#f87171", fontWeight: "800" }}>{formatPkr(row.amount)}</Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {[row.station, row.by ? `by ${row.by}` : null, `qty ${row.qty}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    {row.reason ? (
                      <Text style={{ color: colors.text, fontSize: 12 }}>Reason: {row.reason}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}

        {tab === "edited" ? (
          <>
            <StatCard
              label="Edited orders"
              value={String(editedRows.count)}
              hint="Who updated after create"
              accent={colors.accent}
            />
            <Card>
              {kitchenAllQuery.isLoading || ordersQuery.isLoading ? (
                <Text style={{ color: colors.muted }}>Loading…</Text>
              ) : editedRows.rows.length === 0 ? (
                <Text style={{ color: colors.muted }}>
                  No edited orders in this range. Edits appear after someone updates items/notes/table.
                </Text>
              ) : (
                editedRows.rows.map((row) => (
                  <View
                    key={`${row.label}-${row.when}`}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      gap: 2,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13, flex: 1 }}>
                        {row.label}
                      </Text>
                      {row.amount != null ? (
                        <Text style={{ color: colors.accent, fontWeight: "800" }}>{formatPkr(row.amount)}</Text>
                      ) : null}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{row.meta}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}

        {tab === "party" ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard label="Customer balance" value={formatPkr(partyRows.customerTotal)} hint="Receivable" />
              <StatCard label="Vendor balance" value={formatPkr(partyRows.vendorTotal)} hint="Payable" accent={colors.warning} />
            </View>
            <Card>
              <Subtitle>Customers / parties</Subtitle>
              {partyRows.customers.length === 0 ? (
                <Text style={{ color: colors.muted, marginTop: 8 }}>No party balances in range.</Text>
              ) : (
                partyRows.customers.map((c) => (
                  <View
                    key={`${c.name}-${c.phone}`}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{c.name}</Text>
                      {c.phone ? <Text style={{ color: colors.muted, fontSize: 11 }}>{c.phone}</Text> : null}
                    </View>
                    <Text style={{ color: colors.success, fontWeight: "800" }}>{formatPkr(c.balance)}</Text>
                  </View>
                ))
              )}
            </Card>
            <Card>
              <Subtitle>Vendors</Subtitle>
              {partyRows.vendors.length === 0 ? (
                <Text style={{ color: colors.muted, marginTop: 8 }}>No vendor balances in range.</Text>
              ) : (
                partyRows.vendors.map((v) => (
                  <View
                    key={v.name}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{v.name}</Text>
                    <Text style={{ color: colors.warning, fontWeight: "800" }}>{formatPkr(v.balance)}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}

        {tab === "salary" ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard label="Remaining salary" value={formatPkr(salaryRows.totalRemaining)} hint="Base − advances" accent={colors.success} />
              <StatCard label="Open advances" value={formatPkr(salaryRows.totalAdvances)} hint="Already paid out" />
            </View>
            <Card>
              {salaryRows.rows.length === 0 ? (
                <Text style={{ color: colors.muted }}>No staff found.</Text>
              ) : (
                salaryRows.rows.map((row) => (
                  <View
                    key={row.employeeId}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      gap: 2,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{row.employeeName}</Text>
                      <Text style={{ color: colors.success, fontWeight: "800" }}>{formatPkr(row.remainingPkr)}</Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {row.employeeCode} · Base {formatPkr(row.baseSalaryPkr)} · Advance{" "}
                      {formatPkr(row.openAdvancePkr)}
                    </Text>
                  </View>
                ))
              )}
            </Card>
            <Notice>Salary remaining uses current staff balances (not date-sliced). Use Payout to pay salary/advances.</Notice>
          </>
        ) : null}

        {tab === "expense" ? (
          <>
            <StatCard label="Expenses in range" value={formatPkr(expenseRows.total)} hint={`${expenseRows.rows.length} entries`} />
            <Card>
              {expenseRows.rows.length === 0 ? (
                <Text style={{ color: colors.muted }}>No expenses in this range.</Text>
              ) : (
                expenseRows.rows.map((e) => (
                  <View
                    key={e.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{e.category}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {e.expenseDate} · {e.status}
                        {e.vendor ? ` · ${e.vendor}` : ""}
                      </Text>
                    </View>
                    <Text style={{ color: colors.warning, fontWeight: "800" }}>{formatPkr(e.amount)}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : null}

        {ordersQuery.isError ? <Notice>{(ordersQuery.error as Error).message}</Notice> : null}
      </ScrollView>
    </Screen>
    </AdminShell>
  );
}
