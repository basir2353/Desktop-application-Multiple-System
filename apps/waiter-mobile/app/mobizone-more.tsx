import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { getApiBaseUrl } from "../src/lib/apiBase";
import {
  disconnectGoogleDrive,
  fetchGoogleDriveStatus,
  startGoogleDriveConnect,
  type GoogleDriveStatus,
} from "../src/mobizone/googleDrive";
import { MzShell } from "../src/mobizone/MzShell";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import { MzCard, MzScreenTitle } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string; appVersion?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

const LINKS = [
  { href: "/mobizone-scan", title: "Scan & capture", note: "IMEI · CNIC · face photo", icon: "scan-outline" as const },
  { href: "/mobizone-stock", title: "Stock / Inventory", note: "In-stock phones & IMEI", icon: "cube-outline" as const },
  { href: "/mobizone-reports", title: "Reports", note: "Profit, dues, balances", icon: "stats-chart-outline" as const },
  { href: "/mobizone-expenses", title: "Create Expense", note: "Record by expense account", icon: "wallet-outline" as const },
  { href: "/mobizone-expense-accounts", title: "Account Expense", note: "Rent, Electricity, Food…", icon: "list-outline" as const },
  { href: "/mobizone-contra", title: "Contra Voucher", note: "Cash ↔ Bank transfer", icon: "swap-horizontal-outline" as const },
  { href: "/mobizone-general-voucher", title: "General Voucher", note: "Double entry + documents", icon: "document-text-outline" as const },
  { href: "/mobizone-receipt-settings", title: "Bill print settings", note: "Thermal receipt layout", icon: "print-outline" as const },
  { href: "/mobizone-sale", title: "New sale", note: "Sell + WhatsApp receipt", icon: "cart-outline" as const },
  { href: "/mobizone-purchase", title: "Purchase entry", note: "Buy phone · add stock", icon: "bag-add-outline" as const },
  { href: "/mobizone-customers", title: "Customers", note: "CNIC / phone book", icon: "people-outline" as const },
] as const;

export default function MobizoneMoreScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap, tileW } = useMzLayout();
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const waiterEmail = useSessionStore((s) => s.waiterEmail);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const clearBranch = useBranchStore((s) => s.clear);
  const { db } = useMobizoneDb();
  const [drive, setDrive] = useState<GoogleDriveStatus | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);

  const refreshDrive = useCallback(async () => {
    try {
      setDrive(await fetchGoogleDriveStatus());
    } catch {
      setDrive(null);
    }
  }, []);

  useEffect(() => {
    void refreshDrive();
  }, [refreshDrive]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}>
        <MzScreenTitle title="More" subtitle="Shop tools & settings" />

        <MzCard
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderColor: mz.accent,
            backgroundColor: mz.navyDeep,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              backgroundColor: "rgba(15,155,142,0.22)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: mz.accent,
            }}
          >
            <Ionicons name="phone-portrait" size={20} color={mz.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: mz.onNavy, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>
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
              backgroundColor: mz.card,
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: mz.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                backgroundColor: mz.cardSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={link.icon} size={17} color={mz.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: mz.ink, fontWeight: "700", fontSize: 14 }}>{link.title}</Text>
              <Text style={{ color: mz.muted, fontSize: 11, marginTop: 1 }}>{link.note}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={mz.muted} />
          </Pressable>
        ))}

        <MzCard style={{ borderColor: mz.border, gap: 8 }}>
          <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 11, letterSpacing: 0.6 }}>
            GOOGLE DRIVE (OPTIONAL)
          </Text>
          <Text style={{ color: mz.muted, fontSize: 12, lineHeight: 16 }}>
            Agar connect karo to photos / CNIC Drive pe save hongi. Warna pehle jaisa app mein hi
            rahengi.
          </Text>
          {drive?.connected ? (
            <Text style={{ color: mz.ink, fontWeight: "700", fontSize: 13 }}>
              Connected{drive.email ? ` · ${drive.email}` : ""}
            </Text>
          ) : (
            <Text style={{ color: mz.muted, fontSize: 12 }}>
              {drive && !drive.configured
                ? "Server pe Drive env set nahi (admin)."
                : "Not connected"}
            </Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {drive?.configured && !drive.connected ? (
              <Pressable
                disabled={driveBusy}
                onPress={() => {
                  setDriveBusy(true);
                  void startGoogleDriveConnect()
                    .then(() =>
                      Alert.alert(
                        "Google Drive",
                        "Browser mein Google sign-in complete karo, phir yahan Refresh dabao.",
                      ),
                    )
                    .catch((err) =>
                      Alert.alert(
                        "Google Drive",
                        err instanceof Error ? err.message : "Connect failed",
                      ),
                    )
                    .finally(() => setDriveBusy(false));
                }}
                style={{
                  backgroundColor: mz.accent,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: mz.onAccent, fontWeight: "800", fontSize: 12 }}>Connect</Text>
              </Pressable>
            ) : null}
            {drive?.connected ? (
              <Pressable
                disabled={driveBusy}
                onPress={() => {
                  setDriveBusy(true);
                  void disconnectGoogleDrive()
                    .then(setDrive)
                    .catch((err) =>
                      Alert.alert(
                        "Google Drive",
                        err instanceof Error ? err.message : "Disconnect failed",
                      ),
                    )
                    .finally(() => setDriveBusy(false));
                }}
                style={{
                  backgroundColor: mz.dangerSoft,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: mz.dangerBorder,
                }}
              >
                <Text style={{ color: mz.rose, fontWeight: "800", fontSize: 12 }}>Disconnect</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={driveBusy}
              onPress={() => void refreshDrive()}
              style={{
                backgroundColor: mz.cardSoft,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: mz.border,
              }}
            >
              <Text style={{ color: mz.ink, fontWeight: "700", fontSize: 12 }}>Refresh</Text>
            </Pressable>
          </View>
        </MzCard>

        <MzCard style={{ borderColor: mz.accent, gap: 4 }}>
          <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 11, letterSpacing: 0.6 }}>
            AUTO UPDATE
          </Text>
          <Text style={{ color: mz.ink, fontWeight: "700" }}>
            App v{extra?.appVersion ?? "1.0"}
          </Text>
          <Text style={{ color: mz.muted, fontSize: 12, lineHeight: 16 }}>
            New builds show a top banner — tap Download & install, then reopen.
          </Text>
        </MzCard>

        <Text style={{ color: mz.muted, fontSize: 10, textAlign: "center" }}>
          API {getApiBaseUrl()} · Banks {db.bankAccounts.length} · Devices {db.devices.length}
          {"\n"}v{extra?.appVersion ?? "1.0"} · MobiZone
        </Text>

        <Pressable
          onPress={() => {
            clearSession();
            clearBranch();
            router.replace("/");
          }}
          style={{
            backgroundColor: mz.dangerSoft,
            borderRadius: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: mz.dangerBorder,
            alignItems: "center",
          }}
        >
          <Text style={{ color: mz.rose, fontWeight: "800" }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </MzShell>
  );
}
