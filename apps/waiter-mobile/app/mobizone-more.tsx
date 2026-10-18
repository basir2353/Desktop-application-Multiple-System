import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { mz } from "../src/mobizone/theme";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string; appVersion?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

const LINKS = [
  { href: "/mobizone-stock", title: "Stock / Inventory", note: "In-stock phones & IMEI" },
  { href: "/mobizone-reports", title: "Reports", note: "Profit, dues, balances" },
  { href: "/mobizone-sale", title: "Sales history entry", note: "New sale + WhatsApp receipt" },
  { href: "/mobizone-purchase", title: "Purchase entry", note: "Buy phone · add stock" },
  { href: "/mobizone-customers", title: "Customers", note: "CNIC / phone book" },
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
        <Text style={{ color: mz.gold, fontSize: 20, fontWeight: "800" }}>More</Text>

        <View
          style={{
            backgroundColor: mz.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: mz.border,
          }}
        >
          <Text style={{ color: mz.text, fontWeight: "800", fontSize: 16 }}>
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
        </View>

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
            }}
          >
            <Text style={{ color: mz.text, fontWeight: "700" }}>{link.title}</Text>
            <Text style={{ color: mz.muted, fontSize: 12, marginTop: 2 }}>{link.note}</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => {
            clearSession();
            clearBranch();
            router.replace("/");
          }}
          style={{
            backgroundColor: mz.rose,
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <Text style={{ color: mz.white, fontWeight: "800" }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </MzShell>
  );
}
