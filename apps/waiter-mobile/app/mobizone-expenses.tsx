import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr, recordExpense } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import {
  MzCard,
  MzChip,
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

export default function MobizoneExpensesScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh, ready } = useMobizoneDb();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [note, setNote] = useState("");

  const total = useMemo(
    () => (db.expenses ?? []).reduce((a, x) => a + x.amountPkr, 0),
    [db.expenses],
  );

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  function onSave(): void {
    if (!ready) {
      Alert.alert("Please wait", "Data abhi load ho raha hai.");
      return;
    }
    if (!title.trim() || !(Number(amount) > 0)) {
      Alert.alert("Missing info", "Title aur amount zaroori hain.");
      return;
    }
    const resolvedBankId =
      bankAccountId ||
      (method === "bank" && db.bankAccounts.length === 1 ? db.bankAccounts[0]!.id : "");
    if (method === "bank" && !resolvedBankId) {
      Alert.alert("Bank account", "Bank se pay karne ke liye account select karein.");
      return;
    }
    try {
      recordExpense(branchCode, {
        title: title.trim(),
        amountPkr: Number(amount),
        method,
        bankAccountId: method === "bank" ? resolvedBankId || null : null,
        note: note.trim() || null,
      });
      refresh();
      Alert.alert("Saved", "Expense profit se automatically deduct hoga.");
      setTitle("");
      setAmount("");
      setNote("");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save expense");
    }
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle
          title="Shop Expenses"
          subtitle="Khana, salary, rent — profit se auto minus"
        />
        {!ready ? <ActivityIndicator color={mz.accent} /> : null}

        <MzCard style={{ backgroundColor: mz.ink, borderColor: mz.accent }}>
          <Text style={{ color: "rgba(233,238,243,0.7)", fontSize: 11, fontWeight: "700" }}>
            TOTAL EXPENSES
          </Text>
          <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 24, marginTop: 4 }}>
            {formatPkr(total)}
          </Text>
        </MzCard>

        <MzSection title="Add expense">
          <MzField label="Title *">
            <MzInput
              value={title}
              onChangeText={setTitle}
              placeholder="Salary / khana / rent / courier"
            />
          </MzField>
          <MzField label="Amount (PKR) *">
            <MzInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
            />
          </MzField>
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>Paid from</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <MzChip label="Cash" active={method === "cash"} onPress={() => setMethod("cash")} />
            <MzChip label="Bank" active={method === "bank"} onPress={() => setMethod("bank")} />
          </View>
          {method === "bank" ? (
            <MzField label="Bank account">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {db.bankAccounts.length === 0 ? (
                  <Text style={{ color: mz.muted }}>Pehle bank account add karein</Text>
                ) : (
                  db.bankAccounts.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setBankAccountId(a.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: bankAccountId === a.id ? mz.accent : mz.cardSoft,
                        borderWidth: 1,
                        borderColor: bankAccountId === a.id ? mz.accent : mz.border,
                      }}
                    >
                      <Text
                        style={{
                          color: bankAccountId === a.id ? mz.onGold : mz.text,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {a.bankName}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            </MzField>
          ) : null}
          <MzField label="Note">
            <MzInput value={note} onChangeText={setNote} placeholder="Optional" />
          </MzField>
          <MzPrimaryButton label="Save expense" onPress={onSave} />
        </MzSection>

        <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "700" }}>RECENT</Text>
        {(db.expenses ?? []).length === 0 ? (
          <MzEmpty title="No expenses yet" />
        ) : (
          (db.expenses ?? []).slice(0, 20).map((x) => (
            <MzCard
              key={x.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                padding: 12,
              }}
            >
              <View>
                <Text style={{ color: mz.text, fontWeight: "700" }}>{x.title}</Text>
                <Text style={{ color: mz.muted, fontSize: 11 }}>
                  {x.method} · {new Date(x.createdAt).toLocaleString()}
                </Text>
              </View>
              <Text style={{ color: mz.rose, fontWeight: "800" }}>{formatPkr(x.amountPkr)}</Text>
            </MzCard>
          ))
        )}
      </ScrollView>
    </MzShell>
  );
}
