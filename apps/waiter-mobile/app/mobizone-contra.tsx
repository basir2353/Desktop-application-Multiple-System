import type { MobizoneDocumentAttachment } from "@platform/contracts";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { pickReferenceDocuments } from "../src/mobizone/documentPick";
import { MzShell } from "../src/mobizone/MzShell";
import {
  filterByDateRange,
  formatPkr,
  getCashBankBalances,
  monthStartDateInput,
  recordContraVoucher,
  todayDateInput,
  type MoneyAccountRef,
} from "../src/mobizone/storeCore";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import {
  MzCard,
  MzDateRangeChips,
  MzEmpty,
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

function parseRef(value: string): MoneyAccountRef {
  if (value === "cash") return { kind: "cash" };
  return { kind: "bank", accountId: value };
}

export default function MobizoneContraScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap, tileW } = useMzLayout();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh, ready } = useMobizoneDb();
  const balances = useMemo(() => getCashBankBalances(db), [db]);
  const [from, setFrom] = useState("cash");
  const [to, setTo] = useState(db.bankAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<MobizoneDocumentAttachment[]>([]);
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);

  const history = useMemo(
    () =>
      filterByDateRange(
        (db.vouchers ?? []).filter((v) => v.kind === "contra"),
        fromDate || null,
        toDate || null,
      ),
    [db.vouchers, fromDate, toDate],
  );

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  async function onPickDocs(): Promise<void> {
    try {
      const next = await pickReferenceDocuments(attachments);
      setAttachments(next);
    } catch (e) {
      Alert.alert("Upload", e instanceof Error ? e.message : "Could not pick file");
    }
  }

  function onSave(): void {
    if (!ready) return;
    if (!to) {
      Alert.alert("To account", "Select the To account.");
      return;
    }
    try {
      recordContraVoucher(branchCode, {
        from: parseRef(from),
        to: parseRef(to),
        amountPkr: Number(amount),
        reference: reference || null,
        note: note || null,
        attachments,
      });
      refresh();
      Alert.alert("Saved", "Contra voucher saved.");
      setAmount("");
      setReference("");
      setNote("");
      setAttachments([]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    }
  }

  const moneyOptions = [
    { id: "cash", label: "Cash on hand" },
    ...db.bankAccounts.map((a) => ({ id: a.id, label: `${a.bankName} — ${a.accountTitle}` })),
  ];

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}>
        <MzScreenTitle
          title="Contra Voucher"
          subtitle="Transfer money between Cash and Bank accounts"
        />
        {!ready ? <ActivityIndicator color={mz.accent} /> : null}

        <MzCard style={{ backgroundColor: mz.navyDeep }}>
          <Text style={{ color: "rgba(233,238,243,0.7)", fontSize: 11, fontWeight: "700" }}>
            CASH ON HAND
          </Text>
          <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 22, marginTop: 4 }}>
            {formatPkr(balances.cash)}
          </Text>
        </MzCard>

        <MzSection title="New contra entry">
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>From account *</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {moneyOptions.map((o) => (
              <Pressable
                key={`from-${o.id}`}
                onPress={() => setFrom(o.id)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: from === o.id ? mz.accent : mz.cardSoft,
                }}
              >
                <Text style={{ color: from === o.id ? mz.onGold : mz.text, fontWeight: "700", fontSize: 11 }}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>To account *</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {moneyOptions.map((o) => (
              <Pressable
                key={`to-${o.id}`}
                onPress={() => setTo(o.id)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: to === o.id ? mz.accent : mz.cardSoft,
                }}
              >
                <Text style={{ color: to === o.id ? mz.onGold : mz.text, fontWeight: "700", fontSize: 11 }}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <MzField label="Amount (PKR) *">
            <MzInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
          </MzField>
          <MzField label="Reference">
            <MzInput value={reference} onChangeText={setReference} placeholder="Deposit slip / txn id" />
          </MzField>
          <MzField label="Details">
            <MzInput value={note} onChangeText={setNote} placeholder="Optional note" />
          </MzField>
          <Pressable
            onPress={() => void onPickDocs()}
            style={{
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: mz.border,
              backgroundColor: mz.cardSoft,
            }}
          >
            <Text style={{ color: mz.accent, fontWeight: "800", textAlign: "center" }}>
              Upload documents (PDF / Word / PPT…)
            </Text>
          </Pressable>
          {attachments.map((d) => (
            <Text key={d.id} style={{ color: mz.muted, fontSize: 12 }}>
              · {d.fileName}
            </Text>
          ))}
          <MzPrimaryButton label="Save contra voucher" onPress={onSave} />
        </MzSection>

        <MzSection title={`Contra history · ${history.length}`}>
          <MzDateRangeChips
            fromDate={fromDate}
            toDate={toDate}
            onChange={(f, t) => {
              setFromDate(f);
              setToDate(t);
            }}
          />
        </MzSection>
        {history.length === 0 ? (
          <MzEmpty title="No contra vouchers in this range" />
        ) : (
          history.map((v) => {
            const credit = v.lines.find((l) => l.side === "credit");
            const debit = v.lines.find((l) => l.side === "debit");
            return (
              <MzCard key={v.id}>
                <Text style={{ color: mz.text, fontWeight: "700" }}>
                  {credit?.accountName} → {debit?.accountName}
                </Text>
                <Text style={{ color: mz.muted, fontSize: 11, marginTop: 4 }}>
                  {new Date(v.createdAt).toLocaleString()}
                  {v.reference ? ` · Ref ${v.reference}` : ""}
                </Text>
                <Text style={{ color: mz.accent, fontWeight: "800", marginTop: 6 }}>
                  {formatPkr(v.amountPkr)}
                </Text>
                {(v.attachments ?? []).map((d) => (
                  <Text key={d.id} style={{ color: mz.blue, fontSize: 11, marginTop: 2 }}>
                    {d.fileName}
                  </Text>
                ))}
              </MzCard>
            );
          })
        )}
      </ScrollView>
    </MzShell>
  );
}
