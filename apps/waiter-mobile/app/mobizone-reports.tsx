import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  formatPkr,
  getBusinessReport,
  monthStartDateInput,
  todayDateInput,
} from "../src/mobizone/storeCore";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import { MzCard, MzDateRangeChips, MzScreenTitle, MzSection } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

export default function MobizoneReportsScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap, tileW } = useMzLayout();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode } = useMobizoneDb();
  const [from, setFrom] = useState(monthStartDateInput);
  const [to, setTo] = useState(todayDateInput);

  const report = useMemo(
    () => getBusinessReport(branchCode, from || "1970-01-01", to || todayDateInput()),
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}>
        <MzScreenTitle title="Reports" subtitle="Profit & Loss · dues · cash/bank" />

        <MzSection title="Date filter">
          <MzDateRangeChips
            fromDate={from}
            toDate={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
            }}
          />
        </MzSection>

        <MzCard style={{ backgroundColor: mz.navyDeep, borderColor: mz.accent }}>
          <Text
            style={{
              color: "rgba(233,238,243,0.7)",
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 0.6,
            }}
          >
            NET PROFIT
          </Text>
          <Text style={{ color: mz.accent, fontSize: 30, fontWeight: "800", marginTop: 6 }}>
            {formatPkr(report.profitPkr)}
          </Text>
          <Text style={{ color: "rgba(233,238,243,0.65)", marginTop: 4, fontSize: 12 }}>
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
  const mz = useMz();
  const { tileW } = useMzLayout();
  return (
    <View
      style={{
        width: tileW,
        backgroundColor: mz.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: mz.border,
      }}
    >
      <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "600" }}>{label}</Text>
      <Text style={{ color: tone, fontSize: 14, fontWeight: "800", marginTop: 4 }}>{value}</Text>
    </View>
  );
}
