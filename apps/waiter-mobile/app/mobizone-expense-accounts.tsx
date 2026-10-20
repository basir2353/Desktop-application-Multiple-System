import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  formatPkr,
  seedExpenseAccounts,
  upsertExpenseAccount,
} from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import {
  MzCard,
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

export default function MobizoneExpenseAccountsScreen(): React.JSX.Element {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh, ready } = useMobizoneDb();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !branchCode) return;
    seedExpenseAccounts(branchCode);
    refresh();
  }, [ready, branchCode, refresh]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  const accounts = db.expenseAccounts ?? [];
  const expenses = db.expenses ?? [];

  function spendFor(accountId: string, accountName: string): number {
    return expenses
      .filter(
        (x) =>
          x.accountId === accountId || x.title.toLowerCase() === accountName.toLowerCase(),
      )
      .reduce((a, x) => a + x.amountPkr, 0);
  }

  function onSave(): void {
    if (!ready) return;
    try {
      upsertExpenseAccount(branchCode, {
        id: editId ?? undefined,
        name,
        notes: notes || null,
      });
      refresh();
      Alert.alert("Saved", editId ? "Account updated." : "Expense account created.");
      setName("");
      setNotes("");
      setEditId(null);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle
          title="Account Expense"
          subtitle="Create categories: Rent, Electricity, Food, Salary…"
        />
        {!ready ? <ActivityIndicator color={mz.accent} /> : null}
        <Pressable onPress={() => router.push("/mobizone-expenses" as never)}>
          <Text style={{ color: mz.accent, fontWeight: "700", fontSize: 13 }}>
            Go to Create Expense ›
          </Text>
        </Pressable>

        <MzSection title={editId ? "Edit account" : "New expense account"}>
          <MzField label="Account name *">
            <MzInput value={name} onChangeText={setName} placeholder="e.g. Rent" />
          </MzField>
          <MzField label="Notes">
            <MzInput value={notes} onChangeText={setNotes} placeholder="Optional" />
          </MzField>
          <MzPrimaryButton label={editId ? "Update account" : "Save account"} onPress={onSave} />
          {editId ? (
            <Pressable
              onPress={() => {
                setEditId(null);
                setName("");
                setNotes("");
              }}
            >
              <Text style={{ color: mz.muted, textAlign: "center", fontWeight: "600" }}>
                Cancel edit
              </Text>
            </Pressable>
          ) : null}
        </MzSection>

        {accounts.length === 0 ? (
          <MzEmpty title="No expense accounts yet" />
        ) : (
          accounts.map((a) => (
            <MzCard
              key={a.id}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: mz.text, fontWeight: "700" }}>{a.name}</Text>
                <Text style={{ color: mz.muted, fontSize: 11, marginTop: 2 }}>
                  Total spent: {formatPkr(spendFor(a.id, a.name))}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setEditId(a.id);
                  setName(a.name);
                  setNotes(a.notes ?? "");
                }}
              >
                <Text style={{ color: mz.accent, fontWeight: "800" }}>Edit</Text>
              </Pressable>
            </MzCard>
          ))
        )}
      </ScrollView>
    </MzShell>
  );
}
