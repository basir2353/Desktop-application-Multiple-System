import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  filterByDateRange,
  formatPkr,
  monthStartDateInput,
  recordExpense,
  seedExpenseAccounts,
  todayDateInput,
} from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import {
  MzCard,
  MzChip,
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

export default function MobizoneExpensesScreen(): React.JSX.Element {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh, ready } = useMobizoneDb();
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank">("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [note, setNote] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [fromDate, setFromDate] = useState(monthStartDateInput);
  const [toDate, setToDate] = useState(todayDateInput);

  useEffect(() => {
    if (!ready || !branchCode) return;
    seedExpenseAccounts(branchCode);
    refresh();
  }, [ready, branchCode, refresh]);

  const accounts = db.expenseAccounts ?? [];
  const filtered = useMemo(() => {
    let rows = filterByDateRange(db.expenses ?? [], fromDate || null, toDate || null);
    if (filterAccountId) {
      const name = (accounts.find((a) => a.id === filterAccountId)?.name ?? "").toLowerCase();
      rows = rows.filter(
        (x) => x.accountId === filterAccountId || x.title.toLowerCase() === name,
      );
    }
    return rows;
  }, [db.expenses, filterAccountId, accounts, fromDate, toDate]);
  const total = filtered.reduce((a, x) => a + x.amountPkr, 0);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  function onSave(): void {
    if (!ready) {
      Alert.alert("Please wait", "Data is still loading.");
      return;
    }
    if (!accountId) {
      Alert.alert("Expense account", "Select an expense account first.");
      return;
    }
    if (!(Number(amount) > 0)) {
      Alert.alert("Amount", "Enter a valid amount.");
      return;
    }
    const resolvedBankId =
      bankAccountId ||
      (method === "bank" && db.bankAccounts.length === 1 ? db.bankAccounts[0]!.id : "");
    if (method === "bank" && !resolvedBankId) {
      Alert.alert("Bank account", "Select the bank account money was paid from.");
      return;
    }
    try {
      recordExpense(branchCode, {
        accountId,
        amountPkr: Number(amount),
        method,
        bankAccountId: method === "bank" ? resolvedBankId || null : null,
        note: note.trim() || null,
      });
      refresh();
      Alert.alert("Saved", "Expense saved.");
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
          title="Create Expense"
          subtitle="Select account (Rent, Electricity…) — account name is the title"
        />
        {!ready ? <ActivityIndicator color={mz.accent} /> : null}

        <Pressable onPress={() => router.push("/mobizone-expense-accounts" as never)}>
          <Text style={{ color: mz.accent, fontWeight: "700", fontSize: 13 }}>
            Manage Account Expense ›
          </Text>
        </Pressable>

        <MzCard style={{ backgroundColor: mz.ink, borderColor: mz.accent }}>
          <Text style={{ color: "rgba(233,238,243,0.7)", fontSize: 11, fontWeight: "700" }}>
            FILTERED TOTAL
          </Text>
          <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 24, marginTop: 4 }}>
            {formatPkr(total)}
          </Text>
        </MzCard>

        <MzSection title="New expense">
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>Expense account *</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAccountId(a.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: accountId === a.id ? mz.accent : mz.cardSoft,
                  borderWidth: 1,
                  borderColor: accountId === a.id ? mz.accent : mz.border,
                }}
              >
                <Text
                  style={{
                    color: accountId === a.id ? mz.onGold : mz.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <MzField label="Amount (PKR) *">
            <MzInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
          </MzField>
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>Payment mode *</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <MzChip
              label="Cash"
              active={method === "cash"}
              onPress={() => {
                setMethod("cash");
                setBankAccountId("");
              }}
            />
            <MzChip label="Bank" active={method === "bank"} onPress={() => setMethod("bank")} />
          </View>
          {method === "bank" ? (
            <MzField label="Payment account *">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {db.bankAccounts.map((a) => (
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
                ))}
              </View>
            </MzField>
          ) : null}
          <MzField label="Note">
            <MzInput value={note} onChangeText={setNote} placeholder="Optional" />
          </MzField>
          <MzPrimaryButton label="Save expense" onPress={onSave} />
        </MzSection>

        <MzSection title="Expense history">
          <MzDateRangeChips
            fromDate={fromDate}
            toDate={toDate}
            onChange={(from, to) => {
              setFromDate(from);
              setToDate(to);
            }}
          />
          <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>Filter by account</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              onPress={() => setFilterAccountId("")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: !filterAccountId ? mz.ink : mz.cardSoft,
              }}
            >
              <Text style={{ color: !filterAccountId ? mz.white : mz.text, fontWeight: "700", fontSize: 12 }}>
                All
              </Text>
            </Pressable>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setFilterAccountId(a.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: filterAccountId === a.id ? mz.ink : mz.cardSoft,
                }}
              >
                <Text
                  style={{
                    color: filterAccountId === a.id ? mz.white : mz.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {a.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </MzSection>

        {filtered.length === 0 ? (
          <MzEmpty title="No expenses in this range" />
        ) : (
          filtered.map((x) => (
            <MzCard
              key={x.id}
              style={{ flexDirection: "row", justifyContent: "space-between", padding: 12 }}
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
