import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Switch, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  DEFAULT_MOBIZONE_RECEIPT_SETTINGS,
  loadMobizoneReceiptSettings,
  saveMobizoneReceiptSettings,
  type MobizoneReceiptFields,
  type MobizoneReceiptSettings,
} from "../src/mobizone/receiptSettings";
import { mz } from "../src/mobizone/theme";
import {
  MzCard,
  MzField,
  MzInput,
  MzPrimaryButton,
  MzScreenTitle,
  MzSection,
} from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

const TOGGLES: { key: keyof MobizoneReceiptFields; label: string }[] = [
  { key: "device", label: "Device brand/model" },
  { key: "imei", label: "IMEI" },
  { key: "salePrice", label: "Price / TOTAL" },
  { key: "cash", label: "Cash" },
  { key: "bank", label: "Bank" },
  { key: "remaining", label: "Remaining udhaar" },
  { key: "footer", label: "Footer" },
];

export default function MobizoneReceiptSettingsScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode } = useMobizoneDb();
  const [settings, setSettings] = useState<MobizoneReceiptSettings>(DEFAULT_MOBIZONE_RECEIPT_SETTINGS);

  useEffect(() => {
    setSettings(loadMobizoneReceiptSettings(branchCode));
  }, [branchCode]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  function save(): void {
    saveMobizoneReceiptSettings(branchCode, settings);
    Alert.alert("Saved", "Restaurant-style bill ab yeh settings use karega.");
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle
          title="Bill print settings"
          subtitle="Restaurant thermal bill · customer block always ON"
        />

        <MzCard style={{ backgroundColor: mz.ink, borderColor: mz.accent }}>
          <Text style={{ color: mz.accent, fontWeight: "800" }}>Always on bill</Text>
          <Text style={{ color: "rgba(233,238,243,0.7)", marginTop: 6, fontSize: 13 }}>
            Customer Name · Phone · CNIC · Address — restaurant style dashed layout
          </Text>
        </MzCard>

        <MzSection title="Shop header">
          <MzField label="Shop name">
            <MzInput
              value={settings.shopName}
              onChangeText={(shopName) => setSettings((s) => ({ ...s, shopName }))}
            />
          </MzField>
          <MzField label="Shop phone">
            <MzInput
              value={settings.shopPhone}
              onChangeText={(shopPhone) => setSettings((s) => ({ ...s, shopPhone }))}
            />
          </MzField>
          <MzField label="Shop address">
            <MzInput
              value={settings.shopAddress}
              onChangeText={(shopAddress) => setSettings((s) => ({ ...s, shopAddress }))}
            />
          </MzField>
          <MzField label="Footer">
            <MzInput
              value={settings.footerText}
              onChangeText={(footerText) => setSettings((s) => ({ ...s, footerText }))}
            />
          </MzField>
        </MzSection>

        <MzSection title="Optional fields">
          {TOGGLES.map((t) => (
            <View
              key={t.key}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: mz.cardSoft,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: mz.border,
              }}
            >
              <Text style={{ color: mz.text, fontWeight: "600" }}>{t.label}</Text>
              <Switch
                value={settings.fields[t.key]}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, fields: { ...s.fields, [t.key]: v } }))
                }
                trackColor={{ true: mz.accent, false: mz.border }}
                thumbColor={mz.ivory}
              />
            </View>
          ))}
        </MzSection>

        <MzPrimaryButton label="Save settings" onPress={save} />
      </ScrollView>
    </MzShell>
  );
}
