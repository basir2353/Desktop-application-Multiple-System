import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import { MzCard, MzScreenTitle } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

type Action = {
  title: string;
  icon: string;
  href: string;
  tone: string;
  metric?: "sales" | "purchase" | "profit" | "due";
};

const ACTIONS: Action[] = [
  { title: "New Sale", icon: "↗", href: "/mobizone-sale", tone: mz.teal },
  { title: "Purchase", icon: "↙", href: "/mobizone-purchase", tone: mz.orange },
  { title: "Customers", icon: "◉", href: "/mobizone-customers", tone: mz.blue },
  { title: "Stock", icon: "▣", href: "/mobizone-stock", tone: mz.goldBright },
  { title: "Total Sales", icon: "Rs", href: "/mobizone-reports", tone: mz.teal, metric: "sales" },
  {
    title: "Total Purchase",
    icon: "Rs",
    href: "/mobizone-reports",
    tone: mz.rose,
    metric: "purchase",
  },
  {
    title: "Today Profit",
    icon: "★",
    href: "/mobizone-reports",
    tone: mz.gold,
    metric: "profit",
  },
  {
    title: "Due Receive",
    icon: "⏳",
    href: "/mobizone-reports",
    tone: mz.orange,
    metric: "due",
  },
];

export default function MobizoneHomeScreen(): React.JSX.Element {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = useBranchStore((s) => s.branch);
  const { dashboard, refresh, ready } = useMobizoneDb();

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const cashBank = (dashboard?.cashBalancePkr ?? 0) + (dashboard?.bankBalancePkr ?? 0);
  const investment = cashBank + (dashboard?.stockValuePkr ?? 0);

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
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}
        refreshControl={
          <RefreshControl refreshing={!ready} onRefresh={refresh} tintColor={mz.gold} />
        }
      >
        <MzScreenTitle
          title="MobiZone"
          subtitle={`${branch?.name ?? "Main Shop"} · Mobile Business ERP`}
        />

        <MzCard
          style={{
            backgroundColor: mz.navyDeep,
            borderColor: mz.goldDim,
            paddingVertical: 20,
          }}
        >
          <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
            TOTAL BALANCE
          </Text>
          <Text style={{ color: mz.goldBright, fontSize: 36, fontWeight: "800", marginTop: 8 }}>
            {formatPkr(investment)}
          </Text>
          <Text style={{ color: mz.muted, fontSize: 12, marginTop: 4 }}>
            Cash + Bank + Maal
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 14,
              marginTop: 16,
              borderTopWidth: 1,
              borderTopColor: mz.border,
              paddingTop: 14,
            }}
          >
            <MiniStat label="Cash" value={formatPkr(dashboard?.cashBalancePkr ?? 0)} color={mz.teal} />
            <MiniStat label="Bank" value={formatPkr(dashboard?.bankBalancePkr ?? 0)} color={mz.blue} />
            <MiniStat label="Maal" value={formatPkr(dashboard?.stockValuePkr ?? 0)} color={mz.gold} />
            <MiniStat label="Phones" value={String(dashboard?.inStock ?? 0)} color={mz.ivory} />
          </View>
        </MzCard>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {ACTIONS.map((a) => {
            const value = metricValue(a.metric);
            return (
              <Pressable
                key={a.title}
                onPress={() => router.push(a.href as never)}
                style={{
                  width: "47.5%",
                  backgroundColor: mz.card,
                  borderRadius: 18,
                  paddingVertical: 18,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: mz.border,
                  minHeight: 108,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: "rgba(185,150,83,0.14)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: a.tone, fontSize: 16, fontWeight: "800" }}>{a.icon}</Text>
                </View>
                <Text style={{ color: mz.text, fontWeight: "800", fontSize: 14, marginTop: 12 }}>
                  {a.title}
                </Text>
                {value ? (
                  <Text style={{ color: a.tone, fontWeight: "700", fontSize: 12, marginTop: 4 }}>
                    {value}
                  </Text>
                ) : (
                  <Text style={{ color: mz.muted, fontSize: 11, marginTop: 4 }}>Open</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </MzShell>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): React.JSX.Element {
  return (
    <View>
      <Text style={{ color: mz.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color, fontWeight: "700", fontSize: 13 }}>{value}</Text>
    </View>
  );
}
