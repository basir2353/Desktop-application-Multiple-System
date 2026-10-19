import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr, getBusinessReport } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import { MzCard, MzField, MzInput, MzScreenTitle } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

export default function MobizoneReportsScreen(): React.JSX.Element {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode } = useMobizoneDb();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const report = useMemo(
    () => getBusinessReport(branchCode, from, to),
    [branchCode, from, to],
  );
  const profitPct =
    report.saleAmountPkr > 0
      ? Math.round((report.profitPkr / report.saleAmountPkr) * 1000) / 10
      : 0;

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle title="Reports" subtitle="Profit & Loss · dues · cash/bank" />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <MzField label="From">
              <MzInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
            </MzField>
          </View>
          <View style={{ flex: 1 }}>
            <MzField label="To">
              <MzInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
            </MzField>
          </View>
        </View>

        <MzCard style={{ backgroundColor: mz.navyDeep, borderColor: mz.goldDim }}>
          <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>
            NET PROFIT
          </Text>
          <Text style={{ color: mz.goldBright, fontSize: 30, fontWeight: "800", marginTop: 6 }}>
            {formatPkr(report.profitPkr)}
          </Text>
          <Text style={{ color: mz.muted, marginTop: 4, fontSize: 12 }}>
            Margin {profitPct}% · expenses already deducted
          </Text>
        </MzCard>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Mini label="Purchase" value={formatPkr(report.purchaseAmountPkr)} tone={mz.rose} />
          <Mini label="Sales" value={formatPkr(report.saleAmountPkr)} tone={mz.teal} />
          <Mini label="Gross profit" value={formatPkr(report.grossProfitPkr)} tone={mz.blue} />
          <Mini label="Expenses" value={formatPkr(report.expenseTotalPkr)} tone={mz.rose} />
        </View>

        {[
          { label: "Stock value (maal)", value: formatPkr(report.stockValuePkr), tone: mz.gold },
          { label: "Cash Balance", value: formatPkr(report.cashBalancePkr), tone: mz.teal },
          { label: "Bank Balance", value: formatPkr(report.bankBalancePkr), tone: mz.blue },
          { label: "To receive", value: formatPkr(report.receivablesPkr), tone: mz.orange },
          { label: "To pay", value: formatPkr(report.payablesPkr), tone: mz.rose },
          { label: "Sale Count", value: String(report.saleCount), tone: mz.text },
          { label: "Purchase Count", value: String(report.purchaseCount), tone: mz.text },
        ].map((row) => (
          <MzCard
            key={row.label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 14,
            }}
          >
            <Text style={{ color: mz.muted, fontWeight: "600" }}>{row.label}</Text>
            <Text style={{ color: row.tone, fontWeight: "800" }}>{row.value}</Text>
          </MzCard>
        ))}
      </ScrollView>
    </MzShell>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}): React.JSX.Element {
  return (
    <View
      style={{
        width: "47.5%",
        backgroundColor: mz.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: mz.border,
      }}
    >
      <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: tone, fontSize: 15, fontWeight: "800", marginTop: 6 }}>{value}</Text>
    </View>
  );
}
