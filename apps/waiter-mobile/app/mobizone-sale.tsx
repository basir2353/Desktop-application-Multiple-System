import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  buildWhatsAppSaleText,
  findDeviceByImei,
  formatPkr,
  openWhatsApp,
  recordSale,
} from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

export default function MobizoneSaleScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh } = useMobizoneDb();
  const inStock = useMemo(() => db.devices.filter((d) => d.status === "in_stock"), [db.devices]);

  const [scan, setScan] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [price, setPrice] = useState("");
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "bank" | "both">("cash");

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const selected = inStock.find((d) => d.id === deviceId) ?? null;
  const priceN = Number(price) || 0;
  const cashN = payMode === "bank" ? 0 : Number(cash) || 0;
  const bankN = payMode === "cash" ? 0 : Number(bank) || 0;
  const remaining = Math.max(0, priceN - cashN - bankN);

  function applyScan(): void {
    const found = findDeviceByImei(branchCode, scan.trim());
    if (!found || found.status !== "in_stock") {
      Alert.alert("Not found", "No in-stock device matched that IMEI / barcode.");
      return;
    }
    setDeviceId(found.id);
    setPrice(String(found.salePricePkr ?? found.purchasePricePkr));
  }

  function onSave(): void {
    if (!deviceId || !customerName.trim() || !(priceN > 0)) {
      Alert.alert("Missing info", "Select a phone, customer name, and sale price.");
      return;
    }
    if (payMode !== "cash" && bankN > 0 && !bankAccountId) {
      Alert.alert("Bank account", "Select a bank account for bank payment.");
      return;
    }
    const acc = db.bankAccounts.find((a) => a.id === bankAccountId);
    try {
      const sale = recordSale(branchCode, {
        deviceId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        pricePkr: priceN,
        payment: {
          cashPkr: cashN,
          bankPkr: bankN,
          bank:
            bankN > 0
              ? {
                  bankAccountId,
                  bankName: acc?.bankName ?? null,
                  accountTitle: acc?.accountTitle ?? null,
                  verified: true,
                }
              : undefined,
        },
      });
      refresh();
      Alert.alert("Sale saved", `${sale.brand} ${sale.model} · ${formatPkr(sale.pricePkr)}`, [
        {
          text: "WhatsApp",
          onPress: () => openWhatsApp(sale.customerPhone, buildWhatsAppSaleText(sale)),
        },
        { text: "OK" },
      ]);
      setDeviceId("");
      setCustomerName("");
      setCustomerPhone("");
      setPrice("");
      setCash("");
      setBank("");
      setScan("");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save sale");
    }
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <Text style={{ color: mz.gold, fontSize: 20, fontWeight: "800" }}>New Sale</Text>
        <Text style={{ color: mz.muted, fontSize: 13 }}>Customer ko phone becho</Text>

        <Field label="Scan IMEI / Barcode">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              value={scan}
              onChangeText={setScan}
              placeholder="Enter or scan IMEI"
              placeholderTextColor={mz.muted}
              style={inputStyle}
            />
            <Pressable onPress={applyScan} style={btnSoft}>
              <Text style={{ color: mz.gold, fontWeight: "700" }}>Find</Text>
            </Pressable>
          </View>
        </Field>

        <Field label="Select Mobile">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {inStock.length === 0 ? (
                <Text style={{ color: mz.muted }}>No stock — add a purchase first</Text>
              ) : (
                inStock.map((d) => (
                  <Pressable
                    key={d.id}
                    onPress={() => {
                      setDeviceId(d.id);
                      setPrice(String(d.salePricePkr ?? d.purchasePricePkr));
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: deviceId === d.id ? mz.gold : mz.card,
                      borderWidth: 1,
                      borderColor: deviceId === d.id ? mz.gold : mz.border,
                    }}
                  >
                    <Text
                      style={{
                        color: deviceId === d.id ? mz.bg : mz.text,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {d.brand} {d.model}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
          {selected ? (
            <Text style={{ color: mz.teal, marginTop: 6, fontSize: 12 }}>
              IMEI {selected.imei} · Cost {formatPkr(selected.purchasePricePkr)}
            </Text>
          ) : null}
        </Field>

        <Field label="Customer Name">
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Select / enter customer"
            placeholderTextColor={mz.muted}
            style={inputStyle}
          />
        </Field>
        <Field label="Phone">
          <TextInput
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            placeholder="03XXXXXXXXX"
            placeholderTextColor={mz.muted}
            style={inputStyle}
          />
        </Field>

        <Field label="Sale Price">
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={mz.muted}
            style={inputStyle}
          />
        </Field>

        <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>Payment Method</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["cash", "bank", "both"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setPayMode(m)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: payMode === m ? mz.gold : mz.card,
                borderWidth: 1,
                borderColor: payMode === m ? mz.gold : mz.border,
              }}
            >
              <Text
                style={{
                  color: payMode === m ? mz.bg : mz.text,
                  fontWeight: "700",
                  textTransform: "capitalize",
                }}
              >
                {m === "both" ? "Both" : m}
              </Text>
            </Pressable>
          ))}
        </View>

        {payMode !== "bank" ? (
          <Field label="Cash Received">
            <TextInput
              value={cash}
              onChangeText={setCash}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={mz.muted}
              style={inputStyle}
            />
          </Field>
        ) : null}
        {payMode !== "cash" ? (
          <>
            <Field label="Bank Received">
              <TextInput
                value={bank}
                onChangeText={setBank}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={mz.muted}
                style={inputStyle}
              />
            </Field>
            <Field label="Bank Account">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {db.bankAccounts.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => setBankAccountId(a.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: bankAccountId === a.id ? mz.tealDim : mz.card,
                      borderWidth: 1,
                      borderColor: bankAccountId === a.id ? mz.teal : mz.border,
                    }}
                  >
                    <Text style={{ color: mz.text, fontWeight: "600", fontSize: 12 }}>
                      {a.bankName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          </>
        ) : null}

        <View
          style={{
            backgroundColor: mz.card,
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: mz.border,
            gap: 6,
          }}
        >
          <Row label="Sale Price" value={formatPkr(priceN)} />
          <Row label="Received" value={formatPkr(cashN + bankN)} tone={mz.teal} />
          <Row label="Remaining" value={formatPkr(remaining)} tone={remaining > 0 ? mz.rose : mz.teal} />
        </View>

        <Pressable
          onPress={onSave}
          style={{
            backgroundColor: mz.gold,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
            marginTop: 4,
          }}
        >
          <Text style={{ color: mz.bg, fontWeight: "800", fontSize: 16 }}>Save Sale</Text>
        </Pressable>
      </ScrollView>
    </MzShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: mz.muted }}>{label}</Text>
      <Text style={{ color: tone ?? mz.text, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

const inputStyle = {
  flex: 1,
  backgroundColor: mz.card,
  borderWidth: 1,
  borderColor: mz.border,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: mz.text,
  fontSize: 15,
} as const;

const btnSoft = {
  backgroundColor: mz.card,
  borderWidth: 1,
  borderColor: mz.gold,
  borderRadius: 12,
  paddingHorizontal: 14,
  justifyContent: "center" as const,
};
