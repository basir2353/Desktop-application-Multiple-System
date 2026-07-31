import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PraInvoiceMode, PraReportPeriod } from "@platform/contracts";
import {
  fetchPraDashboard,
  fetchPraReports,
  fetchTaxFeaturesNormalized,
  updateTaxFeaturesNormalized,
} from "../src/api/pra";
import { AdminShell } from "../src/components/AdminBottomNav";
import {
  Card,
  Chip,
  Notice,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { formatPkr } from "../src/lib/orderSales";
import { canTogglePra, isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type TaxView = "control" | "dashboard" | "reports";

export default function AdminTaxScreen() {
  const claims = useSessionStore((s) => s.claims);
  const branch = useBranchStore((s) => s.branch);
  const branchCode = branch?.code;
  const allowed = isAdminOrIncharge(claims);
  const canToggle = canTogglePra(claims);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [view, setView] = useState<TaxView>("control");
  const [mode, setMode] = useState<PraInvoiceMode>("real");
  const [period, setPeriod] = useState<PraReportPeriod>("daily");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const featuresQuery = useQuery({
    queryKey: ["admin", "tax-features"],
    queryFn: fetchTaxFeaturesNormalized,
    enabled: allowed,
  });

  const dashQuery = useQuery({
    queryKey: ["admin", "pra-dash", branchCode, mode],
    queryFn: () => fetchPraDashboard(branchCode!, mode),
    enabled: allowed && Boolean(branchCode) && view === "dashboard",
    refetchInterval: 30_000,
  });

  const reportsQuery = useQuery({
    queryKey: ["admin", "pra-reports", branchCode, mode, period],
    queryFn: () =>
      fetchPraReports({
        branchCode: branchCode!,
        mode,
        period,
      }),
    enabled: allowed && Boolean(branchCode) && view === "reports",
  });

  const save = useMutation({
    mutationFn: updateTaxFeaturesNormalized,
    onSuccess: (data) => {
      setNotice(
        `Tax Active updated · FPRA ${data.praFakeEnabled ? "ON" : "OFF"} · Real ${
          data.praRealEnabled ? "ON" : "OFF"
        } · FBR ${data.fbrEnabled ? "ON" : "OFF"}`,
      );
      setError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "tax-features"] });
      void qc.invalidateQueries({ queryKey: ["tax-features"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const features = featuresQuery.data;
  const rangeLabel = useMemo(() => {
    const echo = reportsQuery.data?.filtersEcho;
    if (!echo) return "";
    return `${echo.from ?? ""} → ${echo.to ?? ""}`;
  }, [reportsQuery.data?.filtersEcho]);

  if (!allowed) return <Redirect href="/" />;

  return (
    <AdminShell tab="tax" noPadding>
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={
              featuresQuery.isFetching ||
              (view === "dashboard" && dashQuery.isFetching) ||
              (view === "reports" && reportsQuery.isFetching)
            }
            onRefresh={() => {
              void featuresQuery.refetch();
              if (view === "dashboard") void dashQuery.refetch();
              if (view === "reports") void reportsQuery.refetch();
            }}
            tintColor={colors.accent}
          />
        }
      >
        <Title>Tax & PRA</Title>
        <Subtitle>
          {branchCode
            ? `Control FPRA / Real PRA and review ${branchCode} activity`
            : "Select a branch on Home for dashboards"}
        </Subtitle>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(
            [
              ["control", "Setup"],
              ["dashboard", "Today"],
              ["reports", "Reports"],
            ] as const
          ).map(([id, label]) => (
            <Chip key={id} label={label} selected={view === id} onPress={() => setView(id)} />
          ))}
        </ScrollView>

        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}

        {view === "control" ? (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard
                label="FPRA"
                value={features?.praFakeEnabled ? "ON" : "OFF"}
                hint={features?.praFakeAllowed ? "Allowed" : "Not granted"}
                accent={features?.praFakeEnabled ? colors.success : colors.muted}
              />
              <StatCard
                label="Real PRA"
                value={features?.praRealEnabled ? "ON" : "OFF"}
                hint={features?.praRealAllowed ? "Allowed" : "Not granted"}
                accent={features?.praRealEnabled ? colors.success : colors.muted}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatCard
                label="FBR"
                value={features?.fbrEnabled ? "ON" : "OFF"}
                hint={features?.fbrAllowed ? "Allowed" : "Not granted"}
              />
              <StatCard
                label="PRA overall"
                value={features?.praEnabled ? "ON" : "OFF"}
                hint="FPRA or Real active"
                accent={features?.praEnabled ? colors.success : colors.muted}
              />
            </View>

            {!canToggle ? (
              <Notice>Only Admin / Incharge can change Active flags.</Notice>
            ) : (
              <Card>
                <Subtitle>Quick Active controls</Subtitle>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>
                  FPRA and Real cannot both be Active — turning one on turns the other off.
                </Text>
                <View style={{ gap: 8 }}>
                  <ToggleRow
                    label="FPRA Active"
                    on={Boolean(features?.praFakeEnabled)}
                    disabled={!features?.praFakeAllowed || save.isPending}
                    onPress={() =>
                      save.mutate({
                        praFakeEnabled: !features?.praFakeEnabled,
                        praRealEnabled: features?.praFakeEnabled ? features.praRealEnabled : false,
                      })
                    }
                  />
                  <ToggleRow
                    label="Real PRA Active"
                    on={Boolean(features?.praRealEnabled)}
                    disabled={!features?.praRealAllowed || save.isPending}
                    onPress={() =>
                      save.mutate({
                        praRealEnabled: !features?.praRealEnabled,
                        praFakeEnabled: features?.praRealEnabled ? features.praFakeEnabled : false,
                      })
                    }
                  />
                  <ToggleRow
                    label="FBR Active"
                    on={Boolean(features?.fbrEnabled)}
                    disabled={!features?.fbrAllowed || save.isPending}
                    onPress={() => save.mutate({ fbrEnabled: !features?.fbrEnabled })}
                  />
                </View>
              </Card>
            )}
            {featuresQuery.isLoading ? <ActivityIndicator color={colors.accent} /> : null}
          </>
        ) : null}

        {view === "dashboard" || view === "reports" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="Real" selected={mode === "real"} onPress={() => setMode("real")} />
            <Chip label="FPRA" selected={mode === "fake"} onPress={() => setMode("fake")} />
          </ScrollView>
        ) : null}

        {view === "dashboard" ? (
          !branchCode ? (
            <Notice>Pick a branch on Home first.</Notice>
          ) : dashQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : dashQuery.isError ? (
            <Notice>{(dashQuery.error as Error).message}</Notice>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatCard
                  label="Submitted"
                  value={dashQuery.data?.todaySubmitted ?? 0}
                  hint="Today"
                  accent={colors.success}
                />
                <StatCard
                  label="Failed"
                  value={dashQuery.data?.todayFailed ?? 0}
                  hint="Today"
                  accent={(dashQuery.data?.todayFailed ?? 0) > 0 ? colors.danger : undefined}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatCard label="Pending" value={dashQuery.data?.pendingQueue ?? 0} hint="Queue" />
                <StatCard
                  label="Connection"
                  value={(dashQuery.data?.connectionStatus ?? "—").toString()}
                  hint={dashQuery.data?.lastSyncAt ? `Sync ${new Date(dashQuery.data.lastSyncAt).toLocaleString()}` : "No sync yet"}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatCard
                  label="Taxable today"
                  value={formatPkr(dashQuery.data?.todayTaxableTotalPkr ?? 0)}
                />
                <StatCard
                  label="Tax today"
                  value={formatPkr(dashQuery.data?.todayTaxTotalPkr ?? 0)}
                  accent={colors.accent}
                />
              </View>
              {dashQuery.data?.lastError ? <Notice>{dashQuery.data.lastError}</Notice> : null}
            </>
          )
        ) : null}

        {view === "reports" ? (
          !branchCode ? (
            <Notice>Pick a branch on Home first.</Notice>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {(
                  [
                    ["daily", "Daily"],
                    ["weekly", "Weekly"],
                    ["monthly", "Monthly"],
                    ["yearly", "Yearly"],
                  ] as const
                ).map(([id, label]) => (
                  <Chip key={id} label={label} selected={period === id} onPress={() => setPeriod(id)} />
                ))}
              </ScrollView>
              {rangeLabel ? <Subtitle>{rangeLabel}</Subtitle> : null}
              {reportsQuery.isLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : reportsQuery.isError ? (
                <Notice>{(reportsQuery.error as Error).message}</Notice>
              ) : (
                <>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <StatCard
                      label="Invoices"
                      value={reportsQuery.data?.summary.invoiceCount ?? 0}
                    />
                    <StatCard
                      label="Submitted"
                      value={reportsQuery.data?.summary.submittedCount ?? 0}
                      accent={colors.success}
                    />
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <StatCard
                      label="Failed"
                      value={reportsQuery.data?.summary.failedCount ?? 0}
                      accent={colors.danger}
                    />
                    <StatCard
                      label="Tax total"
                      value={formatPkr(reportsQuery.data?.summary.taxTotalPkr ?? 0)}
                    />
                  </View>
                  <Card>
                    <Subtitle>Period buckets</Subtitle>
                    {(reportsQuery.data?.buckets ?? []).length === 0 ? (
                      <Text style={{ color: colors.muted }}>No invoices in this range.</Text>
                    ) : (
                      (reportsQuery.data?.buckets ?? []).map((b) => (
                        <View
                          key={b.key}
                          style={{
                            paddingVertical: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                            gap: 4,
                          }}
                        >
                          <Text style={{ color: colors.text, fontWeight: "700" }}>{b.key}</Text>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>
                            {b.invoiceCount} inv · {b.submittedCount} ok · {b.failedCount} fail · tax{" "}
                            {formatPkr(b.taxTotalPkr)}
                          </Text>
                        </View>
                      ))
                    )}
                  </Card>
                </>
              )}
            </>
          )
        ) : null}
      </ScrollView>
    </AdminShell>
  );
}

function ToggleRow({
  label,
  on,
  disabled,
  onPress,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: "#020617",
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "600" }}>{label}</Text>
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: on ? "rgba(34, 197, 94, 0.2)" : "rgba(148, 163, 184, 0.15)",
        }}
      >
        <Text style={{ color: on ? colors.success : colors.muted, fontWeight: "800", fontSize: 12 }}>
          {on ? "ON" : "OFF"}
        </Text>
      </View>
    </Pressable>
  );
}
