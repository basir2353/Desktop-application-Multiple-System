import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fetchAccountingDashboard } from "../src/api/accounting";
import { fetchOrgUsers, fetchSecurityOverview, fetchTaxFeatures, roleLabel } from "../src/api/admin";
import { fetchOrders } from "../src/api/billing";
import { fetchDashboard, fetchPopsBranches } from "../src/api/operations";
import {
  ActionTile,
  Card,
  Notice,
  Screen,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { formatPkr, salesMetricsFromOrders } from "../src/lib/orderSales";
import { canTogglePra, isAdminOrIncharge } from "../src/lib/roles";
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
    queryFn: fetchTaxFeatures,
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

  if (!allowed) {
    return <Redirect href="/" />;
  }

  const users = usersQuery.data ?? [];
  const activeUsers = users.filter((u) => u.active).length;
  const failed = activityQuery.data?.failedLogins24h ?? 0;
  const devices = activityQuery.data?.activeDevices ?? 0;
  const praOn = taxQuery.data?.praEnabled ?? false;
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
    <Screen safeTop>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Title>Admin Dashboard</Title>
            <Subtitle>
              {waiterEmail ?? claims?.sub ?? "Incharge"} · {roleName}
              {"\n"}
              Sales · live ops · users · activity · PRA
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
                      borderRadius: 8,
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

        <Subtitle>Live sales & operations{branchCode ? ` · ${branchCode}` : ""}</Subtitle>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Sales (today)"
            value={ordersQuery.isLoading && !orderSales.todayAmountPkr ? "…" : formatPkr(salesToday)}
            hint={
              salesChange !== 0
                ? `${salesChange >= 0 ? "+" : ""}${salesChange}% vs yesterday · ${orderSales.todayOrderCount} orders`
                : `${orderSales.todayOrderCount} orders today`
            }
            accent={colors.success}
          />
          <StatCard
            label="All sales"
            value={ordersQuery.isLoading ? "…" : formatPkr(orderSales.allCompletedAmountPkr)}
            hint={`${orderSales.orderCount} completed`}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Active orders"
            value={dashboardQuery.isLoading ? "…" : String(metrics?.activeOrders.total ?? 0)}
            hint={
              metrics
                ? `DI ${metrics.activeOrders.dineIn} · TW ${metrics.activeOrders.takeaway} · DL ${metrics.activeOrders.delivery}`
                : "Live pulse"
            }
          />
          <StatCard
            label="Kitchen"
            value={dashboardQuery.isLoading ? "…" : String(metrics?.kitchenQueue.total ?? 0)}
            hint={
              metrics
                ? `${metrics.kitchenQueue.priority} priority · ${metrics.kitchenQueue.slaStatus}`
                : "Queue"
            }
            accent={
              metrics?.kitchenQueue.slaStatus === "red"
                ? colors.danger
                : metrics?.kitchenQueue.slaStatus === "yellow"
                  ? colors.warning
                  : undefined
            }
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

        <Subtitle>Access & compliance</Subtitle>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Users" value={users.length} hint={`${activeUsers} active`} />
          <StatCard
            label="Failed logins"
            value={failed}
            hint="Last 24h"
            accent={failed > 0 ? colors.danger : undefined}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Devices" value={devices} hint="Active sessions" />
          <StatCard
            label="PRA"
            value={praOn ? "ON" : "OFF"}
            hint={canTogglePra(claims) ? "You can toggle" : "Admin/Incharge only"}
            accent={praOn ? colors.success : colors.muted}
          />
        </View>

        <ActionTile
          icon="💰"
          title="Sales & reports"
          subtitle="All sales, channels, top items sold"
          onPress={() => router.push("/admin-sales")}
          variant="primary"
        />
        <ActionTile
          icon="👥"
          title="User management & access"
          subtitle="Create users, roles, enable / disable access"
          onPress={() => router.push("/admin-users")}
        />
        <ActionTile
          icon="📋"
          title="Activity & reports"
          subtitle="Which user performed which action"
          onPress={() => router.push("/admin-activity")}
        />
        <ActionTile
          icon="🧾"
          title="PRA on / off"
          subtitle={
            canTogglePra(claims)
              ? "Enable or disable PRA for this organization"
              : "Only Admin / Incharge can change this"
          }
          onPress={() => router.push("/admin-pra")}
          variant={canTogglePra(claims) ? "primary" : "default"}
        />

        <Card>
          <Subtitle>API</Subtitle>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{getApiBaseUrl()}</Text>
        </Card>

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
    </Screen>
  );
}
