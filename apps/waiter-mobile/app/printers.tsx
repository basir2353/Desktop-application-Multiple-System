import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Input, Muted, Notice, Screen, SectionHeader, colors } from "../src/components/ui";
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

  useEffect(() => {
    void loadMobilePrinterSettings().then(setSettings);
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
      setNotice("Printer assignments saved. Order prints use kitchen printers; bills use cashier printer.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionHeader title="Printer assignments" />
          <Muted>
            Assign up to {MAX_KITCHEN_PRINTERS} kitchen printers for order / KOT printing, plus a separate cashier
            printer for customer bills. Names should match Android’s print dialog. Each order prints once — pick the
            correct kitchen printer when prompted.
          </Muted>
        {notice ? <Notice>{notice}</Notice> : null}

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Kitchen printers (order tickets)</Text>
          <Muted>
            Each named printer gets a print pass when you print an order. Leave a slot blank to skip it.
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
          <Muted>Used for customer bill / receipt printing only.</Muted>
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
});
