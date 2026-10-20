import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr } from "../src/mobizone/storeCore";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import { MzCard, MzEmpty, MzNavyHeader } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

type MoreAction = {
  title: string;
  note: string;
  href: string;
  metric?: "sales" | "purchase" | "profit" | "due";
};

/** Everything else stays visible — compact grid under Order strip */
const MORE: MoreAction[] = [
  { title: "Customers", note: "CNIC book", href: "/mobizone-customers" },
  { title: "Stock", note: "IMEI list", href: "/mobizone-stock" },
  { title: "Today Sales", note: "Live", href: "/mobizone-reports", metric: "sales" },
  { title: "Today Buy", note: "Live", href: "/mobizone-reports", metric: "purchase" },
  { title: "Profit", note: "Today", href: "/mobizone-reports", metric: "profit" },
  { title: "Due", note: "Receivable", href: "/mobizone-reports", metric: "due" },
  { title: "Create Expense", note: "By account", href: "/mobizone-expenses" },
  { title: "Account Expense", note: "Categories", href: "/mobizone-expense-accounts" },
  { title: "Contra", note: "Cash ↔ Bank", href: "/mobizone-contra" },
  { title: "General Voucher", note: "Double entry", href: "/mobizone-general-voucher" },
  { title: "Bill print", note: "Receipt", href: "/mobizone-receipt-settings" },
];

export default function MobizoneHomeScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap, tileW } = useMzLayout();
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

  function metricValue(key?: MoreAction["metric"]): string | null {
    if (!key || !dashboard) return null;
    if (key === "sales") return formatPkr(dashboard.todaySalesPkr);
    if (key === "purchase") return formatPkr(dashboard.todayPurchasesPkr);
    if (key === "profit") return formatPkr(dashboard.todayProfitPkr);
    return formatPkr(dashboard.pendingReceivablesPkr);
  }

  return (
    <MzShell>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}
        refreshControl={
          <RefreshControl refreshing={!ready} onRefresh={refresh} tintColor={mz.accent} />
        }
      >
        <MzNavyHeader
          title={branch?.name ?? "Main Shop"}
          subtitle={`Order counter · ${todayLabel}`}
          right={
            <Pressable
              onPress={() => router.push("/mobizone-scan" as never)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "rgba(15,155,142,0.2)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: mz.accent,
              }}
            >
              <Ionicons name="scan" size={20} color={mz.accent} />
            </Pressable>
          }
        />

        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: mz.ink,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 1.1,
            }}
          >
            ORDER NOW
          </Text>

          <Pressable
            onPress={() => router.push("/mobizone-sale" as never)}
            style={({ pressed }) => ({
              backgroundColor: mz.accent,
              borderRadius: 16,
              paddingVertical: 18,
              paddingHorizontal: 16,
              minHeight: 84,
              justifyContent: "center",
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="cart" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800" }}>
                PRIMARY ORDER
              </Text>
            </View>
            <Text style={{ color: mz.white, fontSize: 24, fontWeight: "900", marginTop: 4 }}>
              New Sale
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 3, fontWeight: "600" }}>
              Sell phone · cash / bank / udhaar
            </Text>
            <View
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                marginTop: -18,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.22)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-forward" size={18} color={mz.white} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push("/mobizone-purchase" as never)}
            style={({ pressed }) => ({
              backgroundColor: mz.navyDeep,
              borderRadius: 16,
              paddingVertical: 16,
              paddingHorizontal: 16,
              minHeight: 76,
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: mz.accent,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="bag-add" size={14} color={mz.accent} />
              <Text style={{ color: mz.accent, fontSize: 11, fontWeight: "800" }}>STOCK ORDER</Text>
            </View>
            <Text style={{ color: mz.white, fontSize: 20, fontWeight: "900", marginTop: 4 }}>
              Purchase
            </Text>
            <Text style={{ color: "rgba(233,238,243,0.75)", fontSize: 12, marginTop: 3, fontWeight: "600" }}>
              Buy phone · IMEI into stock
            </Text>
            <View
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                marginTop: -18,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(15,155,142,0.25)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-forward" size={18} color={mz.accent} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push("/mobizone-scan" as never)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: mz.card,
              borderRadius: 12,
              padding: 10,
              borderWidth: 1,
              borderColor: mz.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: mz.cardSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="barcode-outline" size={20} color={mz.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 14 }}>Scan IMEI / CNIC</Text>
              <Text style={{ color: mz.muted, fontSize: 11, marginTop: 2 }}>
                Barcode scanner · ID camera · face photo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={mz.muted} />
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: mz.card,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: mz.border,
          }}
        >
          <Text
            style={{
              color: mz.muted,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.8,
            }}
          >
            TOTAL POSITION
          </Text>
          <Text
            style={{
              color: mz.ink,
              fontSize: 26,
              fontWeight: "800",
              marginTop: 4,
              letterSpacing: -0.4,
            }}
          >
            {formatPkr(investment)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
            <MiniLight label="Cash" value={formatPkr(dashboard?.cashBalancePkr ?? 0)} />
            <MiniLight label="Bank" value={formatPkr(dashboard?.bankBalancePkr ?? 0)} />
            <MiniLight label="Stock" value={formatPkr(dashboard?.stockValuePkr ?? 0)} />
          </View>
        </View>

        <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 }}>
          ALL MODULES
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {MORE.map((a) => {
            const value = metricValue(a.metric);
            return (
              <Pressable
                key={a.title}
                onPress={() => router.push(a.href as never)}
                style={{
                  width: tileW,
                  backgroundColor: mz.card,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderWidth: 1,
                  borderColor: mz.border,
                  minHeight: 64,
                }}
              >
                <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 13 }}>{a.title}</Text>
                <Text style={{ color: mz.muted, fontWeight: "600", fontSize: 11, marginTop: 4 }}>
                  {value ?? a.note}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 15 }}>Recent orders</Text>
          <Pressable onPress={() => router.push("/mobizone-reports" as never)}>
            <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 12 }}>View all</Text>
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <MzEmpty
            title="No orders yet"
            note="Upar se New Sale ya Purchase dabao"
            actionLabel="New Sale"
            onAction={() => router.push("/mobizone-sale" as never)}
          />
        ) : (
          recent.map((row) => {
            const isSale = "pricePkr" in row;
            return (
              <MzCard
                key={row.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 13,
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: mz.ink, fontWeight: "700" }}>
                    {isSale ? "Sale" : "Buy"} · {row.brand} {row.model}
                  </Text>
                  <Text style={{ color: mz.muted, fontSize: 11, marginTop: 3 }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </Text>
                </View>
                <Text style={{ color: isSale ? mz.accent : mz.orange, fontWeight: "800" }}>
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

function MiniLight({ label, value }: { label: string; value: string }): React.JSX.Element {
  const mz = useMz();
  return (
    <View style={{ minWidth: 80, flexGrow: 1 }}>
      <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 13, marginTop: 2 }}>{value}</Text>
    </View>
  );
}
