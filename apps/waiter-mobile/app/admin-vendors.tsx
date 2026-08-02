import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { createSupplier, fetchBranchInventory } from "../src/api/inventory";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Button,
  Card,
  Input,
  Notice,
  Screen,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

/** Add / list vendors (suppliers) from Admin mobile. */
export default function AdminVendorsScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const branchCode = branch?.code;
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branchCode],
    queryFn: () => fetchBranchInventory(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createSupplier({
        branchCode: branchCode!,
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      }),
    onSuccess: (row) => {
      setSuccess(`Vendor “${row.name}” saved.`);
      setError(null);
      setName("");
      setPhone("");
      setAddress("");
      void queryClient.invalidateQueries({ queryKey: ["inventory", branchCode] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "payable", branchCode] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "payout-parties", branchCode] });
    },
    onError: (e: Error) => {
      setError(e.message);
      setSuccess(null);
    },
  });

  if (!allowed) return <Redirect href="/" />;
  if (!branchCode) {
    return (
      <AdminShell tab="more" noPadding>
        <Screen>
          <Notice>Select a branch on the Admin Dashboard first.</Notice>
        </Screen>
      </AdminShell>
    );
  }

  const suppliers = inventoryQuery.data?.suppliers ?? [];

  return (
    <AdminShell tab="more" noPadding>
      <Screen>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 48 }}>
          <Title>Vendors</Title>
          <Subtitle>
            Supplier entries · pay via Ledgers / Pay Out
            {"\n"}
            {branch?.name ?? branchCode} · {branchCode}
          </Subtitle>

          {error ? <Notice>{error}</Notice> : null}
          {success ? <Notice tone="success">{success}</Notice> : null}

          <Card style={{ gap: 10 }}>
            <Subtitle>Add vendor</Subtitle>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Name</Text>
            <Input value={name} onChangeText={setName} placeholder="Supplier name" />
            <Text style={{ color: colors.muted, fontSize: 12 }}>Phone</Text>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="03…"
              keyboardType="phone-pad"
            />
            <Text style={{ color: colors.muted, fontSize: 12 }}>Address</Text>
            <Input value={address} onChangeText={setAddress} placeholder="Optional" />
            <Button
              label={createMut.isPending ? "Saving…" : "Save vendor"}
              onPress={() => {
                if (!name.trim()) {
                  setError("Vendor name is required");
                  return;
                }
                createMut.mutate();
              }}
              loading={createMut.isPending}
              disabled={createMut.isPending || !name.trim()}
            />
          </Card>

          <Card style={{ gap: 8 }}>
            <Subtitle>Vendors ({suppliers.length})</Subtitle>
            {suppliers.length === 0 ? (
              <Text style={{ color: colors.muted }}>No vendors yet.</Text>
            ) : (
              suppliers.map((s) => (
                <View
                  key={s.id}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{s.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {[s.phone, s.address].filter(Boolean).join(" · ") || "No contact"}
                    {s.active === false ? " · inactive" : ""}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      </Screen>
    </AdminShell>
  );
}
