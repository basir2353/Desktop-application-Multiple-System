import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { fetchSecurityOverview } from "../src/api/admin";
import { Card, Chip, Input, Screen, Subtitle, Title, colors } from "../src/components/ui";
import { AdminShell } from "../src/components/AdminBottomNav";
import { isAdminOrIncharge } from "../src/lib/roles";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminActivityScreen() {
  const claims = useSessionStore((s) => s.claims);
  const [filter, setFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);

  const activityQuery = useQuery({
    queryKey: ["admin", "security"],
    queryFn: () => fetchSecurityOverview(),
    enabled: isAdminOrIncharge(claims),
  });

  const trail = activityQuery.data?.auditTrail ?? [];

  const modules = useMemo(() => {
    const set = new Set<string>();
    for (const row of trail) {
      if (row.module) set.add(row.module);
    }
    return Array.from(set).sort();
  }, [trail]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return trail.filter((row) => {
      if (moduleFilter && row.module !== moduleFilter) return false;
      if (!q) return true;
      return (
        row.user.toLowerCase().includes(q) ||
        row.action.toLowerCase().includes(q) ||
        row.detail.toLowerCase().includes(q) ||
        row.module.toLowerCase().includes(q)
      );
    });
  }, [trail, filter, moduleFilter]);

  if (!isAdminOrIncharge(claims)) {
    return <Redirect href="/" />;
  }

  return (
    <AdminShell tab="more" noPadding>
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 40 }}>
        <Title>Activity & reports</Title>
        <Subtitle>
          See which user performed which report or action (logins, inventory, accounting, security).
        </Subtitle>

        <Card>
          <Subtitle>
            Failed logins (24h): {activityQuery.data?.failedLogins24h ?? "—"}
            {"\n"}
            Active devices: {activityQuery.data?.activeDevices ?? "—"}
            {"\n"}
            Policy flags (24h): {activityQuery.data?.policyViolations24h ?? "—"}
          </Subtitle>
        </Card>

        <Input
          placeholder="Filter by user, action, or detail…"
          value={filter}
          onChangeText={setFilter}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {modules.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip
              label="All modules"
              selected={!moduleFilter}
              onPress={() => setModuleFilter(null)}
            />
            {modules.map((m) => (
              <Chip
                key={m}
                label={m}
                selected={moduleFilter === m}
                onPress={() => setModuleFilter(m)}
              />
            ))}
          </View>
        ) : null}

        {activityQuery.isLoading ? <Subtitle>Loading activity…</Subtitle> : null}
        {filtered.length === 0 && !activityQuery.isLoading ? (
          <Subtitle>No matching activity recorded yet.</Subtitle>
        ) : null}

        {filtered.slice(0, 120).map((row) => (
          <Card key={row.id}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{row.action}</Text>
              <Subtitle>
                User: {row.user}
                {"\n"}
                Module: {row.module} · {row.severity}
                {"\n"}
                {row.time}
                {row.detail ? `\n${row.detail}` : ""}
              </Subtitle>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
    </AdminShell>
  );
}
