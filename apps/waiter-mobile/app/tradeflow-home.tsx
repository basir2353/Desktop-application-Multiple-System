import { Redirect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fetchTfDashboard } from "../src/api/tradeflow";
import { Button, Card, Screen, Title, colors } from "../src/components/ui";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

function money(n: number): string {
  return `Rs ${n.toLocaleString()}`;
}

export default function TradeFlowHomeScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const clearBranch = useBranchStore((s) => s.clear);
  const dashboard = useQuery({
    queryKey: ["tradeflow", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchTfDashboard(branch!.code),
  });

  if (!accessToken) return <Redirect href="/" />;
  if (claims?.systemType && claims.systemType !== "tradeflow") return <Redirect href="/home" />;

  return (
    <Screen safeTop>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Title>MaterialFlow mobile</Title>
        <Text style={{ color: colors.muted }}>{branch?.name ?? "Main"} · daily entries</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Stat label="Sales" value={dashboard.data ? money(dashboard.data.todaySalesPkr) : "—"} />
          <Stat label="Expenses" value={dashboard.data ? money(dashboard.data.todayExpensesPkr) : "—"} />
          <Stat label="Profit" value={dashboard.data ? money(dashboard.data.todayProfitPkr) : "—"} />
          <Stat label="Purchases" value={dashboard.data ? money(dashboard.data.todayPurchasesPkr) : "—"} />
        </View>
        {[
          { href: "/tradeflow-entry?tab=sales", title: "Sales" },
          { href: "/tradeflow-entry?tab=purchase", title: "Purchase" },
          { href: "/tradeflow-entry?tab=payments", title: "Payments" },
          { href: "/tradeflow-entry?tab=expenses", title: "Expenses" },
          { href: "/tradeflow-entry?tab=returns", title: "Returns" },
        ].map((item) => (
          <Pressable key={item.href} onPress={() => router.push(item.href as never)}>
            <Card>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{item.title}</Text>
            </Card>
          </Pressable>
        ))}
        <Button
          label="Sign out"
          onPress={() => {
            clearSession();
            clearBranch();
            router.replace("/");
          }}
        />
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ width: "47%", backgroundColor: colors.card, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{value}</Text>
    </View>
  );
}
