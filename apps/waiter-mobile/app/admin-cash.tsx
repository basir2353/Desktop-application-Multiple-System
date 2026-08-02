import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  closeCashSession,
  fetchCashMovements,
  fetchOpenCashSession,
  openCashSession,
  recordCashMovement,
} from "../src/api/accounting";
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

type Mode = "overview" | "cashier-in" | "pay-in" | "cashier-out";

/**
 * Cash drawer for Admin APK — Cashier In / Pay In / Cashier Out + movements.
 * Pay Out stays on its dedicated screen (party picker).
 */
export default function AdminCashScreen() {
  const router = useRouter();
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const allowed = isAdminOrIncharge(claims);
  const branchCode = branch?.code;
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>("overview");
  const [floatAmount, setFloatAmount] = useState("0");
  const [payInAmount, setPayInAmount] = useState("");
  const [payInReason, setPayInReason] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["admin", "cash-session-open", branchCode],
    queryFn: () => fetchOpenCashSession(branchCode!),
    enabled: allowed && Boolean(branchCode),
    refetchInterval: 15_000,
  });

  const session = sessionQuery.data;
  const sessionId = session?.id ?? null;

  const movementsQuery = useQuery({
    queryKey: ["admin", "cash-movements", sessionId],
    queryFn: () => fetchCashMovements(sessionId!),
    enabled: allowed && Boolean(sessionId),
  });

  const invalidateCash = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "cash-session-open", branchCode] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "cash-movements"] });
  };

  const openMut = useMutation({
    mutationFn: () =>
      openCashSession({
        branchCode: branchCode!,
        openingFloat: Math.max(0, Number(floatAmount) || 0),
      }),
    onSuccess: () => {
      setSuccess("Cashier In complete — drawer open.");
      setError(null);
      setMode("overview");
      invalidateCash();
    },
    onError: (e: Error) => {
      setError(e.message);
      setSuccess(null);
    },
  });

  const payInMut = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("Open Cashier In first");
      const amount = Number(payInAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
      return recordCashMovement({
        branchCode: branchCode!,
        sessionId,
        type: "paid_in",
        amountPkr: Math.round(amount),
        reason: payInReason.trim() || "Pay in",
        recordedBy: claims?.email ?? claims?.sub ?? "admin",
      });
    },
    onSuccess: () => {
      setSuccess("Pay In recorded.");
      setError(null);
      setPayInAmount("");
      setPayInReason("");
      setMode("overview");
      invalidateCash();
    },
    onError: (e: Error) => {
      setError(e.message);
      setSuccess(null);
    },
  });

  const closeMut = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No open session");
      const counted = Number(countedCash);
      if (!Number.isFinite(counted) || counted < 0) throw new Error("Enter counted cash");
      return closeCashSession(sessionId, {
        countedCash: Math.round(counted),
        notes: closeNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      setSuccess("Cashier Out complete — drawer closed.");
      setError(null);
      setCountedCash("");
      setCloseNotes("");
      setMode("overview");
      invalidateCash();
    },
    onError: (e: Error) => {
      setError(e.message);
      setSuccess(null);
    },
  });

  const movements = useMemo(() => {
    const list = movementsQuery.data ?? [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [movementsQuery.data]);

  const payInTotal = movements
    .filter((m) => m.type === "paid_in")
    .reduce((s, m) => s + m.amountPkr, 0);
  const payOutTotal = movements
    .filter((m) => m.type === "paid_out")
    .reduce((s, m) => s + m.amountPkr, 0);

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

  return (
    <AdminShell tab="more" noPadding>
      <Screen>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 48 }}>
          <Title>Cash drawer</Title>
          <Subtitle>
            Cashier In · Pay In · Pay Out · Cashier Out
            {"\n"}
            {branch?.name ?? branchCode} · {branchCode}
          </Subtitle>

          {error ? <Notice>{error}</Notice> : null}
          {success ? <Notice tone="success">{success}</Notice> : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <StatCard
              label="Drawer"
              value={session ? "Open" : "Closed"}
              hint={session ? `Session ${session.id.slice(0, 8)}…` : "Cashier In to start"}
              accent={session ? colors.success : colors.muted}
            />
            <StatCard
              label="Expected"
              value={formatPkr(session?.liveExpectedCash ?? 0)}
              hint={`In ${formatPkr(payInTotal)} · Out ${formatPkr(payOutTotal)}`}
            />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                { id: "overview" as const, label: "Overview" },
                { id: "cashier-in" as const, label: "Cashier In" },
                { id: "pay-in" as const, label: "Pay In" },
                { id: "cashier-out" as const, label: "Cashier Out" },
              ] as const
            ).map((t) => {
              const on = mode === t.id;
              const disabled =
                (t.id === "pay-in" || t.id === "cashier-out") && !session
                  ? true
                  : t.id === "cashier-in" && Boolean(session);
              return (
                <Pressable
                  key={t.id}
                  disabled={disabled}
                  onPress={() => {
                    setMode(t.id);
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
                    opacity: disabled ? 0.4 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: on ? colors.accentText : colors.text,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label="Paying Out (parties)"
            onPress={() => router.push("/admin-payout")}
            variant="ghost"
          />

          {mode === "cashier-in" ? (
            <Card style={{ gap: 10 }}>
              <Subtitle>Cashier In — open drawer</Subtitle>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Opening float (Rs)</Text>
              <Input
                keyboardType="numeric"
                value={floatAmount}
                onChangeText={setFloatAmount}
                placeholder="0"
              />
              <Button
                label={openMut.isPending ? "Opening…" : "Open Cashier In"}
                onPress={() => openMut.mutate()}
                loading={openMut.isPending}
                disabled={openMut.isPending || Boolean(session)}
              />
            </Card>
          ) : null}

          {mode === "pay-in" ? (
            <Card style={{ gap: 10 }}>
              <Subtitle>Pay In — cash into drawer</Subtitle>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Amount (Rs)</Text>
              <Input
                keyboardType="numeric"
                value={payInAmount}
                onChangeText={setPayInAmount}
                placeholder="0"
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>Reason</Text>
              <Input
                value={payInReason}
                onChangeText={setPayInReason}
                placeholder="e.g. Owner float top-up"
              />
              <Button
                label={payInMut.isPending ? "Saving…" : "Record Pay In"}
                onPress={() => payInMut.mutate()}
                loading={payInMut.isPending}
                disabled={payInMut.isPending || !session}
              />
            </Card>
          ) : null}

          {mode === "cashier-out" ? (
            <Card style={{ gap: 10 }}>
              <Subtitle>Cashier Out — close drawer</Subtitle>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Expected in drawer: {formatPkr(session?.liveExpectedCash ?? 0)}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Counted cash (Rs)</Text>
              <Input
                keyboardType="numeric"
                value={countedCash}
                onChangeText={setCountedCash}
                placeholder={String(session?.liveExpectedCash ?? 0)}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>Notes (optional)</Text>
              <Input
                value={closeNotes}
                onChangeText={setCloseNotes}
                placeholder="Variance reason…"
              />
              <Button
                label={closeMut.isPending ? "Closing…" : "Close Cashier Out"}
                onPress={() => closeMut.mutate()}
                loading={closeMut.isPending}
                disabled={closeMut.isPending || !session}
              />
            </Card>
          ) : null}

          <Card style={{ gap: 8 }}>
            <Subtitle>Today’s movements</Subtitle>
            {!session ? (
              <Text style={{ color: colors.muted }}>No open session — Cashier In first.</Text>
            ) : movements.length === 0 ? (
              <Text style={{ color: colors.muted }}>No pay in / pay out yet this session.</Text>
            ) : (
              movements.map((m) => (
                <View
                  key={m.id}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                      {m.type === "paid_in" ? "Pay In" : "Pay Out"}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={2}>
                      {m.reason}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: m.type === "paid_in" ? colors.success : colors.warning,
                      fontWeight: "800",
                    }}
                  >
                    {m.type === "paid_in" ? "+" : "−"}
                    {formatPkr(m.amountPkr)}
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
