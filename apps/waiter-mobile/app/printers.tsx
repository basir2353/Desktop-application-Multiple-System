import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { BranchPrintServer } from "@platform/contracts";
import { fetchBranchPrintServers } from "../src/api/printing";
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
  const [cloudServers, setCloudServers] = useState<BranchPrintServer[]>([]);
  const [manualIp, setManualIp] = useState("");
  const [scanning, setScanning] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const refreshCloudServers = useCallback(async () => {
    if (!branch?.code) return;
    setLoadingCloud(true);
    try {
      // Prefer this branch; if empty, show any online server for the org (branch codes can differ).
      let result = await fetchBranchPrintServers({
        branchCode: branch.code,
        onlineOnly: true,
      });
      if (result.servers.length === 0) {
        result = await fetchBranchPrintServers({ onlineOnly: true });
      }
      setCloudServers(result.servers);
      if (result.servers.length === 0) {
        setNotice(
          "Koi online print server cloud pe nahi — desktop launcher Start karo (Cloud heartbeat on) aur Refresh dabao.",
        );
      } else {
        setNotice(null);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Cloud servers load nahi hue.");
      setCloudServers([]);
    } finally {
      setLoadingCloud(false);
    }
  }, [branch?.code]);

  useEffect(() => {
    void loadMobilePrinterSettings().then(setSettings);
    void loadUseBranchPrintServer().then(setUseBranch);
    void loadPreferredBranchServer().then(setPreferred);
  }, []);

  useEffect(() => {
    if (accessToken && branch?.code) {
      void refreshCloudServers();
    }
  }, [accessToken, branch?.code, refreshCloudServers]);

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

  async function connectToHost(host: string, label?: string): Promise<boolean> {
    const server = await enrollBranchServerByIp(host);
    if (!server) {
      setNotice(
        `Connect fail: ${label ?? host}. Same Wi‑Fi? Desktop ONLINE? Port 9740 (not 9741)?`,
      );
      return false;
    }
    setPreferred(server);
    setDiscovered((prev) => [server, ...prev.filter((s) => s.id !== server.id)]);
    setManualIp(`${server.localIp}:${server.port}`);
    setNotice(`Connected · ${server.serverName} · ${server.localIp}:${server.port}`);
    return true;
  }

  async function onConnectCloud(server: BranchPrintServer): Promise<void> {
    setConnectingId(server.id);
    try {
      await connectToHost(`${server.localIp}:${server.port}`, server.serverName);
    } finally {
      setConnectingId(null);
    }
  }

  async function onScan(): Promise<void> {
    setScanning(true);
    try {
      const found = await discoverBranchPrintServers({
        branchCode: branch.code,
        extraHosts: [
          ...cloudServers.map((s) => `${s.localIp}:${s.port}`),
          ...(manualIp.trim() ? [manualIp.trim()] : []),
        ],
      });
      setDiscovered(found);
      setNotice(
        found.length
          ? `LAN pe ${found.length} server milay.`
          : "LAN pe nahi mila — upar cloud suggestion se Connect try karo.",
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Discovery failed.");
    } finally {
      setScanning(false);
    }
  }

  async function onEnrollIp(): Promise<void> {
    if (!manualIp.trim()) {
      setNotice("Desktop PC IP likho (e.g. 192.168.100.6 ya …:9740).");
      return;
    }
    setConnectingId("manual");
    try {
      await connectToHost(manualIp.trim());
    } finally {
      setConnectingId(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionHeader title="Printers" />
        <Muted>
          Online systems cloud API se aate hain (desktop heartbeat). Connect dabao — phone us PC ke LAN IP se
          link ho jayega.
        </Muted>
        {notice ? <Notice>{notice}</Notice> : null}

        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Online systems</Text>
            <Button
              label={loadingCloud ? "…" : "Refresh"}
              variant="ghost"
              onPress={() => void refreshCloudServers()}
              loading={loadingCloud}
            />
          </View>
          <Muted>Backend pe jo branch print servers online hain — yahan suggestion.</Muted>
          {loadingCloud && cloudServers.length === 0 ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
          ) : null}
          {!loadingCloud && cloudServers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No online print server for this branch yet.</Text>
              <Muted>Desktop EXE → Printers → Start / Restart (Cloud heartbeat on).</Muted>
            </View>
          ) : null}
          {cloudServers.map((s) => {
            const isPreferred =
              preferred?.localIp === s.localIp && preferred?.port === s.port;
            const busy = connectingId === s.id;
            return (
              <View key={s.id} style={[styles.serverCard, isPreferred && styles.serverCardActive]}>
                <View style={styles.serverMain}>
                  <Text style={styles.serverTitle}>{s.serverName}</Text>
                  <Muted>
                    {s.branchName || s.branchCode} · {s.localIp}:{s.port} · {s.printerCount} printers ·{" "}
                    <Text style={styles.online}>{s.status.toUpperCase()}</Text>
                  </Muted>
                </View>
                <Button
                  label={busy ? "Connecting…" : isPreferred ? "Connected" : "Connect"}
                  onPress={() => void onConnectCloud(s)}
                  loading={busy}
                  variant={isPreferred ? "ghost" : undefined}
                />
              </View>
            );
          })}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Branch Print Server</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Silent print via branch server</Text>
            <Switch value={useBranch} onValueChange={setUseBranch} />
          </View>
          {preferred ? (
            <View style={[styles.serverCard, styles.serverCardActive]}>
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
            <Muted>Abhi koi preferred server nahi — upar Connect use karo.</Muted>
          )}
          <View style={styles.field}>
            <Text style={styles.label}>Manual Desktop PC IP</Text>
            <Input
              placeholder="e.g. 192.168.100.6 or …:9740"
              value={manualIp}
              onChangeText={setManualIp}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.rowBtns}>
            <Button label={scanning ? "Scanning…" : "LAN Discover"} onPress={() => void onScan()} loading={scanning} />
            <Button
              label={connectingId === "manual" ? "Connecting…" : "Connect IP"}
              variant="ghost"
              onPress={() => void onEnrollIp()}
              loading={connectingId === "manual"}
            />
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
          <Muted>Fallback names jab branch server offline ho.</Muted>
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
          <Muted>Bill / receipt fallback dialog.</Muted>
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
    gap: 8,
  },
  serverCardActive: {
    borderColor: colors.accent,
  },
  serverMain: {
    gap: 4,
  },
  serverTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  online: {
    color: "#4ade80",
    fontWeight: "700",
  },
  emptyBox: {
    gap: 6,
    paddingVertical: 8,
  },
  emptyText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 13,
  },
});
