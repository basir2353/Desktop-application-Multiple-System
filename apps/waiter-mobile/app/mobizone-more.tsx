import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { MzShell } from "../src/mobizone/MzShell";
import { mz } from "../src/mobizone/theme";
import { MzCard, MzScreenTitle } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string; appVersion?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

const LINKS = [
  { href: "/mobizone-stock", title: "Stock / Inventory", note: "In-stock phones & IMEI", icon: "▣" },
  { href: "/mobizone-reports", title: "Reports", note: "Profit, dues, balances", icon: "📊" },
  { href: "/mobizone-expenses", title: "Shop expenses", note: "Salary, khana — profit se minus", icon: "💸" },
  {
    href: "/mobizone-receipt-settings",
    title: "Bill print settings",
    note: "Restaurant-style thermal bill",
    icon: "🖨",
  },
  { href: "/mobizone-sale", title: "Sales history entry", note: "New sale + WhatsApp receipt", icon: "↗" },
  { href: "/mobizone-purchase", title: "Purchase entry", note: "Buy phone · add stock", icon: "↙" },
  { href: "/mobizone-customers", title: "Customers", note: "CNIC / phone book", icon: "◉" },
] as const;

export default function MobizoneMoreScreen(): React.JSX.Element {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const clearBranch = useBranchStore((s) => s.clear);
  const { db } = useMobizoneDb();

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle title="More" subtitle="Shop tools & settings" />

        <MzCard
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderColor: mz.gold,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: mz.navy,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: mz.gold, fontWeight: "800" }}>MZ</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: mz.navy, fontWeight: "800", fontSize: 16 }}>
              {claims?.email ?? "Shop user"}
            </Text>
            <Text style={{ color: mz.muted, marginTop: 2, fontSize: 12 }}>
              {branch?.name ?? "Main"} · Connected
            </Text>
          </View>
          <Text style={{ color: mz.muted }}>›</Text>
        </MzCard>

        {LINKS.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href as never)}
            style={{
              backgroundColor: mz.white,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: mz.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: mz.ivory,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: mz.navy, fontSize: 16 }}>{link.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: mz.navy, fontWeight: "700" }}>{link.title}</Text>
              <Text style={{ color: mz.muted, fontSize: 12, marginTop: 2 }}>{link.note}</Text>
            </View>
            <Text style={{ color: mz.muted }}>›</Text>
          </Pressable>
        ))}

        <Text style={{ color: mz.muted, fontSize: 11, textAlign: "center", marginTop: 8 }}>
          API {getApiBaseUrl()} · Banks {db.bankAccounts.length} · Devices {db.devices.length}
          {"\n"}v{extra?.appVersion ?? "1.0"} · MobiZone Classic
        </Text>

        <Pressable
          onPress={() => {
            clearSession();
            clearBranch();
            router.replace("/");
          }}
          style={{
            backgroundColor: "#FEF2F2",
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: "#FECACA",
            alignItems: "center",
          }}
        >
          <Text style={{ color: mz.rose, fontWeight: "800" }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </MzShell>
  );
}
