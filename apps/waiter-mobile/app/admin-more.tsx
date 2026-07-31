import { Redirect, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdminShell } from "../src/components/AdminBottomNav";
import { ActionTile, Card, Subtitle, Title, colors } from "../src/components/ui";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminMoreScreen() {
  const router = useRouter();
  const claims = useSessionStore((s) => s.claims);
  const clear = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const insets = useSafeAreaInsets();

  if (!isAdminOrIncharge(claims)) {
    return <Redirect href="/" />;
  }

  return (
    <AdminShell tab="more" noPadding>
      <ScrollView
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: insets.top + 12,
          paddingBottom: 28,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Title>More</Title>
            <Subtitle>
              Full admin tools{branch?.code ? ` · ${branch.code}` : ""}
            </Subtitle>
          </View>
          <Pressable
            onPress={() => {
              clear();
              router.replace("/");
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12 }}>Sign out</Text>
          </Pressable>
        </View>

        <Subtitle>Money</Subtitle>
        <ActionTile
          icon="💰"
          title="Sales"
          subtitle="Date filter · channels · top items"
          onPress={() => router.push("/admin-sales")}
          variant="primary"
        />
        <ActionTile
          icon="📊"
          title="Reports"
          subtitle="Charges · discount · party · salary · expense"
          onPress={() => router.push("/admin-reports")}
          variant="primary"
        />
        <ActionTile
          icon="💸"
          title="Payout"
          subtitle="Salary, vendor & party pay out"
          onPress={() => router.push("/admin-payout")}
          variant="primary"
        />

        <Subtitle>Floor & stock</Subtitle>
        <ActionTile
          icon="🪑"
          title="Tables"
          subtitle="Floor status · occupied / free"
          onPress={() => router.push("/admin-tables")}
        />
        <ActionTile
          icon="👨‍🍳"
          title="Kitchen"
          subtitle="Advance tickets · clear queue"
          onPress={() => router.push("/admin-kitchen")}
        />
        <ActionTile
          icon="📦"
          title="Inventory"
          subtitle="Stock levels · low / out alerts"
          onPress={() => router.push("/admin-inventory")}
        />

        <Subtitle>People & security</Subtitle>
        <ActionTile
          icon="👥"
          title="Users & access"
          subtitle="Create users, roles, enable / disable"
          onPress={() => router.push("/admin-users")}
        />
        <ActionTile
          icon="📋"
          title="Activity"
          subtitle="Audit trail · failed logins"
          onPress={() => router.push("/admin-activity")}
        />

        <Subtitle>Devices</Subtitle>
        <ActionTile
          icon="🖨️"
          title="Printers"
          subtitle="Branch print settings"
          onPress={() => router.push("/printers")}
        />

        <Card>
          <Subtitle>API</Subtitle>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{getApiBaseUrl()}</Text>
        </Card>
      </ScrollView>
    </AdminShell>
  );
}
