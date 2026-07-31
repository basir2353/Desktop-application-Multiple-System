import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  fetchCustomerInvoices,
  fetchExpenses,
  fetchVendorBills,
} from "../src/api/accounting";
import { fetchOrders } from "../src/api/billing";
import { fetchEmployeeAdvances } from "../src/api/hr";
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

type TabId = "charges" | "discount" | "party" | "salary" | "expense";

const TABS: { id: TabId; label: string }[] = [
  { id: "charges", label: "Charges" },
  { id: "discount", label: "Discount" },
  { id: "party", label: "Party" },
  { id: "salary", label: "Salary" },
  { id: "expense", label: "Expense" },
];

export default function AdminReportsScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const branchCode = branch?.code;
  const [tab, setTab] = useState<TabId>("charges");
  const [range, setRange] = useState<DateRangeValue>(defaultDateRange);

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", branchCode],
    queryFn: () => fetchOrders(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });
  const invoicesQuery = useQuery({
    queryKey: ["admin", "receivable", branchCode],
    queryFn: () => fetchCustomerInvoices(branchCode!),
    enabled: allowed && Boolean(branchCode) && (tab === "party" || tab === "charges"),
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

  const rangedOrders = useMemo(
    () => filterOrdersByDateRange(ordersQuery.data ?? [], range.from, range.to),
    [ordersQuery.data, range.from, range.to],
  );
  const charges = useMemo(() => chargesReportFromOrders(rangedOrders), [rangedOrders]);
  const discounts = useMemo(() => discountRowsFromOrders(rangedOrders), [rangedOrders]);

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
