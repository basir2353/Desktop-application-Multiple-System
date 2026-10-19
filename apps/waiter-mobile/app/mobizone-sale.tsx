import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  buildWhatsAppSaleText,
  findDeviceByImei,
  formatPkr,
  openWhatsApp,
  printSaleReceipt,
  recordSale,
} from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import {
  MzChip,
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

export default function MobizoneSaleScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh, ready } = useMobizoneDb();
  const inStock = useMemo(() => db.devices.filter((d) => d.status === "in_stock"), [db.devices]);

  const [scan, setScan] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCnic, setCustomerCnic] = useState("");
  const [attachCnic, setAttachCnic] = useState(false);
  const [attachPhoto, setAttachPhoto] = useState(false);
  const [price, setPrice] = useState("");
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "bank" | "split" | "udhaar">("cash");
  const [dueDate, setDueDate] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("0");
  const [shareWa, setShareWa] = useState(true);

  useEffect(() => {
    if (!bankAccountId && db.bankAccounts.length === 1) {
      setBankAccountId(db.bankAccounts[0]!.id);
    }
  }, [db.bankAccounts, bankAccountId]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const selected = inStock.find((d) => d.id === deviceId) ?? null;
  const priceN = Number(price) || 0;
  const cashN = payMode === "bank" || payMode === "udhaar" ? 0 : Number(cash) || 0;
  const bankN = payMode === "cash" || payMode === "udhaar" ? 0 : Number(bank) || 0;
  const remaining = Math.max(0, priceN - cashN - bankN);

  function applyScan(): void {
    if (!ready) return;
    const found = findDeviceByImei(branchCode, scan.trim());
    if (!found || found.status !== "in_stock") {
      Alert.alert("Not found", "No in-stock device matched that IMEI / barcode.");
      return;
    }
    setDeviceId(found.id);
    setPrice(String(found.salePricePkr ?? found.purchasePricePkr));
  }

  function onSave(): void {
    if (!ready) {
      Alert.alert("Please wait", "Data abhi load ho raha hai — 1 second baad try karein.");
      return;
    }
    if (!deviceId || !customerName.trim() || !(priceN > 0)) {
      Alert.alert("Missing info", "Select a phone, customer name, and sale price.");
      return;
    }
    if (!customerPhone.trim()) {
      Alert.alert("Customer phone", "Phone bill / WhatsApp ke liye zaroori hai.");
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
      const sale = recordSale(branchCode, {
        deviceId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        customerAddress: customerAddress.trim() || null,
        customerCnic: customerCnic.trim() || null,
        customerPhotoDataUrl: attachPhoto ? "attached://customer-photo" : null,
        cnicFrontDataUrl: attachCnic ? "attached://cnic-front" : null,
        cnicBackDataUrl: attachCnic ? "attached://cnic-back" : null,
        pricePkr: priceN,
        dueDate: remaining > 0 ? dueDate.trim() : null,
        warrantyDays: Number(warrantyDays) || 0,
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
      void printSaleReceipt(sale, branchCode);
      Alert.alert("Sale saved", `${sale.brand} ${sale.model} · ${formatPkr(sale.pricePkr)}`, [
        {
          text: "Print again",
          onPress: () => {
            void printSaleReceipt(sale, branchCode);
          },
        },
        {
          text: shareWa ? "OK · WhatsApp" : "OK",
          onPress: () => {
            if (shareWa) openWhatsApp(sale.customerPhone, buildWhatsAppSaleText(sale));
          },
        },
      ]);
      setDeviceId("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setCustomerCnic("");
      setAttachCnic(false);
      setAttachPhoto(false);
      setPrice("");
      setCash("");
      setBank("");
      setScan("");
      setDueDate("");
      setWarrantyDays("0");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save sale");
    }
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle title="New Sale" subtitle="Select phone · customer · cash / bank / udhaar" />
        {!ready ? <ActivityIndicator color={mz.gold} /> : null}

        <MzSection title="Phone">
          <MzField label="Scan IMEI / Barcode">
            <View style={{ flexDirection: "row", gap: 8 }}>
              <MzInput value={scan} onChangeText={setScan} placeholder="Enter or scan IMEI" />
              <Pressable onPress={applyScan} style={btnSoft}>
                <Text style={{ color: mz.navy, fontWeight: "800" }}>Find</Text>
              </Pressable>
            </View>
          </MzField>
          <MzField label="Select Mobile">
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
                        backgroundColor: deviceId === d.id ? mz.gold : mz.ivory,
                        borderWidth: 1,
                        borderColor: deviceId === d.id ? mz.gold : mz.border,
                      }}
                    >
                      <Text
                        style={{
                          color: mz.navy,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {d.brand} {d.model}
                        {d.storage ? ` · ${d.storage}` : ""}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </ScrollView>
            {selected ? (
              <Text style={{ color: mz.teal, marginTop: 6, fontSize: 12 }}>
                IMEI {selected.imei}
                {selected.imei2 ? ` / ${selected.imei2}` : ""}
                {selected.colour ? ` · ${selected.colour}` : ""}
                {" · Cost "}
                {formatPkr(selected.purchasePricePkr)}
              </Text>
            ) : null}
          </MzField>
        </MzSection>

        <MzSection title="Customer">
          <MzField label="Customer Name *">
            <MzInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Customer full name"
            />
          </MzField>
          <MzField label="Phone *">
            <MzInput
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              placeholder="03XXXXXXXXX"
            />
          </MzField>
          <MzField label="CNIC / ID">
            <MzInput
              value={customerCnic}
              onChangeText={setCustomerCnic}
              placeholder="xxxxx-xxxxxxx-x"
            />
          </MzField>
          <MzField label="Address">
            <MzInput
              value={customerAddress}
              onChangeText={setCustomerAddress}
              placeholder="Customer address"
            />
          </MzField>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <AttachChip
              label={attachCnic ? "CNIC attached ✓" : "Attach CNIC"}
              active={attachCnic}
              onPress={() => setAttachCnic((v) => !v)}
            />
            <AttachChip
              label={attachPhoto ? "Photo attached ✓" : "Customer photo"}
              active={attachPhoto}
              onPress={() => setAttachPhoto((v) => !v)}
            />
          </View>
        </MzSection>

        <MzSection title="Payment">
          <MzField label="Sale Price">
            <MzInput
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="0"
            />
          </MzField>
          <MzField label="Warranty (days)">
            <MzInput
              value={warrantyDays}
              onChangeText={setWarrantyDays}
              keyboardType="number-pad"
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
            <MzField label="Cash Received">
              <MzInput value={cash} onChangeText={setCash} keyboardType="numeric" placeholder="0" />
            </MzField>
          ) : null}
          {payMode === "bank" || payMode === "split" ? (
            <>
              <MzField label="Bank Received">
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
              <MzInput value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
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
            <Row label="Sale Price" value={formatPkr(priceN)} />
            <Row label="Received" value={formatPkr(cashN + bankN)} tone={mz.teal} />
            <Row
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

        <MzPrimaryButton label="Save Sale · Print bill" onPress={onSave} />
      </ScrollView>
    </MzShell>
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

const btnSoft = {
  backgroundColor: mz.gold,
  borderWidth: 1,
  borderColor: mz.gold,
  borderRadius: 12,
  paddingHorizontal: 14,
  justifyContent: "center" as const,
};
