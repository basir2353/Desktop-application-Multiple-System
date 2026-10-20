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
  { href: "/mobizone-stock", title: "Stock / Inventory", note: "In-stock phones & IMEI" },
  { href: "/mobizone-reports", title: "Reports", note: "Profit, dues, balances · date filter" },
  { href: "/mobizone-expenses", title: "Create Expense", note: "Record by expense account" },
  { href: "/mobizone-expense-accounts", title: "Account Expense", note: "Rent, Electricity, Food…" },
  { href: "/mobizone-contra", title: "Contra Voucher", note: "Cash ↔ Bank transfer" },
  { href: "/mobizone-general-voucher", title: "General Voucher", note: "Double entry + documents" },
  {
    href: "/mobizone-receipt-settings",
    title: "Bill print settings",
    note: "Thermal receipt layout",
  },
  { href: "/mobizone-sale", title: "New sale", note: "Sell + WhatsApp receipt" },
  { href: "/mobizone-purchase", title: "Purchase entry", note: "Buy phone · add stock" },
  { href: "/mobizone-customers", title: "Customers", note: "CNIC / phone book" },
] as const;

export default function MobizoneMoreScreen(): React.JSX.Element {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const waiterEmail = useSessionStore((s) => s.waiterEmail);
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
            borderColor: mz.accent,
            backgroundColor: mz.ink,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: "rgba(15,155,142,0.22)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: mz.accent,
            }}
          >
            <Text style={{ color: mz.accent, fontWeight: "900" }}>MZ</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: mz.white, fontWeight: "800", fontSize: 16 }}>
              {waiterEmail ?? "Shop user"}
            </Text>
            <Text style={{ color: "rgba(233,238,243,0.65)", marginTop: 2, fontSize: 12 }}>
              {branch?.name ?? "Main"} · Connected
            </Text>
          </View>
        </MzCard>

        {LINKS.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href as never)}
            style={{
              backgroundColor: mz.white,
              borderRadius: 12,
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
                width: 8,
                height: 36,
                borderRadius: 4,
                backgroundColor: mz.accent,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: mz.ink, fontWeight: "700" }}>{link.title}</Text>
              <Text style={{ color: mz.muted, fontSize: 12, marginTop: 2 }}>{link.note}</Text>
            </View>
            <Text style={{ color: mz.accent, fontWeight: "800" }}>›</Text>
          </Pressable>
        ))}

        <MzCard style={{ borderColor: mz.accent, gap: 6 }}>
          <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 12, letterSpacing: 0.6 }}>
            AUTO UPDATE
          </Text>
          <Text style={{ color: mz.ink, fontWeight: "700" }}>
            App v{extra?.appVersion ?? "1.0"}
          </Text>
          <Text style={{ color: mz.muted, fontSize: 12, lineHeight: 17 }}>
            New MobiZone builds show a banner at the top — tap Download & install, then reopen.
          </Text>
        </MzCard>

        <Text style={{ color: mz.muted, fontSize: 11, textAlign: "center", marginTop: 8 }}>
          API {getApiBaseUrl()} · Banks {db.bankAccounts.length} · Devices {db.devices.length}
          {"\n"}v{extra?.appVersion ?? "1.0"} · MobiZone Signal
        </Text>

        <Pressable
          onPress={() => {
            clearSession();
            clearBranch();
            router.replace("/");
          }}
          style={{
            backgroundColor: "#FEF2F2",
            borderRadius: 12,
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
