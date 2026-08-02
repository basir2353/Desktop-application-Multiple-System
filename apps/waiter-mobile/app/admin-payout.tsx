import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@platform/contracts";
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
import { fetchEmployeeAdvances, fetchEmployees } from "../src/api/hr";
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
import { AdminShell } from "../src/components/AdminBottomNav";
import { formatPkr } from "../src/lib/orderSales";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

/** Same party model as POS `PosPayOutModal`. */
type PartyKind = "supplier" | "customer" | "employee" | "expense";
type PartyFilter = "all" | PartyKind;

type PayOutAccount = {
  kind: PartyKind;
  id: string;
  name: string;
  detail: string | null;
  balance: number | null;
  status: string | null;
  baseSalaryPkr?: number;
  openAdvancePkr?: number;
  expenseCategory?: ExpenseCategory;
};

const PARTY_LABEL: Record<PartyKind, string> = {
  supplier: "Supplier",
  customer: "Customer",
  employee: "Employee",
  expense: "Expense",
};

const FILTERS: { id: PartyFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "supplier", label: "Supplier" },
  { id: "customer", label: "Customer" },
  { id: "employee", label: "Employee" },
  { id: "expense", label: "Expense" },
];

function accountReasonPrefix(account: PayOutAccount): string {
  return `${PARTY_LABEL[account.kind]}: ${account.name}`;
}

/**
 * Owner Admin Pay Out — same window/flow as POS `PosPayOutModal`
 * (account picker → amount → reason → Record pay out).
 */
export default function AdminPayoutScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const branchCode = branch?.code;
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState<PartyFilter>("all");
  const [selectedAccount, setSelectedAccount] = useState<PayOutAccount | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["admin", "cash-session-open", branchCode],
    queryFn: () => fetchOpenCashSession(branchCode!),
    enabled: allowed && Boolean(branchCode),
  });

  const partiesQuery = useQuery({
    queryKey: ["admin", "payout-parties", branchCode],
    enabled: allowed && Boolean(branchCode) && accountPickerOpen,
    queryFn: async () => {
      const code = branchCode!;
      const [invoices, vendorBills, inventory, employees, advances] = await Promise.all([
        fetchCustomerInvoices(code).catch(() => []),
        fetchVendorBills(code).catch(() => []),
        fetchBranchInventory(code).catch(() => null),
        fetchEmployees(code).catch(() => []),
        fetchEmployeeAdvances(code, "open").catch(() => []),
      ]);
      return { invoices, vendorBills, inventory, employees, advances };
    },
  });

  const accounts = useMemo<PayOutAccount[]>(() => {
    const data = partiesQuery.data;
    if (!data) {
      // Expense categories do not need a network round-trip.
      if (partyFilter === "expense" || partyFilter === "all") {
        return EXPENSE_CATEGORIES.map((category) => ({
          kind: "expense" as const,
          id: `expense:${category}`,
          name: category,
          detail: "Expense category",
          balance: null,
          status: null,
          expenseCategory: category,
        })).filter((a) => {
          const q = accountSearch.trim().toLowerCase();
          if (!q) return true;
          return a.name.toLowerCase().includes(q) || "expense".includes(q);
        });
      }
      return [];
    }

    const list: PayOutAccount[] = [];

    const vendorBalance = new Map<string, { balance: number; status: string }>();
    for (const bill of data.vendorBills) {
      const existing = vendorBalance.get(bill.supplierId);
      if (existing) {
        existing.balance += bill.balance;
        if (bill.status === "open" || existing.status === "open") existing.status = "open";
        else if (bill.status === "partial" || existing.status === "partial") existing.status = "partial";
      } else {
        vendorBalance.set(bill.supplierId, { balance: bill.balance, status: bill.status });
      }
    }
    const seenSupplierIds = new Set<string>();
    for (const supplier of data.inventory?.suppliers ?? []) {
      if (!supplier.active) continue;
      seenSupplierIds.add(supplier.id);
      const bal = vendorBalance.get(supplier.id);
      list.push({
        kind: "supplier",
        id: supplier.id,
        name: supplier.name,
        detail: supplier.phone,
        balance: bal?.balance ?? supplier.openingBalancePkr ?? 0,
        status: bal?.status ?? null,
      });
    }
    for (const bill of data.vendorBills) {
      if (seenSupplierIds.has(bill.supplierId)) continue;
      seenSupplierIds.add(bill.supplierId);
      const bal = vendorBalance.get(bill.supplierId);
      list.push({
        kind: "supplier",
        id: bill.supplierId,
        name: bill.supplierName,
        detail: bill.invoiceNumber ? `Bill ${bill.invoiceNumber}` : bill.billRef,
        balance: bal?.balance ?? bill.balance,
        status: bal?.status ?? bill.status,
      });
    }

    const byCustomer = new Map<string, PayOutAccount>();
    for (const invoice of data.invoices) {
      const key = `${invoice.customerName}|${invoice.customerPhone ?? ""}`;
      const existing = byCustomer.get(key);
      if (existing) {
        existing.balance = (existing.balance ?? 0) + invoice.balance;
        if (invoice.status === "open" || existing.status === "open") existing.status = "open";
        else if (invoice.status === "partial" || existing.status === "partial") {
          existing.status = "partial";
        }
      } else {
        byCustomer.set(key, {
          kind: "customer",
          id: key,
          name: invoice.customerName,
          detail: invoice.customerPhone,
          balance: invoice.balance,
          status: invoice.status,
        });
      }
    }
    list.push(...byCustomer.values());

    const openByEmployee = new Map<string, number>();
    for (const adv of data.advances ?? []) {
      openByEmployee.set(adv.employeeId, (openByEmployee.get(adv.employeeId) ?? 0) + (adv.openAdvancePkr ?? 0));
    }
    for (const employee of data.employees) {
      if (employee.employmentStatus === "terminated") continue;
      list.push({
        kind: "employee",
        id: employee.id,
        name: employee.displayName,
        detail: [employee.jobTitle, employee.phone].filter(Boolean).join(" · ") || null,
        balance: null,
        status: employee.employmentStatus,
        baseSalaryPkr: employee.baseSalaryPkr,
        openAdvancePkr: openByEmployee.get(employee.id) ?? 0,
      });
    }

    for (const category of EXPENSE_CATEGORIES) {
      list.push({
        kind: "expense",
        id: `expense:${category}`,
        name: category,
        detail: "Expense category",
        balance: null,
        status: null,
        expenseCategory: category,
      });
    }

    list.sort((a, b) => {
      const order = { supplier: 0, customer: 1, employee: 2, expense: 3 };
      const kindOrder = order[a.kind] - order[b.kind];
      if (kindOrder !== 0) return kindOrder;
      return a.name.localeCompare(b.name);
    });

    const q = accountSearch.trim().toLowerCase();
    return list.filter((a) => {
      if (partyFilter !== "all" && a.kind !== partyFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.detail ?? "").toLowerCase().includes(q) ||
        PARTY_LABEL[a.kind].toLowerCase().includes(q)
      );
    });
  }, [partiesQuery.data, accountSearch, partyFilter]);

  function selectAccount(account: PayOutAccount): void {
    setSelectedAccount(account);
    setReason((current) => {
      const prefix = accountReasonPrefix(account);
      const trimmed = current.trim();
      if (!trimmed) return prefix;
      if (
        trimmed.startsWith("Supplier:") ||
        trimmed.startsWith("Customer:") ||
        trimmed.startsWith("Employee:") ||
        trimmed.startsWith("Expense:")
      ) {
        return prefix;
      }
      return trimmed;
    });
    setAccountPickerOpen(false);
    setAccountSearch("");
  }

  const openDrawer = useMutation({
    mutationFn: () => openCashSession({ branchCode: branchCode!, openingFloat: 0 }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "cash-session-open", branchCode] });
      setSuccess("Cash drawer opened.");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const session = sessionQuery.data;
      if (!session) throw new Error("Open cash drawer first");
      const amountPkr = Number(amount);
      if (!Number.isFinite(amountPkr) || amountPkr < 1) throw new Error("Enter a valid amount");
      const baseReason = reason.trim();
      if (!baseReason) throw new Error("Reason is required");

      const linked =
        selectedAccount && !baseReason.toLowerCase().includes(selectedAccount.name.toLowerCase())
          ? `${accountReasonPrefix(selectedAccount)} — ${baseReason}`
          : baseReason || (selectedAccount ? accountReasonPrefix(selectedAccount) : "Pay out");

      if (selectedAccount?.kind === "employee") {
        const salaryCap = Math.max(0, selectedAccount.baseSalaryPkr ?? 0);
        const alreadyOut = Math.max(0, selectedAccount.openAdvancePkr ?? 0);
        if (alreadyOut + amountPkr > salaryCap) {
          const remaining = Math.max(0, salaryCap - alreadyOut);
          throw new Error(
            `Advance cannot exceed base salary (${salaryCap.toLocaleString()} PKR). ` +
              `Already outstanding ${alreadyOut.toLocaleString()} PKR — max new advance ${remaining.toLocaleString()} PKR.`,
          );
        }
        return recordCashMovement({
          branchCode: branchCode!,
          sessionId: session.id,
          type: "paid_out",
          amountPkr,
          reason: `Employee advance: ${selectedAccount.name} — ${linked.replace(/^Employee:\s*/i, "")}`,
          partyKind: "employee",
          employeeId: selectedAccount.id,
          asAdvance: true,
        });
      }

      if (selectedAccount?.kind === "supplier") {
        return recordCashMovement({
          branchCode: branchCode!,
          sessionId: session.id,
          type: "paid_out",
          amountPkr,
          reason: linked,
          partyKind: "supplier",
          supplierId: selectedAccount.id,
        });
      }

      if (selectedAccount?.kind === "expense") {
        const category =
          selectedAccount.expenseCategory ?? (selectedAccount.name as ExpenseCategory);
        return recordCashMovement({
          branchCode: branchCode!,
          sessionId: session.id,
          type: "paid_out",
          amountPkr,
          reason: linked,
          partyKind: "expense",
          expenseCategory: category,
        });
      }

      // Customer / free-form — same as POS (cash movement only).
      return recordCashMovement({
        branchCode: branchCode!,
        sessionId: session.id,
        type: "paid_out",
        amountPkr,
        reason: linked,
        partyKind: selectedAccount?.kind === "customer" ? "customer" : undefined,
      });
    },
    onSuccess: () => {
      const amountNum = Number(amount);
      const who = selectedAccount
        ? `${PARTY_LABEL[selectedAccount.kind]} · ${selectedAccount.name}`
        : null;
      setSuccess(
        `Paid out ${amountNum.toLocaleString()} PKR${who ? ` → ${who}` : ""}${
          selectedAccount?.kind === "employee" ? " (salary advance — will deduct on payroll)" : ""
        }. Ledger updated.`,
      );
      setAmount("");
      setReason("");
      setSelectedAccount(null);
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
      <AdminShell tab="more" noPadding>
        <Screen>
          <Notice>Select a branch on the Admin Dashboard first.</Notice>
        </Screen>
      </AdminShell>
    );
  }

  const openSession = sessionQuery.data;

  return (
    <AdminShell tab="more" noPadding>
      <Screen>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 48 }}>
          <Title>Pay out</Title>
          <Subtitle>Remove cash from the drawer for expenses or vendors.</Subtitle>

          {sessionQuery.isLoading ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>Loading cash session…</Text>
          ) : !openSession ? (
            <Card style={{ gap: 10 }}>
              <Notice>No cash drawer session is open. Open the drawer first (same as POS).</Notice>
              <Button
                label="Open cash drawer"
                onPress={() => openDrawer.mutate()}
                loading={openDrawer.isPending}
              />
            </Card>
          ) : (
            <Card style={{ gap: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {openSession.sessionRef} · Expected {formatPkr(openSession.liveExpectedCash ?? 0)}
              </Text>

              {/* Account picker — same pattern as POS Pay Out */}
              <Pressable
                onPress={() => setAccountPickerOpen((open) => !open)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderWidth: 1,
                  borderColor: selectedAccount ? colors.accent : colors.border,
                  backgroundColor: selectedAccount ? "#422006" : colors.card,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: selectedAccount ? colors.accent : colors.muted,
                    fontWeight: selectedAccount ? "700" : "500",
                    fontSize: 13,
                  }}
                  numberOfLines={2}
                >
                  {selectedAccount
                    ? `${PARTY_LABEL[selectedAccount.kind]} · ${selectedAccount.name}${
                        selectedAccount.detail ? ` · ${selectedAccount.detail}` : ""
                      }`
                    : "Account (optional) — Supplier, Customer, Employee, or Expense"}
                </Text>
                <Text style={{ color: colors.muted, marginLeft: 8 }}>
                  {accountPickerOpen ? "▲" : "▼"}
                </Text>
              </Pressable>

              {selectedAccount ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {selectedAccount.balance != null
                      ? `Balance: ${formatPkr(selectedAccount.balance)}`
                      : selectedAccount.kind === "employee"
                        ? `Salary ${formatPkr(selectedAccount.baseSalaryPkr ?? 0)} · advance out ${formatPkr(selectedAccount.openAdvancePkr ?? 0)}`
                        : PARTY_LABEL[selectedAccount.kind]}
                  </Text>
                  <Pressable onPress={() => setSelectedAccount(null)}>
                    <Text style={{ color: colors.danger, fontSize: 11 }}>Clear</Text>
                  </Pressable>
                </View>
              ) : null}

              {accountPickerOpen ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    padding: 8,
                    maxHeight: 300,
                    backgroundColor: colors.bg,
                  }}
                >
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {FILTERS.map((filter) => {
                      const on = partyFilter === filter.id;
                      return (
                        <Pressable
                          key={filter.id}
                          onPress={() => setPartyFilter(filter.id)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 999,
                            backgroundColor: on ? "rgba(245,158,11,0.2)" : colors.card,
                            borderWidth: 1,
                            borderColor: on ? colors.accent : colors.border,
                          }}
                        >
                          <Text
                            style={{
                              color: on ? colors.accent : colors.muted,
                              fontSize: 10,
                              fontWeight: "700",
                            }}
                          >
                            {filter.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Input
                    placeholder="Search supplier, customer, employee, or expense…"
                    value={accountSearch}
                    onChangeText={setAccountSearch}
                  />
                  <ScrollView nestedScrollEnabled style={{ marginTop: 8, maxHeight: 200 }}>
                    {partiesQuery.isLoading && partyFilter !== "expense" ? (
                      <Text style={{ color: colors.muted, fontSize: 12, padding: 4 }}>
                        Loading accounts…
                      </Text>
                    ) : accounts.length === 0 ? (
                      <Text style={{ color: colors.muted, fontSize: 12, padding: 4 }}>
                        No {partyFilter === "all" ? "accounts" : `${partyFilter}s`} found.
                      </Text>
                    ) : (
                      accounts.map((a) => {
                        const on = selectedAccount?.id === a.id && selectedAccount.kind === a.kind;
                        return (
                          <Pressable
                            key={`${a.kind}:${a.id}`}
                            onPress={() => selectAccount(a)}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              paddingVertical: 8,
                              paddingHorizontal: 6,
                              borderRadius: 8,
                              backgroundColor: on ? "rgba(245,158,11,0.15)" : "transparent",
                              marginBottom: 2,
                            }}
                          >
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text
                                style={{
                                  color: colors.muted,
                                  fontSize: 9,
                                  fontWeight: "800",
                                  textTransform: "uppercase",
                                }}
                              >
                                {PARTY_LABEL[a.kind]}
                              </Text>
                              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                                {a.name}
                              </Text>
                              <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                                {a.detail ?? "—"}
                              </Text>
                            </View>
                            <View style={{ alignItems: "flex-end" }}>
                              {a.balance != null ? (
                                <Text
                                  style={{
                                    color: a.balance > 0 ? colors.accent : colors.success,
                                    fontWeight: "700",
                                    fontSize: 12,
                                  }}
                                >
                                  {formatPkr(a.balance)}
                                </Text>
                              ) : (
                                <Text style={{ color: colors.muted, fontSize: 10, textTransform: "capitalize" }}>
                                  {a.status ?? "—"}
                                </Text>
                              )}
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                  </ScrollView>
                </View>
              ) : null}

              <Input
                placeholder="Amount (PKR)"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <Input
                placeholder="Reason (e.g. vendor payment)"
                value={reason}
                onChangeText={setReason}
              />
              <Button
                label="Record pay out"
                onPress={() => {
                  setError(null);
                  setSuccess(null);
                  mutation.mutate();
                }}
                loading={mutation.isPending}
                disabled={!amount || !reason.trim()}
              />
            </Card>
          )}

          {success ? <Notice tone="success">{success}</Notice> : null}
          {error ? <Notice>{error}</Notice> : null}
        </ScrollView>
      </Screen>
    </AdminShell>
  );
}
