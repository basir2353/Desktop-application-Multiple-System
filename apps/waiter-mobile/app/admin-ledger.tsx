import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  createCustomerInvoice,
  fetchCustomerInvoices,
  fetchVendorBills,
  payCustomerInvoice,
  payVendorBill,
} from "../src/api/accounting";
import { fetchOrders } from "../src/api/billing";
import { fetchEmployeeAdvances, fetchEmployees } from "../src/api/hr";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Button,
  Card,
  Input,
  Notice,
  Screen,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { formatPkr } from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type LedgerTab = "supplier" | "customer" | "employee";

const TABS: { id: LedgerTab; label: string }[] = [
  { id: "supplier", label: "Supplier" },
  { id: "customer", label: "Customer" },
  { id: "employee", label: "Employee" },
];

type LedgerRow = {
  id: string;
  name: string;
  detail: string | null;
  debit: number;
  credit: number;
  balance: number;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Owner ledger: Supplier AP, Customer AR, Employee — with pay / receive updates. */
export default function AdminLedgerScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const branchCode = branch?.code;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<LedgerTab>("supplier");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payTargetId, setPayTargetId] = useState<string | null>(null);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAmount, setNewCustAmount] = useState("");
  const [newCustNote, setNewCustNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const vendorsQuery = useQuery({
    queryKey: ["admin", "payable", branchCode],
    queryFn: () => fetchVendorBills(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "supplier",
  });
  const customersQuery = useQuery({
    queryKey: ["admin", "receivable", branchCode],
    queryFn: () => fetchCustomerInvoices(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "customer",
  });
  const employeesQuery = useQuery({
    queryKey: ["admin", "employees", branchCode],
    queryFn: () => fetchEmployees(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "employee",
  });
  const advancesQuery = useQuery({
    queryKey: ["admin", "advances", branchCode],
    queryFn: () => fetchEmployeeAdvances(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "employee",
  });
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", branchCode],
    queryFn: () => fetchOrders(branchCode!),
    enabled: allowed && Boolean(branchCode) && tab === "employee",
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "payable", branchCode] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "receivable", branchCode] });
  };

  const payVendorMut = useMutation({
    mutationFn: () => {
      if (!payTargetId) throw new Error("Select a bill");
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      return payVendorBill(payTargetId, {
        amount: Math.round(amount),
        paymentDate: todayYmd(),
        method: "cash",
      });
    },
    onSuccess: () => {
      setSuccess("Vendor payment recorded.");
      setError(null);
      setPayAmount("");
      setPayTargetId(null);
      invalidate();
    },
    onError: (e: Error) => {
      setError(e.message);
      setSuccess(null);
    },
  });

  const payCustomerMut = useMutation({
    mutationFn: () => {
      if (!payTargetId) throw new Error("Select an invoice");
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      return payCustomerInvoice(payTargetId, {
        amount: Math.round(amount),
        paymentDate: todayYmd(),
        method: "cash",
      });
    },
    onSuccess: () => {
      setSuccess("Customer payment received.");
      setError(null);
      setPayAmount("");
      setPayTargetId(null);
      invalidate();
    },
    onError: (e: Error) => {
      setError(e.message);
      setSuccess(null);
    },
  });

  const createInvoiceMut = useMutation({
    mutationFn: () => {
      const amount = Number(newCustAmount);
      if (!newCustName.trim()) throw new Error("Customer name required");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter invoice amount");
      return createCustomerInvoice({
        branchCode: branchCode!,
        customerName: newCustName.trim(),
        customerPhone: newCustPhone.trim() || undefined,
        amount: Math.round(amount),
        description: newCustNote.trim() || undefined,
      });
    },
    onSuccess: () => {
      setSuccess("Customer invoice created.");
      setError(null);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustAmount("");
      setNewCustNote("");
      invalidate();
    },
    onError: (e: Error) => {
      setError(e.message);
      setSuccess(null);
    },
  });

  const rows = useMemo((): LedgerRow[] => {
    if (tab === "supplier") {
      const map = new Map<string, LedgerRow>();
      for (const bill of vendorsQuery.data ?? []) {
        const cur = map.get(bill.supplierId) ?? {
          id: bill.supplierId,
          name: bill.supplierName,
          detail: null,
          debit: 0,
          credit: 0,
          balance: 0,
        };
        cur.debit += bill.amount;
        cur.credit += bill.paid;
        cur.balance += bill.balance;
        map.set(bill.supplierId, cur);
      }
      return [...map.values()].sort((a, b) => b.balance - a.balance);
    }
    if (tab === "customer") {
      const map = new Map<string, LedgerRow>();
      for (const inv of customersQuery.data ?? []) {
        const key = `${inv.customerName}|${inv.customerPhone ?? ""}`;
        const cur = map.get(key) ?? {
          id: key,
          name: inv.customerName,
          detail: inv.customerPhone,
          debit: 0,
          credit: 0,
          balance: 0,
        };
        cur.debit += inv.amount;
        cur.credit += inv.paid;
        cur.balance += inv.balance;
        map.set(key, cur);
      }
      return [...map.values()].sort((a, b) => b.balance - a.balance);
    }
    const advById = new Map((advancesQuery.data ?? []).map((a) => [a.employeeId, a]));
    return (employeesQuery.data ?? [])
      .filter((e) => e.employmentStatus !== "terminated")
      .map((e) => {
        const openAdv = advById.get(e.id)?.openAdvancePkr ?? 0;
        return {
          id: e.id,
          name: e.displayName,
          detail: e.jobTitle,
          debit: e.baseSalaryPkr,
          credit: openAdv,
          balance: Math.max(0, e.baseSalaryPkr - openAdv),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    tab,
    vendorsQuery.data,
    customersQuery.data,
    employeesQuery.data,
    advancesQuery.data,
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.detail ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  const openBills = useMemo(() => {
    if (!selected || tab !== "supplier") return [];
    return (vendorsQuery.data ?? []).filter(
      (b) => b.supplierId === selected.id && b.balance > 0,
    );
  }, [selected, tab, vendorsQuery.data]);

  const openInvoices = useMemo(() => {
    if (!selected || tab !== "customer") return [];
    return (customersQuery.data ?? []).filter(
      (inv) =>
        `${inv.customerName}|${inv.customerPhone ?? ""}` === selected.id && inv.balance > 0,
    );
  }, [selected, tab, customersQuery.data]);

  const detailLines = useMemo(() => {
    if (!selected) return [] as { label: string; debit: number; credit: number; meta: string }[];
    if (tab === "supplier") {
      return (vendorsQuery.data ?? [])
        .filter((b) => b.supplierId === selected.id)
        .map((b) => ({
          label: b.billRef,
          debit: b.amount,
          credit: b.paid,
          meta: `${b.status} · bal ${formatPkr(b.balance)}`,
        }));
    }
    if (tab === "customer") {
      return (customersQuery.data ?? [])
        .filter((inv) => `${inv.customerName}|${inv.customerPhone ?? ""}` === selected.id)
        .map((inv) => ({
          label: inv.invoiceRef,
          debit: inv.amount,
          credit: inv.paid,
          meta: `${inv.status} · bal ${formatPkr(inv.balance)}`,
        }));
    }
    const waiterSales = (ordersQuery.data ?? [])
      .filter(
        (o) =>
          (o.status === "completed" || o.status === "held") &&
          (o.waiterName ?? "").trim().toLowerCase() === selected.name.trim().toLowerCase(),
      )
      .reduce((s, o) => s + o.total, 0);
    return [
      {
        label: "Base salary",
        debit: selected.debit,
        credit: 0,
        meta: "Monthly",
      },
      {
        label: "Open advances",
        debit: 0,
        credit: selected.credit,
        meta: "Salary remaining after advances",
      },
      {
        label: "POS sales (waiter)",
        debit: waiterSales,
        credit: 0,
        meta: "Completed / held bills",
      },
    ];
  }, [selected, tab, vendorsQuery.data, customersQuery.data, ordersQuery.data]);

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

  const totalBalance = filtered.reduce((s, r) => s + r.balance, 0);

  return (
    <AdminShell tab="more" noPadding>
      <Screen>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 48 }}>
          <Title>Ledgers</Title>
          <Subtitle>
            Supplier · Customer · Employee — view & update
            {"\n"}
            {branch?.name ?? branchCode} · {branchCode}
          </Subtitle>

          {error ? <Notice>{error}</Notice> : null}
          {success ? <Notice tone="success">{success}</Notice> : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setTab(t.id);
                    setSelectedId(null);
                    setSearch("");
                    setPayTargetId(null);
                    setPayAmount("");
                    setError(null);
                    setSuccess(null);
                  }}
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
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <StatCard
              label={tab === "employee" ? "Salary remaining" : "Outstanding"}
              value={formatPkr(totalBalance)}
              hint={`${filtered.length} parties`}
            />
          </View>

          {tab === "customer" ? (
            <Card style={{ gap: 10 }}>
              <Subtitle>New customer invoice</Subtitle>
              <Input placeholder="Customer name" value={newCustName} onChangeText={setNewCustName} />
              <Input
                placeholder="Phone (optional)"
                value={newCustPhone}
                onChangeText={setNewCustPhone}
                keyboardType="phone-pad"
              />
              <Input
                placeholder="Amount (Rs)"
                value={newCustAmount}
                onChangeText={setNewCustAmount}
                keyboardType="numeric"
              />
              <Input
                placeholder="Note (optional)"
                value={newCustNote}
                onChangeText={setNewCustNote}
              />
              <Button
                label={createInvoiceMut.isPending ? "Saving…" : "Create invoice"}
                onPress={() => createInvoiceMut.mutate()}
                loading={createInvoiceMut.isPending}
                disabled={createInvoiceMut.isPending}
              />
            </Card>
          ) : null}

          <Input
            placeholder={`Search ${tab}…`}
            value={search}
            onChangeText={setSearch}
          />

          <Card style={{ gap: 0 }}>
            <Subtitle>
              {tab === "supplier" ? "Supplier ledger" : tab === "customer" ? "Customer ledger" : "Employee ledger"}
            </Subtitle>
            {filtered.length === 0 ? (
              <Text style={{ color: colors.muted, marginTop: 8 }}>No ledger rows.</Text>
            ) : (
              filtered.map((r) => {
                const on = selectedId === r.id;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => {
                      setSelectedId(on ? null : r.id);
                      setPayTargetId(null);
                      setPayAmount("");
                    }}
                    style={{
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: on ? colors.card : "transparent",
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{r.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          Dr {formatPkr(r.debit)} · Cr {formatPkr(r.credit)}
                          {r.detail ? ` · ${r.detail}` : ""}
                        </Text>
                      </View>
                      <Text style={{ color: colors.accent, fontWeight: "800" }}>{formatPkr(r.balance)}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </Card>

          {selected ? (
            <Card style={{ gap: 8 }}>
              <Subtitle>{selected.name} — detail</Subtitle>
              {detailLines.map((line) => (
                <View
                  key={`${line.label}-${line.meta}`}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{line.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{line.meta}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 12 }}>
                    {line.debit > 0 ? `+${formatPkr(line.debit)}` : `−${formatPkr(line.credit)}`}
                  </Text>
                </View>
              ))}

              {tab === "supplier" && openBills.length > 0 ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <Subtitle>Pay vendor bill</Subtitle>
                  {openBills.map((b) => {
                    const on = payTargetId === b.id;
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => {
                          setPayTargetId(b.id);
                          setPayAmount(String(b.balance));
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: on ? colors.accent : colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                          {b.billRef} · bal {formatPkr(b.balance)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Input
                    placeholder="Pay amount (Rs)"
                    keyboardType="numeric"
                    value={payAmount}
                    onChangeText={setPayAmount}
                  />
                  <Button
                    label={payVendorMut.isPending ? "Paying…" : "Record vendor payment"}
                    onPress={() => payVendorMut.mutate()}
                    loading={payVendorMut.isPending}
                    disabled={!payTargetId || payVendorMut.isPending}
                  />
                </View>
              ) : null}

              {tab === "customer" && openInvoices.length > 0 ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <Subtitle>Receive customer payment</Subtitle>
                  {openInvoices.map((inv) => {
                    const on = payTargetId === inv.id;
                    return (
                      <Pressable
                        key={inv.id}
                        onPress={() => {
                          setPayTargetId(inv.id);
                          setPayAmount(String(inv.balance));
                        }}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: on ? colors.accent : colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                          {inv.invoiceRef} · bal {formatPkr(inv.balance)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Input
                    placeholder="Receive amount (Rs)"
                    keyboardType="numeric"
                    value={payAmount}
                    onChangeText={setPayAmount}
                  />
                  <Button
                    label={payCustomerMut.isPending ? "Saving…" : "Record customer payment"}
                    onPress={() => payCustomerMut.mutate()}
                    loading={payCustomerMut.isPending}
                    disabled={!payTargetId || payCustomerMut.isPending}
                  />
                </View>
              ) : null}

              {tab === "employee" ? (
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  Employee pay-outs / advances: use Pay Out screen.
                </Text>
              ) : null}
            </Card>
          ) : null}
        </ScrollView>
      </Screen>
    </AdminShell>
  );
}
