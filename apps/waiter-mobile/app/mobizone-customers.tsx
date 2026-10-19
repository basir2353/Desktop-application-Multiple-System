import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr, upsertCustomer } from "../src/mobizone/storeCore";
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

export default function MobizoneCustomersScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"list" | "add">("list");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [address, setAddress] = useState("");

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
      address: address.trim() || null,
    });
    refresh();
    setName("");
    setPhone("");
    setCnic("");
    setAddress("");
    setTab("list");
    Alert.alert("Saved", "Customer added");
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle title="Customers" subtitle="Search by Name · Phone · CNIC" />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <MzChip label="All Customers" active={tab === "list"} onPress={() => setTab("list")} />
          <MzChip label="Add Customer" active={tab === "add"} onPress={() => setTab("add")} />
        </View>

        {tab === "list" ? (
          <>
            <MzInput
              value={q}
              onChangeText={setQ}
              placeholder="Search name, phone, CNIC"
              style={{ flex: undefined }}
            />
            {filtered.length === 0 ? (
              <MzEmpty
                title="No customers yet"
                note="Add Customer dabao — CNIC / phone book yahan manage hoga"
              />
            ) : (
              filtered.map((c) => (
                <MzCard
                  key={c.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: mz.navyDeep,
                      borderWidth: 1,
                      borderColor: mz.goldDim,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: mz.goldBright, fontWeight: "800", fontSize: 16 }}>
                      {c.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: mz.text, fontWeight: "700" }}>{c.name}</Text>
                    <Text style={{ color: mz.muted, fontSize: 12, marginTop: 2 }}>
                      {c.phone || "No phone"}
                      {c.cnic ? ` · ${c.cnic}` : ""}
                    </Text>
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
                </MzCard>
              ))
            )}
            {filtered.length > 0 ? (
              <Pressable onPress={() => setTab("add")}>
                <Text style={{ color: mz.goldBright, textAlign: "center", fontWeight: "700" }}>
                  + Add Customer
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <MzSection title="New customer">
            <MzField label="Name *">
              <MzInput value={name} onChangeText={setName} placeholder="Customer name" />
            </MzField>
            <MzField label="Phone">
              <MzInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="03XXXXXXXXX"
              />
            </MzField>
            <MzField label="CNIC">
              <MzInput value={cnic} onChangeText={setCnic} placeholder="XXXXX-XXXXXXX-X" />
            </MzField>
            <MzField label="Address">
              <MzInput value={address} onChangeText={setAddress} placeholder="Address" />
            </MzField>
            <MzPrimaryButton label="Save Customer" onPress={onAdd} />
          </MzSection>
        )}
      </ScrollView>
    </MzShell>
  );
}
