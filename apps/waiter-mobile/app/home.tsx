import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchOrders } from "../src/api/billing";
import { fetchKitchenTickets } from "../src/api/kitchen";
import { fetchBranchFloor } from "../src/api/tables";
import {
  Card,
  Screen,
  SectionHeader,
  StatCard,
  StatusBadge,
  colors,
} from "../src/components/ui";
import {
  formatPkr,
  formatTimeAgo,
  greetingForHour,
  isToday,
  kitchenStatusAccent,
  kitchenStatusLabel,
  orderRefFromTicket,
  waiterDisplayName,
} from "../src/lib/orderDisplay";
import { buildUnifiedOrders } from "../src/lib/orderHistory";
import { resolveStaffRole, canCloseOrders } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route: "/order" | "/orders" | "/history";
  primary?: boolean;
  historyFilter?: "held";
};

export default function HomeScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const waiterEmail = useSessionStore((s) => s.waiterEmail);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const clearBranch = useBranchStore((s) => s.clear);

  const branchCode = branch?.code ?? "";

  const kitchenQuery = useQuery({
    queryKey: ["kitchen", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchKitchenTickets(branchCode),
    refetchInterval: 8_000,
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchOrders(branchCode),
    refetchInterval: 12_000,
  });

  const floorQuery = useQuery({
    queryKey: ["tables", branchCode],
    enabled: Boolean(branchCode),
    queryFn: () => fetchBranchFloor(branchCode),
  });

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (resolveStaffRole(claims) === "rider") {
    return <Redirect href="/rider-home" />;
  }

  if (!branch) {
    return <Redirect href="/branch" />;
  }

  const tickets = kitchenQuery.data ?? [];
  const bills = ordersQuery.data ?? [];
  const unified = buildUnifiedOrders(bills, tickets);
  const activeTickets = tickets.filter((t) => t.status !== "done");
  const readyCount = activeTickets.filter((t) => t.status === "ready").length;
  const cookingCount = activeTickets.filter((t) => t.status === "cooking").length;
  const todayOrders = unified.filter((order) => isToday(order.createdAt));
  const todayBills = bills.filter((b) => isToday(b.createdAt) && b.status === "completed");
  const todaySales = todayBills.reduce((sum, bill) => sum + bill.total, 0);
  const tableCount = (floorQuery.data?.tables ?? []).filter((t) => t.isActive).length;
  const recentTickets = [...activeTickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  const refreshing = kitchenQuery.isFetching || ordersQuery.isFetching;
  const displayName = waiterDisplayName(waiterEmail);

  const heldBills = bills.filter((b) => b.status === "held");
  const cashierMode = canCloseOrders(claims);

  function refreshAll(): void {
    void kitchenQuery.refetch();
    void ordersQuery.refetch();
    void floorQuery.refetch();
  }

  const quickActions: QuickAction[] = [
    {
      id: "take",
      title: "Take order",
      subtitle: "Table · menu · send to kitchen",
      icon: "＋",
      route: "/order",
      primary: true,
    },
    {
      id: "view",
      title: "View orders",
      subtitle: `${activeTickets.length} active · ${cookingCount} cooking`,
      icon: "◎",
      route: "/orders",
    },
    {
      id: "history",
      title: "Order history",
      subtitle: `${todayOrders.length} today · search & filter`,
      icon: "◷",
      route: "/history",
    },
    ...(cashierMode
      ? [
          {
            id: "close",
            title: "Close orders",
            subtitle: `${heldBills.length} on hold · collect payment`,
            icon: "₨",
            route: "/history" as const,
            historyFilter: "held" as const,
          },
        ]
      : []),
    {
      id: "tables",
      title: "Floor tables",
      subtitle: `${tableCount} active tables`,
      icon: "▦",
      route: "/order",
    },
  ];

  return (
    <Screen style={styles.screen} safeTop>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.accent} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.greeting}>{greetingForHour()}</Text>
            <Text style={styles.waiterName}>{displayName}</Text>
            <View style={styles.branchRow}>
              <View style={styles.branchBadge}>
                <Text style={styles.branchBadgeText}>{branch.code}</Text>
              </View>
              <Text style={styles.branchName} numberOfLines={1}>
                {branch.name}
              </Text>
            </View>
          </View>
          <View style={styles.liveDotWrap}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>Live</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Active"
            value={activeTickets.length}
            hint="In kitchen"
            accent={colors.accent}
          />
          <StatCard
            label="Ready"
            value={readyCount}
            hint="To serve"
            accent={colors.success}
          />
          <StatCard
            label="Today"
            value={formatPkr(todaySales)}
            hint={`${todayOrders.length} orders`}
          />
        </View>

        <Card style={styles.actionsCard}>
          <SectionHeader title="Quick actions" />
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <Pressable
                key={action.id}
                onPress={() =>
                  router.push(
                    action.historyFilter
                      ? { pathname: "/history", params: { filter: action.historyFilter } }
                      : action.route,
                  )
                }
                style={({ pressed }) => [
                  styles.actionTile,
                  action.primary && styles.actionTilePrimary,
                  pressed && styles.actionTilePressed,
                ]}
              >
                <View
                  style={[
                    styles.actionIconWrap,
                    action.primary && styles.actionIconWrapPrimary,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionIcon,
                      action.primary && styles.actionIconPrimary,
                    ]}
                  >
                    {action.icon}
                  </Text>
                </View>
                <View style={styles.actionCopy}>
                  <Text
                    style={[
                      styles.actionTitle,
                      action.primary && styles.actionTitlePrimary,
                    ]}
                  >
                    {action.title}
                  </Text>
                  <Text
                    style={[
                      styles.actionSubtitle,
                      action.primary && styles.actionSubtitlePrimary,
                    ]}
                    numberOfLines={2}
                  >
                    {action.subtitle}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.actionChevron,
                    action.primary && styles.actionChevronPrimary,
                  ]}
                >
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={styles.pulseCard}>
          <SectionHeader
            title="Live pulse"
            actionLabel={recentTickets.length > 0 ? "View all" : undefined}
            onAction={recentTickets.length > 0 ? () => router.push("/orders") : undefined}
          />
          {kitchenQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.loadingText}>Syncing kitchen…</Text>
            </View>
          ) : recentTickets.length === 0 ? (
            <View style={styles.emptyPulse}>
              <Text style={styles.emptyPulseIcon}>✦</Text>
              <Text style={styles.emptyPulseTitle}>All quiet for now</Text>
              <Text style={styles.emptyPulseText}>
                Start a new order from Take order — tickets appear here in real time.
              </Text>
              <Pressable onPress={() => router.push("/order")} style={styles.emptyPulseBtn}>
                <Text style={styles.emptyPulseBtnText}>Take order</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.pulseList}>
              {recentTickets.map((ticket) => {
                const status = kitchenStatusLabel(ticket.status);
                const accent = kitchenStatusAccent(ticket.status);
                return (
                  <Pressable
                    key={ticket.id}
                    onPress={() => router.push("/orders")}
                    style={({ pressed }) => [
                      styles.pulseItem,
                      { borderLeftColor: accent },
                      pressed && styles.pulseItemPressed,
                    ]}
                  >
                    <View style={styles.pulseTop}>
                      <Text style={styles.pulseRef}>{orderRefFromTicket(ticket)}</Text>
                      <StatusBadge status={status} />
                    </View>
                    <View style={styles.pulseMetaRow}>
                      <View style={styles.tablePill}>
                        <Text style={styles.tablePillText}>{ticket.stationLabel}</Text>
                      </View>
                      <Text style={styles.pulseTime}>{formatTimeAgo(ticket.createdAt)}</Text>
                    </View>
                    <Text style={styles.pulseItems} numberOfLines={2}>
                      {ticket.itemsSummary}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              clearBranch();
              router.replace("/branch");
            }}
            style={styles.footerBtn}
          >
            <Text style={styles.footerText}>Change branch</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              clearSession();
              clearBranch();
              router.replace("/");
            }}
            style={styles.footerBtn}
          >
            <Text style={styles.footerTextDanger}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 36,
  },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  greeting: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "500",
  },
  waiterName: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  branchBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  branchBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  branchName: {
    color: colors.muted,
    fontSize: 13,
    flex: 1,
  },
  liveDotWrap: {
    alignItems: "center",
    gap: 4,
    paddingTop: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  liveLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionsCard: {
    gap: 12,
  },
  actionsGrid: {
    gap: 10,
  },
  actionTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0b1220",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  actionTilePrimary: {
    backgroundColor: colors.accent,
    borderColor: "#d97706",
  },
  actionTilePressed: {
    opacity: 0.9,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconWrapPrimary: {
    backgroundColor: "rgba(15, 23, 42, 0.2)",
    borderColor: "rgba(15, 23, 42, 0.15)",
  },
  actionIcon: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
  },
  actionIconPrimary: {
    color: colors.accentText,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  actionTitlePrimary: {
    color: colors.accentText,
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  actionSubtitlePrimary: {
    color: "rgba(15, 23, 42, 0.72)",
  },
  actionChevron: {
    color: colors.muted,
    fontSize: 22,
    fontWeight: "300",
  },
  actionChevronPrimary: {
    color: colors.accentText,
  },
  pulseCard: {
    gap: 12,
  },
  loadingWrap: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 13,
  },
  emptyPulse: {
    alignItems: "center",
    backgroundColor: "#0b1220",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyPulseIcon: {
    color: colors.accent,
    fontSize: 22,
  },
  emptyPulseTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyPulseText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyPulseBtn: {
    marginTop: 6,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyPulseBtnText: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: "700",
  },
  pulseList: {
    gap: 10,
  },
  pulseItem: {
    backgroundColor: "#0b1220",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: 14,
    gap: 8,
  },
  pulseItemPressed: {
    opacity: 0.88,
  },
  pulseTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pulseRef: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 15,
    fontWeight: "700",
  },
  pulseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tablePill: {
    backgroundColor: "#1e293b",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tablePillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  pulseTime: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  pulseItems: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  footerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  footerText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  footerTextDanger: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
});
