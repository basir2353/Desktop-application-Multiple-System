import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  fetchCustomerInvoices,
  fetchOpenCashSession,
  fetchVendorBills,
  openCashSession,
  recordCashMovement,
} from "../src/api/accounting";
import { fetchEmployees } from "../src/api/hr";
import { fetchBranchInventory } from "../src/api/inventory";
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
import { formatPkr } from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type PartyKind = "supplier" | "customer" | "employee";
type PartyFilter = "all" | PartyKind;

type PayOutParty = {
  kind: PartyKind;
  id: string;
  name: string;
  detail: string | null;
  balance: number | null;
};

const PARTY_LABEL: Record<PartyKind, string> = {
  supplier: "Supplier",
  customer: "Customer",
  employee: "Employee",
};

const FILTERS: { id: PartyFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "supplier", label: "Vendor" },
  { id: "customer", label: "Party" },
  { id: "employee", label: "Staff" },
];

/** RPF-style pay out: salary / vendor / party payment from open cash drawer. */
export default function AdminPayoutScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const branchCode = branch?.code;
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<PartyFilter>("all");
  const [selected, setSelected] = useState<PayOutParty | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["admin", "cash-session-open", branchCode],
    queryFn: () => fetchOpenCashSession(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });

  const partiesQuery = useQuery({
    queryKey: ["admin", "payout-parties", branchCode],
    queryFn: async () => {
      const code = branchCode!;
      const [invoices, vendorBills, inventory, employees] = await Promise.all([
        fetchCustomerInvoices(code).catch(() => []),
        fetchVendorBills(code).catch(() => []),
        fetchBranchInventory(code).catch(() => null),
        fetchEmployees(code).catch(() => []),
      ]);
      return { invoices, vendorBills, inventory, employees };
    },
    enabled: allowed && Boolean(branchCode),
  });

  const parties = useMemo(() => {
    const data = partiesQuery.data;
    if (!data) return [] as PayOutParty[];
    const list: PayOutParty[] = [];

    const vendorBalance = new Map<string, number>();
    for (const bill of data.vendorBills) {
      vendorBalance.set(bill.supplierId, (vendorBalance.get(bill.supplierId) ?? 0) + bill.balance);
    }
    const seenSuppliers = new Set<string>();
    for (const supplier of data.inventory?.suppliers ?? []) {
      if (!supplier.active) continue;
      seenSuppliers.add(supplier.id);
      list.push({
        kind: "supplier",
        id: supplier.id,
        name: supplier.name,
        detail: supplier.phone,
        balance: vendorBalance.get(supplier.id) ?? supplier.openingBalancePkr ?? 0,
      });
    }
    for (const bill of data.vendorBills) {
      if (seenSuppliers.has(bill.supplierId)) continue;
      seenSuppliers.add(bill.supplierId);
      list.push({
        kind: "supplier",
        id: bill.supplierId,
        name: bill.supplierName,
        detail: bill.billRef,
        balance: vendorBalance.get(bill.supplierId) ?? bill.balance,
      });
    }

    const byCustomer = new Map<string, PayOutParty>();
    for (const invoice of data.invoices) {
      const key = `${invoice.customerName}|${invoice.customerPhone ?? ""}`;
      const existing = byCustomer.get(key);
      if (existing) existing.balance = (existing.balance ?? 0) + invoice.balance;
      else {
        byCustomer.set(key, {
          kind: "customer",
          id: key,
          name: invoice.customerName,
          detail: invoice.customerPhone,
          balance: invoice.balance,
        });
      }
    }
    list.push(...byCustomer.values());

    for (const emp of data.employees) {
      if (emp.employmentStatus === "terminated") continue;
      list.push({
        kind: "employee",
        id: emp.id,
        name: emp.displayName,
        detail: [emp.jobTitle, formatPkr(emp.baseSalaryPkr)].filter(Boolean).join(" · "),
        balance: emp.baseSalaryPkr,
      });
    }

    const q = search.trim().toLowerCase();
    return list
      .filter((p) => (partyFilter === "all" ? true : p.kind === partyFilter))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.detail ?? "").toLowerCase().includes(q) ||
          PARTY_LABEL[p.kind].toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [partiesQuery.data, search, partyFilter]);

  const openDrawer = useMutation({
    mutationFn: () => openCashSession({ branchCode: branchCode!, openingFloat: 0 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "cash-session-open", branchCode] });
      setSuccess("Cash drawer opened.");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const payOut = useMutation({
    mutationFn: async () => {
      const session = sessionQuery.data;
      if (!session) throw new Error("Open cash drawer first");
      const amountPkr = Math.round(Number(amount));
      if (!Number.isFinite(amountPkr) || amountPkr < 1) throw new Error("Enter a valid amount");
      if (!selected) throw new Error("Select who to pay");
      const base = reason.trim() || `${PARTY_LABEL[selected.kind]}: ${selected.name}`;
      const isEmployee = selected.kind === "employee";
      return recordCashMovement({
        branchCode: branchCode!,
        sessionId: session.id,
        type: "paid_out",
        amountPkr,
        reason: isEmployee
          ? `Employee advance: ${selected.name} — ${base}`
          : `${PARTY_LABEL[selected.kind]}: ${selected.name} — ${base}`,
        partyKind: selected.kind,
        employeeId: isEmployee ? selected.id : undefined,
        asAdvance: isEmployee,
      });
    },
    onSuccess: () => {
      const amt = formatPkr(Math.round(Number(amount)));
      setSuccess(`Paid out ${amt} to ${selected?.name ?? "party"}.`);
      setAmount("");
      setReason("");
      setSelected(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      void sessionQuery.refetch();
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess(null);
    },
  });

  if (!allowed) return <Redirect href="/" />;
  if (!branchCode) {
    return (
      <Screen>
        <Notice>Select a branch on the Admin Dashboard first.</Notice>
      </Screen>
    );
  }

  const session = sessionQuery.data;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 48 }}>
        <Title>Payout</Title>
        <Subtitle>
          Like RPF — pay salary, vendor, or party from the cash drawer.
          {"\n"}
          {branch?.name ?? branchCode} · {branchCode}
        </Subtitle>

        {!session && !sessionQuery.isLoading ? (
          <Card style={{ gap: 10 }}>
            <Notice>No cash drawer session is open.</Notice>
            <Button
              label="Open cash drawer"
              onPress={() => openDrawer.mutate()}
              loading={openDrawer.isPending}
            />
          </Card>
        ) : (
          <Card>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Open session</Text>
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {session?.sessionRef ?? "…"} · Expected {formatPkr(session?.liveExpectedCash ?? 0)}
            </Text>
          </Card>
        )}

        <Card style={{ gap: 10 }}>
          <Subtitle>Pay to</Subtitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FILTERS.map((f) => {
              const on = partyFilter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setPartyFilter(f.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: on ? colors.accent : colors.border,
                    backgroundColor: on ? colors.accent : "transparent",
                  }}
                >
                  <Text style={{ color: on ? colors.accentText : colors.text, fontWeight: "700", fontSize: 12 }}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Input
            placeholder="Search vendor, party, or staff…"
            value={search}
            onChangeText={setSearch}
          />
          {selected ? (
            <View
              style={{
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.accent,
                backgroundColor: "#422006",
                gap: 4,
              }}
            >
              <Text style={{ color: colors.accent, fontWeight: "800" }}>
                {PARTY_LABEL[selected.kind]} · {selected.name}
              </Text>
              {selected.detail ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>{selected.detail}</Text>
              ) : null}
              {selected.balance != null ? (
                <Text style={{ color: colors.text, fontSize: 12 }}>Balance {formatPkr(selected.balance)}</Text>
              ) : null}
              <Pressable onPress={() => setSelected(null)}>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Clear selection</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={{ maxHeight: 260 }}>
            <ScrollView nestedScrollEnabled>
              {partiesQuery.isLoading ? (
                <Text style={{ color: colors.muted }}>Loading parties…</Text>
              ) : parties.length === 0 ? (
                <Text style={{ color: colors.muted }}>No matches.</Text>
              ) : (
                parties.slice(0, 40).map((p) => {
                  const on = selected?.id === p.id && selected.kind === p.kind;
                  return (
                    <Pressable
                      key={`${p.kind}-${p.id}`}
                      onPress={() => {
                        setSelected(p);
                        setReason(`${PARTY_LABEL[p.kind]}: ${p.name}`);
                      }}
                      style={{
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        backgroundColor: on ? "#334155" : "transparent",
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{p.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {PARTY_LABEL[p.kind]}
                        {p.detail ? ` · ${p.detail}` : ""}
                        {p.balance != null ? ` · ${formatPkr(p.balance)}` : ""}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Card>

        <Card style={{ gap: 10 }}>
          <Subtitle>Amount & note</Subtitle>
          <Input
            placeholder="Amount (PKR)"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <Input placeholder="Reason / note" value={reason} onChangeText={setReason} />
          <Button
            label="Pay out"
            onPress={() => payOut.mutate()}
            loading={payOut.isPending}
            disabled={!session || !selected}
          />
        </Card>

        {success ? <Notice tone="success">{success}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}
      </ScrollView>
    </Screen>
  );
}
