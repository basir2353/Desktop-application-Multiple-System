import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

export default function MobizoneHomeScreen(): React.JSX.Element {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = useBranchStore((s) => s.branch);
  const { dashboard, refresh, ready } = useMobizoneDb();

  if (!accessToken) return <Redirect href="/" />;
  // Allow screens when built as mobizone APK; skip gate during Metro if variant unset.
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const totalBalance = (dashboard?.cashBalancePkr ?? 0) + (dashboard?.bankBalancePkr ?? 0);

  return (
    <MzShell>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 14 }}
        refreshControl={
          <RefreshControl refreshing={!ready} onRefresh={refresh} tintColor={mz.gold} />
        }
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: mz.gold, fontSize: 22, fontWeight: "800", letterSpacing: 0.3 }}>
              MobiZone
            </Text>
            <Text style={{ color: mz.muted, fontSize: 13, marginTop: 2 }}>
              {branch?.name ?? "Main Shop"} · Mobile Business ERP
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/mobizone-reports" as never)}
            style={{
              backgroundColor: mz.card,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: mz.border,
            }}
          >
            <Text style={{ color: mz.text, fontWeight: "600", fontSize: 12 }}>Reports</Text>
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: mz.card,
            borderRadius: 18,
            padding: 18,
            borderWidth: 1,
            borderColor: mz.border,
          }}
        >
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>TOTAL BALANCE</Text>
          <Text style={{ color: mz.gold, fontSize: 32, fontWeight: "800", marginTop: 6 }}>
            {formatPkr(totalBalance)}
          </Text>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
            <View>
              <Text style={{ color: mz.muted, fontSize: 11 }}>Cash</Text>
              <Text style={{ color: mz.teal, fontWeight: "700" }}>
                {formatPkr(dashboard?.cashBalancePkr ?? 0)}
              </Text>
            </View>
            <View>
              <Text style={{ color: mz.muted, fontSize: 11 }}>Bank</Text>
              <Text style={{ color: mz.blue, fontWeight: "700" }}>
                {formatPkr(dashboard?.bankBalancePkr ?? 0)}
              </Text>
            </View>
            <View>
              <Text style={{ color: mz.muted, fontSize: 11 }}>Stock</Text>
              <Text style={{ color: mz.text, fontWeight: "700" }}>{dashboard?.inStock ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {[
            { title: "New Sale", color: mz.tealDim, href: "/mobizone-sale" },
            { title: "New Purchase", color: "#B45309", href: "/mobizone-purchase" },
            { title: "Customers", color: "#1D4ED8", href: "/mobizone-customers" },
            { title: "Stock", color: "#7C3AED", href: "/mobizone-stock" },
          ].map((a) => (
            <Pressable
              key={a.title}
              onPress={() => router.push(a.href as never)}
              style={{
                width: "47%",
                backgroundColor: a.color,
                borderRadius: 16,
                paddingVertical: 22,
                alignItems: "center",
              }}
            >
              <Text style={{ color: mz.white, fontWeight: "800", fontSize: 15 }}>{a.title}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Total Sales"
            value={formatPkr(dashboard?.todaySalesPkr ?? 0)}
            tone={mz.teal}
          />
          <StatCard
            label="Total Purchase"
            value={formatPkr(dashboard?.todayPurchasesPkr ?? 0)}
            tone={mz.rose}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard
            label="Today Profit"
            value={formatPkr(dashboard?.todayProfitPkr ?? 0)}
            tone={mz.gold}
          />
          <StatCard
            label="Due Receive"
            value={formatPkr(dashboard?.pendingReceivablesPkr ?? 0)}
            tone={mz.orange}
          />
        </View>
      </ScrollView>
    </MzShell>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}): React.JSX.Element {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: mz.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: mz.border,
      }}
    >
      <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: tone, fontSize: 16, fontWeight: "800", marginTop: 6 }}>{value}</Text>
    </View>
  );
}
