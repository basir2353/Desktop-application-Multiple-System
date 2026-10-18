import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr, upsertCustomer } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

export default function MobizoneCustomersScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"list" | "add">("list");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return db.customers;
    return db.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.phone ?? "").includes(needle) ||
        (c.cnic ?? "").includes(needle),
    );
  }, [db.customers, q]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  function onAdd(): void {
    if (!name.trim()) {
      Alert.alert("Name required");
      return;
    }
    upsertCustomer(branchCode, {
      name: name.trim(),
      phone: phone.trim() || null,
      cnic: cnic.trim() || null,
    });
    refresh();
    setName("");
    setPhone("");
    setCnic("");
    setTab("list");
    Alert.alert("Saved", "Customer added");
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <Text style={{ color: mz.gold, fontSize: 20, fontWeight: "800" }}>Customers</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(
            [
              { id: "list", label: "All Customers" },
              { id: "add", label: "Add Customer" },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: tab === t.id ? mz.gold : mz.card,
                borderWidth: 1,
                borderColor: tab === t.id ? mz.gold : mz.border,
              }}
            >
              <Text style={{ color: tab === t.id ? mz.bg : mz.text, fontWeight: "700" }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "list" ? (
          <>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search name, phone, CNIC"
              placeholderTextColor={mz.muted}
              style={inputStyle}
            />
            {filtered.length === 0 ? (
              <Text style={{ color: mz.muted }}>No customers yet</Text>
            ) : (
              filtered.map((c) => (
                <View
                  key={c.id}
                  style={{
                    backgroundColor: mz.card,
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: mz.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: mz.cardSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: mz.gold, fontWeight: "800", fontSize: 16 }}>
                      {c.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: mz.text, fontWeight: "700" }}>{c.name}</Text>
                    <Text style={{ color: mz.muted, fontSize: 12 }}>{c.phone || "No phone"}</Text>
                  </View>
                  <Text
                    style={{
                      color: (c.pendingPkr || 0) > 0 ? mz.rose : mz.teal,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {(c.pendingPkr || 0) > 0 ? formatPkr(c.pendingPkr) : "Clear"}
                  </Text>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <Field label="Name">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Customer name"
                placeholderTextColor={mz.muted}
                style={inputStyle}
              />
            </Field>
            <Field label="Phone">
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="03XXXXXXXXX"
                placeholderTextColor={mz.muted}
                style={inputStyle}
              />
            </Field>
            <Field label="CNIC">
              <TextInput
                value={cnic}
                onChangeText={setCnic}
                placeholder="XXXXX-XXXXXXX-X"
                placeholderTextColor={mz.muted}
                style={inputStyle}
              />
            </Field>
            <Pressable
              onPress={onAdd}
              style={{
                backgroundColor: mz.gold,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: mz.bg, fontWeight: "800", fontSize: 16 }}>Save Customer</Text>
            </Pressable>
          </>
        )}
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
