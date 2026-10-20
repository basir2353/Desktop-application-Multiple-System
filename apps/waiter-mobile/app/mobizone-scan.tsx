import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { MzImeiScanner } from "../src/mobizone/MzImeiScanner";
import { MzShell } from "../src/mobizone/MzShell";
import { MzAttachStrip, type AttachBundle } from "../src/mobizone/MzAttachStrip";
import { findDeviceByImei, formatPkr } from "../src/mobizone/storeCore";
import { normalizeImeiScan } from "../src/mobizone/normalizeImei";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import { MzCard, MzField, MzInput, MzPrimaryButton, MzScreenTitle } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

type Mode = "imei" | "cnic" | "photo";

export default function MobizoneScanScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap } = useMzLayout();
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, refresh } = useMobizoneDb();
  const [mode, setMode] = useState<Mode>("imei");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [imeiDraft, setImeiDraft] = useState("");
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [attach, setAttach] = useState<AttachBundle>({
    photoDataUrl: null,
    cnicFrontDataUrl: null,
    cnicBackDataUrl: null,
  });

  const found = useMemo(() => {
    if (!lastScan) return null;
    return findDeviceByImei(branchCode, lastScan) ?? null;
  }, [branchCode, lastScan]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  function applyImei(raw: string): void {
    const imei = normalizeImeiScan(raw);
    if (!imei) {
      Alert.alert("IMEI", "Could not read a valid IMEI from that scan.");
      return;
    }
    setImeiDraft(imei);
    setLastScan(imei);
    refresh();
    const device = findDeviceByImei(branchCode, imei);
    if (device) {
      Alert.alert("IMEI saved", `${device.brand} ${device.model}\n${imei}`, [
        { text: "Stay", style: "cancel" },
        {
          text: "Open sell",
          onPress: () =>
            router.push({ pathname: "/mobizone-sale", params: { imei } } as never),
        },
      ]);
    } else {
      Alert.alert("IMEI saved", `${imei}\nNot in stock — open Buy to add.`, [
        { text: "OK", style: "cancel" },
        {
          text: "Open buy",
          onPress: () =>
            router.push({ pathname: "/mobizone-purchase", params: { imei } } as never),
        },
      ]);
    }
  }

  const modes: { id: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: "imei", label: "IMEI", icon: "barcode-outline" },
    { id: "cnic", label: "CNIC", icon: "card-outline" },
    { id: "photo", label: "Photo", icon: "camera-outline" },
  ];

  return (
    <MzShell>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}
        keyboardShouldPersistTaps="handled"
      >
        <MzScreenTitle
          title="Scan & capture"
          subtitle="IMEI barcode · CNIC · face photo"
          right={
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: mz.cardSoft,
                borderWidth: 1,
                borderColor: mz.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="scan-outline" size={18} color={mz.accent} />
            </View>
          }
        />

        <View style={{ flexDirection: "row", gap: 6 }}>
          {modes.map((m) => {
            const active = mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMode(m.id)}
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor: active ? mz.accent : mz.card,
                  borderWidth: 1.5,
                  borderColor: active ? mz.accent : mz.border,
                }}
              >
                <Ionicons name={m.icon} size={15} color={active ? mz.onAccent : mz.ink} />
                <Text
                  style={{
                    color: active ? mz.onAccent : mz.ink,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {mode === "imei" ? (
          <MzCard style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="barcode-outline" size={17} color={mz.accent} />
              <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 14 }}>
                IMEI / barcode scanner
              </Text>
            </View>
            <Text style={{ color: mz.muted, fontSize: 12, lineHeight: 16 }}>
              Scan barcode/QR, then open Sell (in stock) or Buy (new phone).
            </Text>
            <MzPrimaryButton label="Open IMEI camera" onPress={() => setScannerOpen(true)} />
            <MzField label="Or type / paste IMEI">
              <MzInput
                value={imeiDraft}
                onChangeText={setImeiDraft}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="15-digit IMEI"
                onSubmitEditing={() => applyImei(imeiDraft)}
              />
            </MzField>
            <Pressable
              onPress={() => applyImei(imeiDraft)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 11,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: mz.accent,
                backgroundColor: mz.mode === "dark" ? "rgba(20,184,166,0.12)" : "#F0FDFA",
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={mz.accent} />
              <Text style={{ color: mz.accent, fontWeight: "800" }}>Save IMEI</Text>
            </Pressable>

            {lastScan ? (
              <View
                style={{
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: mz.navyDeep,
                  gap: 3,
                }}
              >
                <Text
                  style={{
                    color: mz.accent,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Last scan
                </Text>
                <Text
                  style={{
                    color: mz.onNavy,
                    fontSize: 15,
                    fontWeight: "800",
                    fontFamily: "monospace",
                  }}
                >
                  {lastScan}
                </Text>
                {found ? (
                  <Text style={{ color: "rgba(233,238,243,0.7)", fontSize: 12 }}>
                    {found.brand} {found.model} · ask {formatPkr(found.salePricePkr ?? 0)}
                  </Text>
                ) : (
                  <Text style={{ color: "rgba(233,238,243,0.7)", fontSize: 12 }}>Not in stock</Text>
                )}
              </View>
            ) : null}
          </MzCard>
        ) : null}

        {mode === "cnic" ? (
          <MzCard style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="card-outline" size={17} color={mz.accent} />
              <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 14 }}>CNIC camera</Text>
            </View>
            <Text style={{ color: mz.muted, fontSize: 12, lineHeight: 16 }}>
              Capture front and back ID photos for Buy / Sell forms.
            </Text>
            <MzAttachStrip value={attach} onChange={setAttach} photoLabel="Optional selfie" />
            {attach.cnicFrontDataUrl || attach.cnicBackDataUrl ? (
              <View style={{ flexDirection: "row", gap: 6 }}>
                {attach.cnicFrontDataUrl ? (
                  <Image
                    source={{ uri: attach.cnicFrontDataUrl }}
                    style={{ flex: 1, height: 84, borderRadius: 10, backgroundColor: mz.navyDeep }}
                  />
                ) : null}
                {attach.cnicBackDataUrl ? (
                  <Image
                    source={{ uri: attach.cnicBackDataUrl }}
                    style={{ flex: 1, height: 84, borderRadius: 10, backgroundColor: mz.navyDeep }}
                  />
                ) : null}
              </View>
            ) : null}
          </MzCard>
        ) : null}

        {mode === "photo" ? (
          <MzCard style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="person-circle-outline" size={17} color={mz.accent} />
              <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 14 }}>Face photo</Text>
            </View>
            <Text style={{ color: mz.muted, fontSize: 12, lineHeight: 16 }}>
              Front camera portrait for buyer / seller.
            </Text>
            <MzAttachStrip value={attach} onChange={setAttach} photoLabel="Face photo" />
          </MzCard>
        ) : null}
      </ScrollView>

      <MzImeiScanner
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanned={applyImei}
      />
    </MzShell>
  );
}
