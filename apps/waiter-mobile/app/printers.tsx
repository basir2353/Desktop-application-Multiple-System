import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Button, Card, Input, Muted, Notice, Screen, SectionHeader, colors } from "../src/components/ui";
import {
  discoverBranchPrintServers,
  enrollBranchServerByIp,
  loadPreferredBranchServer,
  loadUseBranchPrintServer,
  savePreferredBranchServer,
  saveUseBranchPrintServer,
  type MobileDiscoveredServer,
} from "../src/lib/branchPrintClient";
import {
  DEFAULT_MOBILE_PRINTER_SETTINGS,
  MAX_KITCHEN_PRINTERS,
  loadMobilePrinterSettings,
  saveMobilePrinterSettings,
  type MobilePrinterSettings,
} from "../src/lib/mobilePrinterSettings";
import { resolveStaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function PrintersScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const [settings, setSettings] = useState<MobilePrinterSettings>({
    ...DEFAULT_MOBILE_PRINTER_SETTINGS,
    kitchenPrinters: [...DEFAULT_MOBILE_PRINTER_SETTINGS.kitchenPrinters],
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [useBranch, setUseBranch] = useState(true);
  const [preferred, setPreferred] = useState<MobileDiscoveredServer | null>(null);
  const [discovered, setDiscovered] = useState<MobileDiscoveredServer[]>([]);
  const [manualIp, setManualIp] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    void loadMobilePrinterSettings().then(setSettings);
    void loadUseBranchPrintServer().then(setUseBranch);
    void loadPreferredBranchServer().then(setPreferred);
  }, []);

  if (!accessToken) return <Redirect href="/" />;
  if (resolveStaffRole(claims) === "rider") return <Redirect href="/rider-home" />;
  if (!branch) return <Redirect href="/branch" />;

  function setKitchen(index: number, value: string): void {
    setSettings((prev) => {
      const kitchenPrinters = [...prev.kitchenPrinters];
      kitchenPrinters[index] = value;
      return { ...prev, kitchenPrinters };
    });
  }

  async function onSave(): Promise<void> {
    setSaving(true);
    try {
      await saveMobilePrinterSettings(settings);
      await saveUseBranchPrintServer(useBranch);
      setNotice(
        useBranch
          ? "Saved. Silent branch printing is on — Expo dialog is the fallback."
          : "Saved. Using Android print dialog only.",
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function onScan(): Promise<void> {
    setScanning(true);
    try {
      const found = await discoverBranchPrintServers({
        branchCode: branch.code,
        extraHosts: manualIp.trim() ? [manualIp.trim()] : undefined,
      });
      setDiscovered(found);
      setNotice(found.length ? `Found ${found.length} branch print server(s).` : "No servers found — enter the PC IP manually.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Discovery failed.");
    } finally {
      setScanning(false);
    }
  }

  async function onEnrollIp(): Promise<void> {
    if (!manualIp.trim()) {
      setNotice("Enter the desktop PC local IP (e.g. 192.168.1.50).");
      return;
    }
    const server = await enrollBranchServerByIp(manualIp.trim());
    if (!server) {
      setNotice("Could not reach branch print server at that IP (is the launcher online?).");
      return;
    }
    setPreferred(server);
    setDiscovered((prev) => [server, ...prev.filter((s) => s.id !== server.id)]);
    setNotice(`Connected to ${server.serverName} · ${server.localIp}:${server.port}`);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionHeader title="Printer assignments" />
        <Muted>
          Prefer silent printing via the Branch Print Server on the desktop launcher. If no server is online,
          Android’s print dialog is used as fallback.
        </Muted>
        {notice ? <Notice>{notice}</Notice> : null}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Branch Print Server</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Silent print via branch server</Text>
            <Switch value={useBranch} onValueChange={setUseBranch} />
          </View>
          {preferred ? (
            <View style={styles.serverCard}>
              <Text style={styles.serverTitle}>{preferred.serverName}</Text>
              <Muted>
                {preferred.branchName || preferred.branchCode} · {preferred.localIp}:{preferred.port}
                {preferred.pingMs != null ? ` · ${preferred.pingMs}ms` : ""} · {preferred.status}
              </Muted>
              <Button
                label="Clear preferred"
                variant="ghost"
                onPress={() => {
                  void savePreferredBranchServer(null).then(() => setPreferred(null));
                }}
              />
            </View>
          ) : (
            <Muted>No preferred server yet.</Muted>
          )}
          <View style={styles.field}>
            <Text style={styles.label}>Desktop PC IP</Text>
            <Input
              placeholder="e.g. 192.168.1.50"
              value={manualIp}
              onChangeText={setManualIp}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.rowBtns}>
            <Button label={scanning ? "Scanning…" : "Discover"} onPress={() => void onScan()} loading={scanning} />
            <Button label="Connect IP" variant="ghost" onPress={() => void onEnrollIp()} />
          </View>
          {discovered.map((s) => (
            <Pressable
              key={s.id}
              style={styles.serverCard}
              onPress={() => {
                void savePreferredBranchServer(s).then(() => {
                  setPreferred(s);
                  setNotice(`Preferred: ${s.serverName}`);
                });
              }}
            >
              <Text style={styles.serverTitle}>{s.serverName}</Text>
              <Muted>
                {s.branchName || s.branchCode} · {s.localIp}:{s.port}
                {s.pingMs != null ? ` · ${s.pingMs}ms` : ""}
              </Muted>
            </Pressable>
          ))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Kitchen printers (order tickets)</Text>
          <Muted>
            Logical names mapped when the branch server is offline (Expo dialog hint). Leave blank to skip.
          </Muted>
          {settings.kitchenPrinters.map((name, index) => (
            <View key={`kitchen-${index}`} style={styles.field}>
              <Text style={styles.label}>Kitchen {index + 1}</Text>
              <Input
                placeholder={index === 0 ? "e.g. Kitchen Epson TM-T20" : "Optional"}
                value={name}
                onChangeText={(text) => setKitchen(index, text)}
              />
            </View>
          ))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Cashier / billing printer</Text>
          <Muted>Used for customer bill / receipt printing only (fallback dialog).</Muted>
          <View style={styles.field}>
            <Text style={styles.label}>Bill printer</Text>
            <Input
              placeholder="e.g. Cashier counter printer"
              value={settings.billPrinter}
              onChangeText={(text) => setSettings((prev) => ({ ...prev, billPrinter: text }))}
            />
          </View>
        </Card>

        <Button label={saving ? "Saving…" : "Save printers"} onPress={() => void onSave()} loading={saving} />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    gap: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  field: {
    gap: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowBtns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  serverCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  serverTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
});
