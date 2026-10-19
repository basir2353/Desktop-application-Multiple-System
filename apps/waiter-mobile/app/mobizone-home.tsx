import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import { MzCard, MzEmpty, MzNavyHeader } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

type Action = {
  title: string;
  icon: string;
  href: string;
  metric?: "sales" | "purchase" | "profit" | "due";
};

const ACTIONS: Action[] = [
  { title: "New Sale", icon: "↗", href: "/mobizone-sale" },
  { title: "Purchase", icon: "↙", href: "/mobizone-purchase" },
  { title: "Customers", icon: "◉", href: "/mobizone-customers" },
  { title: "Stock", icon: "▣", href: "/mobizone-stock" },
  { title: "Total Sales", icon: "Rs", href: "/mobizone-reports", metric: "sales" },
  { title: "Total Purchase", icon: "Rs", href: "/mobizone-reports", metric: "purchase" },
  { title: "Today Profit", icon: "★", href: "/mobizone-reports", metric: "profit" },
  { title: "Due Receive", icon: "⏳", href: "/mobizone-reports", metric: "due" },
];

export default function MobizoneHomeScreen(): React.JSX.Element {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = useBranchStore((s) => s.branch);
  const { dashboard, db, refresh, ready } = useMobizoneDb();

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const cashBank = (dashboard?.cashBalancePkr ?? 0) + (dashboard?.bankBalancePkr ?? 0);
  const investment = cashBank + (dashboard?.stockValuePkr ?? 0);
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const recent = [...db.sales, ...db.purchases]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  function metricValue(key?: Action["metric"]): string | null {
    if (!key || !dashboard) return null;
    if (key === "sales") return formatPkr(dashboard.todaySalesPkr);
    if (key === "purchase") return formatPkr(dashboard.todayPurchasesPkr);
    if (key === "profit") return formatPkr(dashboard.todayProfitPkr);
    return formatPkr(dashboard.pendingReceivablesPkr);
  }

  return (
    <MzShell>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={!ready} onRefresh={refresh} tintColor={mz.gold} />
        }
      >
        <MzNavyHeader
          title="MobiZone"
          subtitle={`${branch?.name ?? "Main Shop"} · Mobile Business ERP`}
          right={
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(184,150,83,0.25)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: mz.gold,
              }}
            >
              <Text style={{ color: mz.gold, fontWeight: "800" }}>MZ</Text>
            </View>
          }
        />

        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: mz.white,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: mz.border,
          }}
        >
          <Text style={{ color: mz.navy, fontWeight: "700", fontSize: 13 }}>{todayLabel}</Text>
        </View>

        <View
          style={{
            backgroundColor: mz.navy,
            borderRadius: 18,
            padding: 18,
            borderWidth: 1,
            borderColor: mz.goldDim,
          }}
        >
          <Text
            style={{
              color: "rgba(246,244,239,0.7)",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 1,
            }}
          >
            TOTAL BALANCE
          </Text>
          <Text style={{ color: mz.gold, fontSize: 34, fontWeight: "800", marginTop: 6 }}>
            {formatPkr(investment)}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 16,
              marginTop: 14,
              borderTopWidth: 1,
              borderTopColor: "rgba(184,150,83,0.25)",
              paddingTop: 12,
            }}
          >
            <Mini label="Cash" value={formatPkr(dashboard?.cashBalancePkr ?? 0)} />
            <Mini label="Bank" value={formatPkr(dashboard?.bankBalancePkr ?? 0)} />
            <Mini label="Stock" value={formatPkr(dashboard?.stockValuePkr ?? 0)} />
          </View>
        </View>

        <MzCard style={{ padding: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {ACTIONS.map((a) => {
              const value = metricValue(a.metric);
              return (
                <Pressable
                  key={a.title}
                  onPress={() => router.push(a.href as never)}
                  style={{
                    width: "47.5%",
                    backgroundColor: mz.ivory,
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: mz.border,
                    minHeight: 92,
                  }}
                >
                  <Text style={{ color: mz.navy, fontSize: 16, fontWeight: "800" }}>{a.icon}</Text>
                  <Text style={{ color: mz.navy, fontWeight: "800", fontSize: 13, marginTop: 8 }}>
                    {a.title}
                  </Text>
                  <Text style={{ color: mz.goldDim, fontWeight: "700", fontSize: 11, marginTop: 3 }}>
                    {value ?? "Open"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </MzCard>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: mz.navy, fontWeight: "800", fontSize: 15 }}>Recent activity</Text>
          <Pressable onPress={() => router.push("/mobizone-reports" as never)}>
            <Text style={{ color: mz.goldDim, fontWeight: "700", fontSize: 12 }}>View all</Text>
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <MzEmpty title="No recent activity yet" note="Sale ya purchase save karo — yahan dikhega" />
        ) : (
          recent.map((row) => {
            const isSale = "pricePkr" in row;
            return (
              <MzCard
                key={row.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                }}
              >
                <View>
                  <Text style={{ color: mz.navy, fontWeight: "700" }}>
                    {isSale ? "Sale" : "Purchase"} · {row.brand} {row.model}
                  </Text>
                  <Text style={{ color: mz.muted, fontSize: 11, marginTop: 2 }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Text style={{ color: isSale ? mz.teal : mz.orange, fontWeight: "800" }}>
                  {formatPkr(isSale ? row.pricePkr : row.purchasePricePkr)}
                </Text>
              </MzCard>
            );
          })
        )}
      </ScrollView>
    </MzShell>
  );
}

function Mini({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View>
      <Text style={{ color: "rgba(246,244,239,0.65)", fontSize: 11 }}>{label}</Text>
      <Text style={{ color: mz.gold, fontWeight: "700", fontSize: 13 }}>{value}</Text>
    </View>
  );
}
