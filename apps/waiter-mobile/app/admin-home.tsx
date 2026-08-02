import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchAccountingDashboard } from "../src/api/accounting";
import { fetchOrgUsers, fetchSecurityOverview, roleLabel } from "../src/api/admin";
import { fetchOrders } from "../src/api/billing";
import { fetchDashboard, fetchPopsBranches } from "../src/api/operations";
import { fetchTaxFeaturesNormalized } from "../src/api/pra";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  ActionTile,
  Card,
  Notice,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import {
  currentBusinessDateKey,
  filterOrdersByDate,
  formatPkr,
  ownerDashboardFromOrders,
  salesMetricsFromOrders,
} from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminHomeScreen() {
  const router = useRouter();
  const claims = useSessionStore((s) => s.claims);
  const waiterEmail = useSessionStore((s) => s.waiterEmail);
  const clear = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const setBranch = useBranchStore((s) => s.setBranch);
  const allowed = isAdminOrIncharge(claims);
  const insets = useSafeAreaInsets();

  const branchesQuery = useQuery({
    queryKey: ["admin", "branches"],
    queryFn: fetchPopsBranches,
    enabled: allowed,
  });

  const visibleBranches = useMemo(() => {
    const all = branchesQuery.data ?? [];
    const scope = claims?.branchScope;
    if (!scope || scope.toLowerCase() === "all") return all;
    return all.filter((b) => b.code === scope);
  }, [branchesQuery.data, claims?.branchScope]);

  useEffect(() => {
    if (branch || branchesQuery.isLoading || !visibleBranches.length) return;
    setBranch(visibleBranches[0]);
  }, [branch, branchesQuery.isLoading, visibleBranches, setBranch]);

  const branchCode = branch?.code;

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchOrgUsers,
    enabled: allowed,
  });
  const activityQuery = useQuery({
    queryKey: ["admin", "security"],
    queryFn: () => fetchSecurityOverview(branchCode),
    enabled: allowed,
  });
  const taxQuery = useQuery({
    queryKey: ["admin", "tax-features"],
    queryFn: fetchTaxFeaturesNormalized,
    enabled: allowed,
  });
  const dashboardQuery = useQuery({
    queryKey: ["admin", "ops-dashboard", branchCode],
    queryFn: () => fetchDashboard(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 30_000,
  });
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", branchCode],
    queryFn: () => fetchOrders(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 30_000,
  });
  const accountingQuery = useQuery({
    queryKey: ["admin", "accounting", branchCode],
    queryFn: () => fetchAccountingDashboard(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });

  const orderSales = useMemo(
    () => salesMetricsFromOrders(ordersQuery.data ?? []),
    [ordersQuery.data],
  );

  const todayOwnerMetrics = useMemo(
    () => ownerDashboardFromOrders(filterOrdersByDate(ordersQuery.data ?? [], currentBusinessDateKey())),
    [ordersQuery.data],
  );

  if (!allowed) {
    return <Redirect href="/" />;
  }

  const users = usersQuery.data ?? [];
  const activeUsers = users.filter((u) => u.active).length;
  const failed = activityQuery.data?.failedLogins24h ?? 0;
  const praFakeOn = Boolean(taxQuery.data?.praFakeEnabled);
  const praRealOn = Boolean(taxQuery.data?.praRealEnabled);
  const praOn = praFakeOn || praRealOn || Boolean(taxQuery.data?.praEnabled);
  const roleName = roleLabel(claims?.role ?? "admin");
  const metrics = dashboardQuery.data?.metrics;
  const salesToday =
    orderSales.todayAmountPkr > 0
      ? orderSales.todayAmountPkr
      : metrics?.liveSales.amountPkr ?? 0;
  const salesChange =
    orderSales.todayAmountPkr > 0
      ? orderSales.changePercent
      : metrics?.liveSales.changePercent ?? 0;

  return (
    <AdminShell tab="home" noPadding>
      <ScrollView
        contentContainerStyle={{
          gap: 14,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={
              ordersQuery.isFetching || dashboardQuery.isFetching || taxQuery.isFetching
            }
            onRefresh={() => {
              void ordersQuery.refetch();
              void dashboardQuery.refetch();
              void taxQuery.refetch();
              void accountingQuery.refetch();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Title>POPS Admin</Title>
            <Subtitle>
              {waiterEmail ?? claims?.sub ?? "Incharge"} · {roleName}
            </Subtitle>
          </View>
          <Pressable
            onPress={() => {
              clear();
              router.replace("/");
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12 }}>Sign out</Text>
          </Pressable>
        </View>

        {visibleBranches.length > 0 ? (
          <Card>
            <Subtitle>Branch</Subtitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {visibleBranches.map((b) => {
                const active = branch?.code === b.code;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setBranch(b)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: active ? colors.accent : colors.border,
                      backgroundColor: active ? colors.accent : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.accentText : colors.text,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {b.code}
                    </Text>
                    <Text
                      style={{
                        color: active ? colors.accentText : colors.muted,
                        fontSize: 10,
                      }}
                    >
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>
        ) : null}

        <Subtitle>Live pulse{branchCode ? ` · ${branchCode}` : ""}</Subtitle>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Sales (today)"
            value={ordersQuery.isLoading && !orderSales.todayAmountPkr ? "…" : formatPkr(salesToday)}
            hint={
              salesChange !== 0
                ? `${salesChange >= 0 ? "+" : ""}${salesChange}% · ${orderSales.todayOrderCount} orders`
                : `${orderSales.todayOrderCount} orders today`
            }
            accent={colors.success}
          />
          <StatCard
            label="Active orders"
            value={dashboardQuery.isLoading ? "…" : String(metrics?.activeOrders.total ?? 0)}
            hint={
              metrics
                ? `DI ${metrics.activeOrders.dineIn} · TW ${metrics.activeOrders.takeaway}`
                : "Live"
            }
          />
        </View>

        <Subtitle>Today — owner summary</Subtitle>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Total Sales"
            value={ordersQuery.isLoading ? "…" : formatPkr(todayOwnerMetrics.totalSales)}
            hint={`${todayOwnerMetrics.orderCount} orders`}
            accent={colors.success}
          />
          <StatCard
            label="Total Discount"
            value={formatPkr(todayOwnerMetrics.totalDiscount)}
            hint="Given today"
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Service charges"
            value={formatPkr(todayOwnerMetrics.totalServiceCharges)}
            hint="Collected"
          />
          <StatCard
            label="Delivery charges"
            value={formatPkr(todayOwnerMetrics.totalDeliveryCharges)}
            hint="Collected"
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Cash payments"
            value={formatPkr(todayOwnerMetrics.cashPayments)}
            hint="Today"
          />
          <StatCard
            label="Card payments"
            value={formatPkr(todayOwnerMetrics.cardPayments)}
            hint="Today"
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Cash tax"
            value={formatPkr(todayOwnerMetrics.cashTaxCollected)}
            hint="Collected"
          />
          <StatCard
            label="Card tax"
            value={formatPkr(todayOwnerMetrics.cardTaxCollected)}
            hint="Collected"
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Kitchen"
            value={dashboardQuery.isLoading ? "…" : String(metrics?.kitchenQueue.total ?? 0)}
            hint={metrics ? `${metrics.kitchenQueue.priority} priority` : "Queue"}
            accent={
              metrics?.kitchenQueue.slaStatus === "red"
                ? colors.danger
                : metrics?.kitchenQueue.slaStatus === "yellow"
                  ? colors.warning
                  : undefined
            }
          />
          <StatCard
            label="PRA"
            value={praRealOn ? "Real" : praFakeOn ? "FPRA" : praOn ? "ON" : "OFF"}
            hint={
              praFakeOn ? "FPRA Active" : praRealOn ? "Real Active" : "Inactive"
            }
            accent={praOn ? colors.success : colors.muted}
          />
        </View>

        {accountingQuery.data ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatCard
              label="Month revenue"
              value={formatPkr(accountingQuery.data.monthlyRevenue)}
              hint={`Week ${formatPkr(accountingQuery.data.weeklySales)}`}
            />
            <StatCard
              label="Cash in hand"
              value={formatPkr(accountingQuery.data.cashInHand)}
              hint={`Bank ${formatPkr(accountingQuery.data.bankBalance)}`}
            />
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Users" value={users.length} hint={`${activeUsers} active`} />
          <StatCard
            label="Failed logins"
            value={failed}
            hint="Last 24h"
            accent={failed > 0 ? colors.danger : undefined}
          />
        </View>

        {orderSales.recentSales.length > 0 ? (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Subtitle>Recent sales</Subtitle>
              <Pressable onPress={() => router.push("/admin-sales")}>
                <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>See all</Text>
              </Pressable>
            </View>
            {orderSales.recentSales.slice(0, 5).map((sale) => (
              <View
                key={`${sale.ref}-${sale.time}`}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{sale.ref}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {sale.time} · {sale.type}
                  </Text>
                </View>
                <Text style={{ color: colors.success, fontWeight: "800", fontSize: 13 }}>
                  {formatPkr(sale.amount)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Subtitle>Quick actions</Subtitle>
        <ActionTile
          icon="≡"
          title="Live orders"
          subtitle="Bills · kitchen queue · advance tickets"
          onPress={() => router.push("/admin-orders")}
          variant="primary"
        />
        <ActionTile
          icon="💵"
          title="Cash drawer"
          subtitle="Cashier In · Pay In · Cashier Out"
          onPress={() => router.push("/admin-cash")}
          variant="primary"
        />
        <ActionTile
          icon="💸"
          title="Pay Out"
          subtitle="Supplier · Customer · Employee · Expense"
          onPress={() => router.push("/admin-payout")}
          variant="primary"
        />
        <ActionTile
          icon="📒"
          title="Ledgers"
          subtitle="Vendor pay · Customer receive · invoices"
          onPress={() => router.push("/admin-ledger")}
          variant="primary"
        />
        <ActionTile
          icon="📊"
          title="Reports"
          subtitle="Cash · Customer · party balances"
          onPress={() => router.push("/admin-reports")}
          variant="primary"
        />
        <ActionTile
          icon="₨"
          title="Tax & PRA"
          subtitle="FPRA / Real Active · today · reports"
          onPress={() => router.push("/admin-tax")}
          variant="primary"
        />
        <ActionTile
          icon="☰"
          title="Menu control"
          subtitle="Turn items on or off for this branch"
          onPress={() => router.push("/admin-menu")}
        />
        <ActionTile
          icon="···"
          title="All tools"
          subtitle="Sales · reports · users · stock · tables"
          onPress={() => router.push("/admin-more")}
        />

        {usersQuery.isError ||
        activityQuery.isError ||
        taxQuery.isError ||
        ordersQuery.isError ||
        dashboardQuery.isError ? (
          <Notice>
            {(usersQuery.error as Error)?.message ||
              (activityQuery.error as Error)?.message ||
              (taxQuery.error as Error)?.message ||
              (ordersQuery.error as Error)?.message ||
              (dashboardQuery.error as Error)?.message ||
              "Could not load dashboard"}
          </Notice>
        ) : null}
      </ScrollView>
    </AdminShell>
  );
}
