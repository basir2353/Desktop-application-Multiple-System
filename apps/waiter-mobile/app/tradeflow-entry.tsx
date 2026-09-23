import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  createTfExpense,
  createTfInvoice,
  createTfPayment,
  createTfPurchase,
  createTfReturn,
  fetchTfCustomers,
  fetchTfItems,
  fetchTfSuppliers,
} from "../src/api/tradeflow";
import { Button, Input, Notice, Screen, Title, colors } from "../src/components/ui";
import { useBranchStore } from "../src/stores/branchStore";

const TABS = ["sales", "purchase", "payments", "expenses", "returns"] as const;

export default function TradeFlowEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = (TABS.includes(params.tab as (typeof TABS)[number]) ? params.tab : "sales") as (typeof TABS)[number];
  const branch = useBranchStore((s) => s.branch);
  const [customerId, setCustomerId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("Expense");
  const [notice, setNotice] = useState<string | null>(null);
  const customers = useQuery({ queryKey: ["tf", "c", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTfCustomers(branch!.code) });
  const suppliers = useQuery({ queryKey: ["tf", "s", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTfSuppliers(branch!.code) });
  const items = useQuery({ queryKey: ["tf", "i", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchTfItems(branch!.code) });
  const item = (items.data ?? []).find((i) => i.id === itemId);

  const save = useMutation({
    mutationFn: async () => {
      if (tab === "sales") {
        return createTfInvoice({
          branchCode: branch!.code,
          customerId: customerId || null,
          receiveNow: Boolean(Number(amount)),
          receivedPkr: Number(amount || 0),
          lines: [{ itemId, qty: Number(qty), ratePkr: Number(rate || item?.defaultRatePkr || 0) }],
        });
      }
      if (tab === "purchase") {
        return createTfPurchase({
          branchCode: branch!.code,
          supplierId,
          paidPkr: Number(amount || 0),
          lines: [{ itemId, qty: Number(qty), ratePkr: Number(rate || item?.defaultRatePkr || 0) }],
        });
      }
      if (tab === "payments") {
        return createTfPayment({
          branchCode: branch!.code,
          partyType: customerId ? "customer" : "supplier",
          partyId: customerId || supplierId,
          kind: customerId ? "receive" : "pay",
          amountPkr: Number(amount),
        });
      }
      if (tab === "expenses") {
        return createTfExpense({ branchCode: branch!.code, label, amountPkr: Number(amount) });
      }
      return createTfReturn({
        branchCode: branch!.code,
        kind: customerId ? "sales" : "purchase",
        partyType: customerId ? "customer" : "supplier",
        partyId: customerId || supplierId,
        itemId: itemId || undefined,
        qty: Number(qty || 0),
        amountPkr: Number(amount),
      });
    },
    onSuccess: () => setNotice(`${tab} saved`),
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <Title>MaterialFlow {tab}</Title>
        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {save.error ? <Notice>{save.error instanceof Error ? save.error.message : "Failed"}</Notice> : null}
        {tab !== "expenses" && tab !== "purchase" ? (
          <ChipRow
            label="Customer"
            options={(customers.data ?? []).filter((c) => !c.isCash).map((c) => ({ id: c.id, name: c.name }))}
            value={customerId}
            onChange={setCustomerId}
          />
        ) : null}
        {tab === "purchase" || tab === "payments" || tab === "returns" ? (
          <ChipRow
            label="Supplier"
            options={(suppliers.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
            value={supplierId}
            onChange={setSupplierId}
          />
        ) : null}
        {tab === "sales" || tab === "purchase" || tab === "returns" ? (
          <>
            <ChipRow
              label="Item"
              options={(items.data ?? []).map((i) => ({ id: i.id, name: `${i.name} (${i.onHandQty} ${i.unit})` }))}
              value={itemId}
              onChange={(id) => {
                setItemId(id);
                const next = (items.data ?? []).find((i) => i.id === id);
                if (next) setRate(String(next.defaultRatePkr));
              }}
            />
            <Input placeholder="Qty" value={qty} onChangeText={setQty} keyboardType="numeric" />
            {tab !== "returns" ? <Input placeholder="Rate" value={rate} onChangeText={setRate} keyboardType="numeric" /> : null}
          </>
        ) : null}
        {tab === "expenses" ? <Input placeholder="Label" value={label} onChangeText={setLabel} /> : null}
        <Input placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <Button label={`Save ${tab}`} onPress={() => save.mutate()} />
        <Button label="Back" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id === value ? "" : opt.id)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: opt.id === value ? colors.accent : colors.card,
            }}
          >
            <Text style={{ color: opt.id === value ? colors.accentText : colors.text }}>{opt.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
