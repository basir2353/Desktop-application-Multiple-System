import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr, upsertCustomer } from "../src/mobizone/storeCore";
import { useMz, useMzLayout } from "../src/mobizone/theme";
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
  const mz = useMz();
  const { pad, gap, tileW } = useMzLayout();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "due" | "add">("all");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [address, setAddress] = useState("");

  const filtered = useMemo(() => {
    let rows = db.customers;
    if (tab === "due") rows = rows.filter((c) => (c.pendingPkr || 0) > 0);
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.phone ?? "").includes(needle) ||
        (c.cnic ?? "").includes(needle),
    );
  }, [db.customers, q, tab]);

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
    setTab("all");
    Alert.alert("Saved", "Customer added");
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}>
        <MzScreenTitle
          title="Customers"
          subtitle="Search name, phone or CNIC"
          right={
            <Pressable
              onPress={() => setTab("add")}
              style={{
                backgroundColor: mz.accent,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: mz.onAccent, fontWeight: "800", fontSize: 12 }}>+ Add</Text>
            </Pressable>
          }
        />

        {tab !== "add" ? (
          <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <MzChip label="All Customers" active={tab === "all"} onPress={() => setTab("all")} />
              <MzChip label="Outstanding" active={tab === "due"} onPress={() => setTab("due")} />
            </View>
            <MzInput
              value={q}
              onChangeText={setQ}
              placeholder="Search name, phone or CNIC"
              style={{ flex: undefined }}
            />
            {filtered.length === 0 ? (
              <MzEmpty
                title="No customers yet"
                note="CNIC / phone book yahan manage hoga"
                actionLabel="Add Customer"
                onAction={() => setTab("add")}
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
                      backgroundColor: mz.ivory,
                      borderWidth: 1,
                      borderColor: mz.accent,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 16 }}>
                      {c.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: mz.navy, fontWeight: "700" }}>{c.name}</Text>
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
            <Pressable onPress={() => setTab("all")} style={{ alignItems: "center", padding: 8 }}>
              <Text style={{ color: mz.muted, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </MzSection>
        )}
      </ScrollView>
    </MzShell>
  );
}
