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
  const [attachCnic, setAttachCnic] = useState(false);
  const [attachPhoto, setAttachPhoto] = useState(false);
  const [imei, setImei] = useState("");
  const [imei2, setImei2] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [colour, setColour] = useState("");
  const [storage, setStorage] = useState("");
  const [condition, setCondition] = useState<"new" | "used">("used");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "bank" | "split" | "udhaar">("cash");
  const [dueDate, setDueDate] = useState("");
  const [shareWa, setShareWa] = useState(true);

  useEffect(() => {
    if (!bankAccountId && db.bankAccounts.length === 1) {
      setBankAccountId(db.bankAccounts[0]!.id);
    }
  }, [db.bankAccounts, bankAccountId]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const priceN = Number(purchasePrice) || 0;
  const cashN = payMode === "bank" || payMode === "udhaar" ? 0 : Number(cash) || 0;
  const bankN = payMode === "cash" || payMode === "udhaar" ? 0 : Number(bank) || 0;
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
    if (remaining > 0 && !dueDate.trim()) {
      Alert.alert("Due date", "Udhaar / remaining balance ke liye due date likhein (YYYY-MM-DD).");
      return;
    }
    const acc = db.bankAccounts.find((a) => a.id === resolvedBankId);
    try {
      const purchase = recordPurchase(branchCode, {
        sellerName: sellerName.trim(),
        sellerPhone: sellerPhone.trim() || null,
        sellerCnic: sellerCnic.trim() || null,
        sellerAddress: sellerAddress.trim() || null,
        sellerPhotoDataUrl: attachPhoto ? "attached://seller-photo" : null,
        cnicFrontDataUrl: attachCnic ? "attached://cnic-front" : null,
        cnicBackDataUrl: attachCnic ? "attached://cnic-back" : null,
        imei: imei.trim(),
        imei2: imei2.trim() || null,
        brand: brand.trim(),
        model: model.trim(),
        colour: colour.trim() || null,
        storage: storage.trim() || null,
        condition,
        purchasePricePkr: priceN,
        salePricePkr: Number(salePrice) || null,
        dueDate: remaining > 0 ? dueDate.trim() : null,
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
      const afterSave = () => {
        if (shareWa) {
          openWhatsApp(purchase.sellerPhone, buildWhatsAppPurchaseText(purchase));
        }
      };
      Alert.alert("Purchase saved", `${purchase.brand} ${purchase.model} added to stock`, [
        {
          text: "Print again",
          onPress: () => {
            void printPurchaseReceipt(purchase, branchCode);
          },
        },
        { text: shareWa ? "OK · WhatsApp" : "OK", onPress: afterSave },
      ]);
      setSellerName("");
      setSellerPhone("");
      setSellerCnic("");
      setSellerAddress("");
      setAttachCnic(false);
      setAttachPhoto(false);
      setImei("");
      setImei2("");
      setBrand("");
      setModel("");
      setColour("");
      setStorage("");
      setPurchasePrice("");
      setSalePrice("");
      setCash("");
      setBank("");
      setDueDate("");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save purchase");
    }
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle title="New Purchase" subtitle="Seller · IMEI · Used/New · split payment" />
        {!ready ? <ActivityIndicator color={mz.gold} /> : null}

        <MzSection title="Purchase date">
          <MzField label="Date">
            <MzInput
              value={new Date().toISOString().slice(0, 10)}
              editable={false}
              placeholder="YYYY-MM-DD"
            />
          </MzField>
        </MzSection>

        <MzSection title="Seller details">
          <MzField label="Seller Name *">
            <MzInput
              value={sellerName}
              onChangeText={setSellerName}
              placeholder="Seller / shop name"
            />
          </MzField>
          <MzField label="Seller Phone">
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <AttachChip
              label={attachCnic ? "CNIC attached ✓" : "Attach CNIC"}
              active={attachCnic}
              onPress={() => setAttachCnic((v) => !v)}
            />
            <AttachChip
              label={attachPhoto ? "Photo attached ✓" : "Seller photo"}
              active={attachPhoto}
              onPress={() => setAttachPhoto((v) => !v)}
            />
          </View>
        </MzSection>

        <MzSection title="Phone details">
          <MzField label="Scan or type IMEI *">
            <MzInput
              value={imei}
              onChangeText={setImei}
              keyboardType="number-pad"
              placeholder="Scan or type IMEI"
            />
          </MzField>
          <MzField label="IMEI 2 (optional)">
            <MzInput
              value={imei2}
              onChangeText={setImei2}
              keyboardType="number-pad"
              placeholder="Second IMEI"
            />
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
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <MzField label="Colour">
                <MzInput value={colour} onChangeText={setColour} placeholder="Black" />
              </MzField>
            </View>
            <View style={{ flex: 1 }}>
              <MzField label="Storage">
                <MzInput value={storage} onChangeText={setStorage} placeholder="128GB" />
              </MzField>
            </View>
          </View>
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>Condition</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <MzChip label="Used" active={condition === "used"} onPress={() => setCondition("used")} />
            <MzChip label="New" active={condition === "new"} onPress={() => setCondition("new")} />
          </View>
        </MzSection>

        <MzSection title="Payment details">
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                ["cash", "Cash"],
                ["bank", "Bank"],
                ["split", "Split"],
                ["udhaar", "Udhaar"],
              ] as const
            ).map(([m, label]) => (
              <MzChip
                key={m}
                label={label}
                active={payMode === m}
                onPress={() => {
                  setPayMode(m);
                  if (m === "udhaar") {
                    setCash("");
                    setBank("");
                  }
                }}
              />
            ))}
          </View>
          {payMode === "cash" || payMode === "split" ? (
            <MzField label="Cash Paid">
              <MzInput value={cash} onChangeText={setCash} keyboardType="numeric" placeholder="0" />
            </MzField>
          ) : null}
          {payMode === "bank" || payMode === "split" ? (
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
                        backgroundColor: bankAccountId === a.id ? mz.navy : mz.ivory,
                        borderWidth: 1,
                        borderColor: bankAccountId === a.id ? mz.navy : mz.border,
                      }}
                    >
                      <Text
                        style={{
                          color: bankAccountId === a.id ? mz.gold : mz.text,
                          fontWeight: "600",
                          fontSize: 12,
                        }}
                      >
                        {a.bankName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </MzField>
            </>
          ) : null}
          {remaining > 0 ? (
            <MzField label="Due date (udhaar)">
              <MzInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
              />
            </MzField>
          ) : null}
          <View
            style={{
              backgroundColor: "#F3E8D0",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: mz.gold,
              gap: 6,
            }}
          >
            <MzRow label="Purchase" value={formatPkr(priceN)} />
            <MzRow label="Paid" value={formatPkr(cashN + bankN)} tone={mz.teal} />
            <MzRow
              label="Remaining balance"
              value={formatPkr(remaining)}
              tone={remaining > 0 ? mz.rose : mz.teal}
            />
          </View>
          <Pressable
            onPress={() => setShareWa((v) => !v)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: mz.navy,
                backgroundColor: shareWa ? mz.gold : mz.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {shareWa ? <Text style={{ color: mz.navy, fontWeight: "900", fontSize: 12 }}>✓</Text> : null}
            </View>
            <Text style={{ color: mz.text, fontWeight: "600" }}>Share receipt on WhatsApp</Text>
          </Pressable>
        </MzSection>

        <MzPrimaryButton label="💾  Save Purchase" onPress={onSave} />
      </ScrollView>
    </MzShell>
  );
}

function AttachChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: active ? "#EEF6FF" : mz.ivory,
        borderWidth: 1,
        borderColor: active ? mz.blue : mz.border,
      }}
    >
      <Text style={{ color: active ? mz.blue : mz.navy, fontWeight: "700", fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
