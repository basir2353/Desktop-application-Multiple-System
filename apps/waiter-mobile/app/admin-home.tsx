import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fetchOrgUsers, fetchSecurityOverview, fetchTaxFeatures, roleLabel } from "../src/api/admin";
import {
  ActionTile,
  Card,
  Notice,
  Screen,
  StatCard,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { canTogglePra, isAdminOrIncharge } from "../src/lib/roles";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminHomeScreen() {
  const router = useRouter();
  const claims = useSessionStore((s) => s.claims);
  const waiterEmail = useSessionStore((s) => s.waiterEmail);
  const clear = useSessionStore((s) => s.clear);
  const allowed = isAdminOrIncharge(claims);

  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: fetchOrgUsers,
    enabled: allowed,
  });
  const activityQuery = useQuery({
    queryKey: ["admin", "security"],
    queryFn: () => fetchSecurityOverview(),
    enabled: allowed,
  });
  const taxQuery = useQuery({
    queryKey: ["admin", "tax-features"],
    queryFn: fetchTaxFeatures,
    enabled: allowed,
  });

  if (!allowed) {
    return <Redirect href="/" />;
  }

  const users = usersQuery.data ?? [];
  const activeUsers = users.filter((u) => u.active).length;
  const failed = activityQuery.data?.failedLogins24h ?? 0;
  const devices = activityQuery.data?.activeDevices ?? 0;
  const policy = activityQuery.data?.policyViolations24h ?? 0;
  const trail = activityQuery.data?.auditTrail ?? [];
  const praOn = taxQuery.data?.praEnabled ?? false;
  const roleName = roleLabel(claims?.role ?? "admin");

  return (
    <Screen safeTop>
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Title>Admin Dashboard</Title>
            <Subtitle>
              {waiterEmail ?? claims?.sub ?? "Incharge"} · {roleName}
              {"\n"}
              Full dashboard · users · activity · PRA
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

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Users" value={users.length} hint={`${activeUsers} active`} />
          <StatCard label="Failed logins" value={failed} hint="Last 24h" accent={failed > 0 ? colors.danger : undefined} />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Devices" value={devices} hint="Active sessions" />
          <StatCard
            label="PRA"
            value={praOn ? "ON" : "OFF"}
            hint={canTogglePra(claims) ? "You can toggle" : "Admin/Incharge only"}
            accent={praOn ? colors.success : colors.muted}
          />
        </View>

        <Card>
          <Subtitle>Security snapshot</Subtitle>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
            Policy flags: {policy}
          </Text>
          <Subtitle>
            Recent actions logged: {trail.length}
            {"\n"}
            Live API: {getApiBaseUrl()}
          </Subtitle>
        </Card>

        <ActionTile
          icon="👥"
          title="User management & access"
          subtitle="Create users, roles, enable / disable access"
          onPress={() => router.push("/admin-users")}
        />
        <ActionTile
          icon="📋"
          title="Activity & reports"
          subtitle="Which user performed which action"
          onPress={() => router.push("/admin-activity")}
        />
        <ActionTile
          icon="🧾"
          title="PRA on / off"
          subtitle={
            canTogglePra(claims)
              ? "Enable or disable PRA for this organization"
              : "Only Admin / Incharge can change this"
          }
          onPress={() => router.push("/admin-pra")}
          variant={canTogglePra(claims) ? "primary" : "default"}
        />

        {usersQuery.isError || activityQuery.isError || taxQuery.isError ? (
          <Notice>
            {(usersQuery.error as Error)?.message ||
              (activityQuery.error as Error)?.message ||
              (taxQuery.error as Error)?.message ||
              "Could not load dashboard"}
          </Notice>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
