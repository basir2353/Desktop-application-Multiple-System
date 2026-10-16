import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchTaxSettings, updateTaxSettings } from "../src/api/accounting";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Button,
  Card,
  Input,
  Notice,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import {
  normalizePosTaxSettings,
  posTaxSettingsFromApi,
  type PosTaxSettings,
} from "../src/lib/posTaxSettings";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type ToggleKey = keyof Pick<
  PosTaxSettings,
  | "taxEnabled"
  | "taxByPaymentMethod"
  | "autoDiscountEnabled"
  | "serviceOnDineIn"
  | "serviceOnTakeaway"
  | "serviceOnDelivery"
  | "taxOnDineIn"
  | "taxOnTakeaway"
  | "taxOnDelivery"
>;

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>{label}</Text>
        {hint ? <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: "rgba(15, 118, 110, 0.55)" }}
        thumbColor={value ? colors.accentSoft : colors.muted}
      />
    </View>
  );
}

export default function AdminSettingsScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code;
  const allowed = isAdminOrIncharge(claims);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PosTaxSettings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const taxQuery = useQuery({
    queryKey: ["admin", "pos-settings", branchCode],
    queryFn: () => fetchTaxSettings(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });

  useEffect(() => {
    if (!taxQuery.data) return;
    setDraft(posTaxSettingsFromApi(taxQuery.data));
  }, [taxQuery.data]);

  const save = useMutation({
    mutationFn: async (next: PosTaxSettings) => {
      if (!branchCode) throw new Error("Select a branch first");
      const normalized = normalizePosTaxSettings(next);
      return updateTaxSettings({
        branchCode,
        serviceTaxPct: normalized.servicePct,
        salesTaxPct: normalized.taxByPaymentMethod ? normalized.cashTaxPct : normalized.taxPct,
        posCharges: {
          servicePct: normalized.servicePct,
          taxPct: normalized.taxPct,
          taxByPaymentMethod: normalized.taxByPaymentMethod,
          cashTaxPct: normalized.cashTaxPct,
          cardTaxPct: normalized.cardTaxPct,
          onlineTaxPct: normalized.onlineTaxPct,
          taxEnabled: normalized.taxEnabled,
          autoDiscountEnabled: normalized.autoDiscountEnabled,
          autoDiscountPct: normalized.autoDiscountPct,
          serviceOnDineIn: normalized.serviceOnDineIn,
          serviceOnTakeaway: normalized.serviceOnTakeaway,
          serviceOnDelivery: normalized.serviceOnDelivery,
          serviceOnOnline: normalized.serviceOnOnline,
          serviceOnFoodpanda: normalized.serviceOnFoodpanda,
          serviceOnStaffFood: normalized.serviceOnStaffFood,
          taxOnDineIn: normalized.taxOnDineIn,
          taxOnTakeaway: normalized.taxOnTakeaway,
          taxOnDelivery: normalized.taxOnDelivery,
          taxOnOnline: normalized.taxOnOnline,
          taxOnFoodpanda: normalized.taxOnFoodpanda,
          taxOnStaffFood: normalized.taxOnStaffFood,
        },
      });
    },
    onSuccess: (data) => {
      setDraft(posTaxSettingsFromApi(data));
      setNotice("POS settings saved — desktop & mobile will use these rates.");
      setError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "pos-settings", branchCode] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!allowed) return <Redirect href="/" />;

  function setToggle(key: ToggleKey, value: boolean): void {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function setNumber(key: keyof PosTaxSettings, raw: string): void {
    const n = Number(raw);
    setDraft((prev) =>
      prev ? { ...prev, [key]: Number.isFinite(n) ? n : 0 } : prev,
    );
  }

  return (
    <AdminShell tab="more" noPadding>
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 28,
        }}
        refreshControl={
          <RefreshControl
            refreshing={taxQuery.isFetching}
            onRefresh={() => void taxQuery.refetch()}
            tintColor={colors.accent}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <Title>POS control</Title>
        <Subtitle>
          {branchCode
            ? `Discount · tax · service · order notes for ${branchCode} (syncs to desktop)`
            : "Pick a branch on Home first"}
        </Subtitle>
        <Notice tone="success">
          Admin can control charges here. Menu add/delete is under Menu. Tables add/delete under
          More → Tables. Users under More → Users.
        </Notice>

        {!branchCode ? <Notice>Select a branch on Home first.</Notice> : null}
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        {taxQuery.isLoading || !draft ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <Card>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15, marginBottom: 4 }}>
                Charges
              </Text>
              <ToggleRow
                label="Tax on invoices"
                hint="Master tax switch for new tickets"
                value={draft.taxEnabled}
                onChange={(v) => setToggle("taxEnabled", v)}
              />
              <ToggleRow
                label="Tax by payment method"
                hint="Different % for cash / card / online"
                value={draft.taxByPaymentMethod}
                onChange={(v) => setToggle("taxByPaymentMethod", v)}
              />
              <ToggleRow
                label="Auto discount on every sale"
                hint="Applies to discountable items only"
                value={draft.autoDiscountEnabled}
                onChange={(v) => setToggle("autoDiscountEnabled", v)}
              />
              <View style={{ gap: 8, marginTop: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Service %</Text>
                <Input
                  keyboardType="numeric"
                  value={String(draft.servicePct)}
                  onChangeText={(t) => setNumber("servicePct", t)}
                />
                <Text style={{ color: colors.muted, fontSize: 12 }}>Auto discount %</Text>
                <Input
                  keyboardType="numeric"
                  value={String(draft.autoDiscountPct)}
                  onChangeText={(t) => setNumber("autoDiscountPct", t)}
                  editable={draft.autoDiscountEnabled}
                />
                {draft.taxByPaymentMethod ? (
                  <>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Cash tax %</Text>
                    <Input
                      keyboardType="numeric"
                      value={String(draft.cashTaxPct)}
                      onChangeText={(t) => setNumber("cashTaxPct", t)}
                      editable={draft.taxEnabled}
                    />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Card tax %</Text>
                    <Input
                      keyboardType="numeric"
                      value={String(draft.cardTaxPct)}
                      onChangeText={(t) => setNumber("cardTaxPct", t)}
                      editable={draft.taxEnabled}
                    />
                  </>
                ) : (
                  <>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Tax %</Text>
                    <Input
                      keyboardType="numeric"
                      value={String(draft.taxPct)}
                      onChangeText={(t) => setNumber("taxPct", t)}
                      editable={draft.taxEnabled}
                    />
                  </>
                )}
              </View>
            </Card>

            <Card>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15, marginBottom: 4 }}>
                By order type
              </Text>
              {(
                [
                  ["serviceOnDineIn", "Service on Dine-in"],
                  ["serviceOnTakeaway", "Service on Takeaway"],
                  ["serviceOnDelivery", "Service on Delivery"],
                  ["taxOnDineIn", "Tax on Dine-in"],
                  ["taxOnTakeaway", "Tax on Takeaway"],
                  ["taxOnDelivery", "Tax on Delivery"],
                ] as const
              ).map(([key, label]) => (
                <ToggleRow
                  key={key}
                  label={label}
                  value={Boolean(draft[key])}
                  onChange={(v) => setToggle(key, v)}
                />
              ))}
            </Card>

            <Button
              label={save.isPending ? "Saving…" : "Save POS settings"}
              onPress={() => {
                if (!draft) return;
                setNotice(null);
                save.mutate(draft);
              }}
              loading={save.isPending}
              disabled={!branchCode || save.isPending}
            />
            <Pressable
              onPress={() => {
                if (taxQuery.data) setDraft(posTaxSettingsFromApi(taxQuery.data));
              }}
            >
              <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12 }}>
                Reset unsaved changes
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </AdminShell>
  );
}
