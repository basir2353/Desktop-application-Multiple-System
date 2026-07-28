import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fetchTaxFeatures, updateTaxFeatures } from "../src/api/admin";
import { Card, Notice, Screen, Subtitle, Title, colors } from "../src/components/ui";
import { canTogglePra, isAdminOrIncharge } from "../src/lib/roles";
import { useSessionStore } from "../src/stores/sessionStore";

export default function AdminPraScreen() {
  const claims = useSessionStore((s) => s.claims);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const allowed = canTogglePra(claims);

  const taxQuery = useQuery({ queryKey: ["admin", "tax-features"], queryFn: fetchTaxFeatures });

  const save = useMutation({
    mutationFn: (praEnabled: boolean) => updateTaxFeatures({ praEnabled }),
    onSuccess: (data) => {
      setNotice(`PRA is now ${data.praEnabled ? "ON" : "OFF"}`);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["admin", "tax-features"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!isAdminOrIncharge(claims)) {
    return <Redirect href="/" />;
  }

  const praOn = taxQuery.data?.praEnabled ?? false;
  const fbrOn = taxQuery.data?.fbrEnabled ?? false;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 14, padding: 16, paddingBottom: 40 }}>
        <Title>PRA on / off</Title>
        <Subtitle>
          Organization tax feature flag. Only Admin / Incharge (manager) can enable or disable PRA.
          Waiter, rider, cashier, and other roles cannot change this — even if they open this screen.
        </Subtitle>

        {!allowed ? (
          <Notice>
            Your account cannot change PRA. Sign in with an Admin or Incharge account.
          </Notice>
        ) : null}

        <Card>
          <Subtitle>Current status</Subtitle>
          <Title>PRA: {praOn ? "ON" : "OFF"}</Title>
          <Subtitle>FBR: {fbrOn ? "ON" : "OFF"} (managed separately)</Subtitle>
        </Card>

        {allowed ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              disabled={save.isPending || praOn}
              onPress={() => save.mutate(true)}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: praOn ? "#14532d" : colors.accent,
                opacity: praOn ? 0.5 : 1,
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "800", color: praOn ? "#fff" : colors.accentText }}>
                Turn PRA ON
              </Text>
            </Pressable>
            <Pressable
              disabled={save.isPending || !praOn}
              onPress={() => save.mutate(false)}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: !praOn ? "#7f1d1d" : "#b91c1c",
                opacity: !praOn ? 0.5 : 1,
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "800", color: "#fff" }}>Turn PRA OFF</Text>
            </Pressable>
          </View>
        ) : null}

        {notice ? <Notice tone="success">{notice}</Notice> : null}
        {error ? <Notice>{error}</Notice> : null}
        {taxQuery.isLoading ? <Subtitle>Loading…</Subtitle> : null}
      </ScrollView>
    </Screen>
  );
}
