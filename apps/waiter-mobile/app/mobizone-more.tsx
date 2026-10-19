import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { mz } from "../src/mobizone/theme";
import { MzCard, MzScreenTitle } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { getApiBaseUrl } from "../src/lib/apiBase";
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
  { href: "/mobizone-sale", title: "Sales history entry", note: "New sale + print / WhatsApp", icon: "↗" },
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

        <MzCard style={{ backgroundColor: mz.navyDeep, borderColor: mz.goldDim }}>
          <Text style={{ color: mz.goldBright, fontWeight: "800", fontSize: 16 }}>
            {claims?.email ?? "Shop user"}
          </Text>
          <Text style={{ color: mz.muted, marginTop: 4 }}>
            {branch?.name ?? "Main"} · {branch?.code ?? "MAIN"}
          </Text>
          <Text style={{ color: mz.muted, marginTop: 8, fontSize: 11 }}>
            Live API: {getApiBaseUrl()}
          </Text>
          <Text style={{ color: mz.muted, fontSize: 11 }}>
            Banks: {db.bankAccounts.length} · Devices: {db.devices.length} · v
            {extra?.appVersion ?? "1.0"}
          </Text>
        </MzCard>

        {LINKS.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href as never)}
            style={{
              backgroundColor: mz.card,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: mz.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text style={{ color: mz.gold, fontSize: 18, width: 28, textAlign: "center" }}>
              {link.icon}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: mz.text, fontWeight: "700" }}>{link.title}</Text>
              <Text style={{ color: mz.muted, fontSize: 12, marginTop: 2 }}>{link.note}</Text>
            </View>
            <Text style={{ color: mz.muted }}>›</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => {
            clearSession();
            clearBranch();
            router.replace("/");
          }}
          style={{
            marginTop: 8,
            backgroundColor: "#3A1F2A",
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: mz.rose,
            alignItems: "center",
          }}
        >
          <Text style={{ color: mz.rose, fontWeight: "800" }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </MzShell>
  );
}
