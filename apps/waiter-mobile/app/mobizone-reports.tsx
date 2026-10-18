import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr, getBusinessReport } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
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
        <Text style={{ color: mz.gold, fontSize: 20, fontWeight: "800" }}>Business Report</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: mz.muted, fontSize: 11, marginBottom: 4 }}>From</Text>
            <TextInput
              value={from}
              onChangeText={setFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={mz.muted}
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: mz.muted, fontSize: 11, marginBottom: 4 }}>To</Text>
            <TextInput
              value={to}
              onChangeText={setTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={mz.muted}
              style={inputStyle}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Mini label="Purchase" value={formatPkr(report.purchaseAmountPkr)} tone={mz.rose} />
          <Mini label="Sales" value={formatPkr(report.saleAmountPkr)} tone={mz.teal} />
          <Mini label="Profit" value={formatPkr(report.profitPkr)} tone={mz.gold} />
          <Mini label="Profit %" value={`${profitPct}%`} tone={mz.blue} />
        </View>

        {[
          { label: "Cash Balance", value: formatPkr(report.cashBalancePkr), tone: mz.teal },
          { label: "Bank Balance", value: formatPkr(report.bankBalancePkr), tone: mz.blue },
          { label: "Total Due (Receive)", value: formatPkr(report.receivablesPkr), tone: mz.orange },
          { label: "Total Due (Pay)", value: formatPkr(report.payablesPkr), tone: mz.rose },
          { label: "Sale Count", value: String(report.saleCount), tone: mz.text },
          { label: "Purchase Count", value: String(report.purchaseCount), tone: mz.text },
        ].map((row) => (
          <View
            key={row.label}
            style={{
              backgroundColor: mz.card,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: mz.border,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: mz.muted }}>{row.label}</Text>
            <Text style={{ color: row.tone, fontWeight: "800" }}>{row.value}</Text>
          </View>
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
        width: "47%",
        backgroundColor: mz.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: mz.border,
      }}
    >
      <Text style={{ color: mz.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: tone, fontWeight: "800", fontSize: 16, marginTop: 6 }}>{value}</Text>
    </View>
  );
}

const inputStyle = {
  backgroundColor: mz.card,
  borderWidth: 1,
  borderColor: mz.border,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: mz.text,
  fontSize: 15,
} as const;
