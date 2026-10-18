import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  buildWhatsAppPurchaseText,
  formatPkr,
  openWhatsApp,
  recordPurchase,
} from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

export default function MobizonePurchaseScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh } = useMobizoneDb();

  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [imei, setImei] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState<"new" | "used">("used");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "bank" | "both">("cash");

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const priceN = Number(purchasePrice) || 0;
  const cashN = payMode === "bank" ? 0 : Number(cash) || 0;
  const bankN = payMode === "cash" ? 0 : Number(bank) || 0;
  const remaining = Math.max(0, priceN - cashN - bankN);

  function onSave(): void {
    if (!sellerName.trim() || !imei.trim() || !brand.trim() || !model.trim() || !(priceN > 0)) {
      Alert.alert("Missing info", "Seller, IMEI, brand, model, and purchase price required.");
      return;
    }
    if (payMode !== "cash" && bankN > 0 && !bankAccountId) {
      Alert.alert("Bank account", "Select a bank account for bank payment.");
      return;
    }
    const acc = db.bankAccounts.find((a) => a.id === bankAccountId);
    try {
      const purchase = recordPurchase(branchCode, {
        sellerName: sellerName.trim(),
        sellerPhone: sellerPhone.trim() || null,
        imei: imei.trim(),
        brand: brand.trim(),
        model: model.trim(),
        condition,
        purchasePricePkr: priceN,
        salePricePkr: Number(salePrice) || null,
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
      Alert.alert(
        "Purchase saved",
        `${purchase.brand} ${purchase.model} added to stock`,
        [
          {
            text: "WhatsApp",
            onPress: () => openWhatsApp(purchase.sellerPhone, buildWhatsAppPurchaseText(purchase)),
          },
          { text: "OK" },
        ],
      );
      setSellerName("");
      setSellerPhone("");
      setImei("");
      setBrand("");
      setModel("");
      setPurchasePrice("");
      setSalePrice("");
      setCash("");
      setBank("");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save purchase");
    }
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <Text style={{ color: mz.gold, fontSize: 20, fontWeight: "800" }}>New Purchase</Text>
        <Text style={{ color: mz.muted, fontSize: 13 }}>Phone khareedo · stock mein add</Text>

        <Field label="Seller Name">
          <TextInput
            value={sellerName}
            onChangeText={setSellerName}
            placeholder="Seller / shop name"
            placeholderTextColor={mz.muted}
            style={inputStyle}
          />
        </Field>
        <Field label="Seller Phone">
          <TextInput
            value={sellerPhone}
            onChangeText={setSellerPhone}
            keyboardType="phone-pad"
            placeholder="03XXXXXXXXX"
            placeholderTextColor={mz.muted}
            style={inputStyle}
          />
        </Field>
        <Field label="IMEI / Barcode">
          <TextInput
            value={imei}
            onChangeText={setImei}
            placeholder="Scan or type IMEI"
            placeholderTextColor={mz.muted}
            style={inputStyle}
          />
        </Field>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Brand">
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder="Samsung"
                placeholderTextColor={mz.muted}
                style={inputStyle}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Model">
              <TextInput
                value={model}
                onChangeText={setModel}
                placeholder="A54"
                placeholderTextColor={mz.muted}
                style={inputStyle}
              />
            </Field>
          </View>
        </View>

        <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>Condition</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["used", "new"] as const).map((c) => (
            <Pressable
              key={c}
              onPress={() => setCondition(c)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: condition === c ? mz.gold : mz.card,
                borderWidth: 1,
                borderColor: condition === c ? mz.gold : mz.border,
              }}
            >
              <Text
                style={{
                  color: condition === c ? mz.bg : mz.text,
                  fontWeight: "700",
                  textTransform: "capitalize",
                }}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </View>

        <Field label="Purchase Price">
          <TextInput
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={mz.muted}
            style={inputStyle}
          />
        </Field>
        <Field label="Expected Sale Price (optional)">
          <TextInput
            value={salePrice}
            onChangeText={setSalePrice}
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
          <Field label="Cash Paid">
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
            <Field label="Bank Paid">
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
          <Row label="Purchase" value={formatPkr(priceN)} />
          <Row label="Paid" value={formatPkr(cashN + bankN)} tone={mz.teal} />
          <Row label="Udhaar" value={formatPkr(remaining)} tone={remaining > 0 ? mz.rose : mz.teal} />
        </View>

        <Pressable
          onPress={onSave}
          style={{
            backgroundColor: mz.gold,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: "center",
          }}
        >
          <Text style={{ color: mz.bg, fontWeight: "800", fontSize: 16 }}>Save Purchase</Text>
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
  backgroundColor: mz.card,
  borderWidth: 1,
  borderColor: mz.border,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: mz.text,
  fontSize: 15,
} as const;
