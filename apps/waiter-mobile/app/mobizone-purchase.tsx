import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  buildWhatsAppPurchaseText,
  formatPkr,
  openWhatsApp,
  printPurchaseReceipt,
  recordPurchase,
} from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import {
  MzChip,
  MzField,
  MzInput,
  MzPrimaryButton,
  MzRow,
  MzScreenTitle,
  MzSection,
} from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

export default function MobizonePurchaseScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh, ready } = useMobizoneDb();

  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerCnic, setSellerCnic] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
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

  useEffect(() => {
    if (!bankAccountId && db.bankAccounts.length === 1) {
      setBankAccountId(db.bankAccounts[0]!.id);
    }
  }, [db.bankAccounts, bankAccountId]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const priceN = Number(purchasePrice) || 0;
  const cashN = payMode === "bank" ? 0 : Number(cash) || 0;
  const bankN = payMode === "cash" ? 0 : Number(bank) || 0;
  const remaining = Math.max(0, priceN - cashN - bankN);

  function onSave(): void {
    if (!ready) {
      Alert.alert("Please wait", "Data abhi load ho raha hai — 1 second baad try karein.");
      return;
    }
    if (!sellerName.trim() || !imei.trim() || !brand.trim() || !model.trim() || !(priceN > 0)) {
      Alert.alert("Missing info", "Seller, IMEI, brand, model, and purchase price required.");
      return;
    }
    const resolvedBankId =
      bankAccountId || (bankN > 0 && db.bankAccounts.length === 1 ? db.bankAccounts[0]!.id : "");
    if (bankN > 0 && !resolvedBankId) {
      Alert.alert("Bank account", "Bank amount ke liye account select karein.");
      return;
    }
    const acc = db.bankAccounts.find((a) => a.id === resolvedBankId);
    try {
      const purchase = recordPurchase(branchCode, {
        sellerName: sellerName.trim(),
        sellerPhone: sellerPhone.trim() || null,
        sellerCnic: sellerCnic.trim() || null,
        sellerAddress: sellerAddress.trim() || null,
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
                  bankAccountId: resolvedBankId,
                  bankName: acc?.bankName ?? null,
                  accountTitle: acc?.accountTitle ?? null,
                  verified: true,
                }
              : undefined,
        },
      });
      refresh();
      void printPurchaseReceipt(purchase, branchCode);
      Alert.alert("Purchase saved", `${purchase.brand} ${purchase.model} added to stock`, [
        {
          text: "Print again",
          onPress: () => {
            void printPurchaseReceipt(purchase, branchCode);
          },
        },
        {
          text: "WhatsApp",
          onPress: () => openWhatsApp(purchase.sellerPhone, buildWhatsAppPurchaseText(purchase)),
        },
        { text: "OK" },
      ]);
      setSellerName("");
      setSellerPhone("");
      setSellerCnic("");
      setSellerAddress("");
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
        <MzScreenTitle title="New Purchase" subtitle="Seller details · IMEI · Used/New · payment" />
        {!ready ? <ActivityIndicator color={mz.gold} /> : null}

        <MzSection title="Seller details">
          <MzField label="Seller Name *">
            <MzInput
              value={sellerName}
              onChangeText={setSellerName}
              placeholder="Seller / shop name"
            />
          </MzField>
          <MzField label="Phone">
            <MzInput
              value={sellerPhone}
              onChangeText={setSellerPhone}
              keyboardType="phone-pad"
              placeholder="03XXXXXXXXX"
            />
          </MzField>
          <MzField label="CNIC / ID">
            <MzInput
              value={sellerCnic}
              onChangeText={setSellerCnic}
              placeholder="xxxxx-xxxxxxx-x"
            />
          </MzField>
          <MzField label="Address">
            <MzInput
              value={sellerAddress}
              onChangeText={setSellerAddress}
              placeholder="Address"
            />
          </MzField>
        </MzSection>

        <MzSection title="Phone details">
          <MzField label="IMEI / Barcode *">
            <MzInput value={imei} onChangeText={setImei} placeholder="Scan or type IMEI" />
          </MzField>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <MzField label="Brand *">
                <MzInput value={brand} onChangeText={setBrand} placeholder="Samsung" />
              </MzField>
            </View>
            <View style={{ flex: 1 }}>
              <MzField label="Model *">
                <MzInput value={model} onChangeText={setModel} placeholder="A54" />
              </MzField>
            </View>
          </View>
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>Condition</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <MzChip label="Used" active={condition === "used"} onPress={() => setCondition("used")} />
            <MzChip label="New" active={condition === "new"} onPress={() => setCondition("new")} />
          </View>
        </MzSection>

        <MzSection title="Payment">
          <MzField label="Purchase Price *">
            <MzInput
              value={purchasePrice}
              onChangeText={setPurchasePrice}
              keyboardType="numeric"
              placeholder="0"
            />
          </MzField>
          <MzField label="Expected Sale Price">
            <MzInput
              value={salePrice}
              onChangeText={setSalePrice}
              keyboardType="numeric"
              placeholder="0"
            />
          </MzField>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["cash", "bank", "both"] as const).map((m) => (
              <MzChip
                key={m}
                label={m === "both" ? "Both" : m === "cash" ? "Cash" : "Bank"}
                active={payMode === m}
                onPress={() => setPayMode(m)}
              />
            ))}
          </View>
          {payMode !== "bank" ? (
            <MzField label="Cash Paid">
              <MzInput value={cash} onChangeText={setCash} keyboardType="numeric" placeholder="0" />
            </MzField>
          ) : null}
          {payMode !== "cash" ? (
            <>
              <MzField label="Bank Paid">
                <MzInput
                  value={bank}
                  onChangeText={setBank}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </MzField>
              <MzField label="Bank Account">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {db.bankAccounts.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setBankAccountId(a.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: bankAccountId === a.id ? mz.tealDim : mz.cardSoft,
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
              </MzField>
            </>
          ) : null}
          <View style={{ gap: 6, marginTop: 4 }}>
            <MzRow label="Purchase" value={formatPkr(priceN)} />
            <MzRow label="Paid" value={formatPkr(cashN + bankN)} tone={mz.teal} />
            <MzRow
              label="Udhaar"
              value={formatPkr(remaining)}
              tone={remaining > 0 ? mz.rose : mz.teal}
            />
          </View>
        </MzSection>

        <MzPrimaryButton label="Save Purchase · Print bill" onPress={onSave} />
      </ScrollView>
    </MzShell>
  );
}
