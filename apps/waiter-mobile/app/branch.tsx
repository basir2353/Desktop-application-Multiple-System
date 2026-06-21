import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { fetchPopsBranches } from "../src/api/operations";
import { Card, Label, Muted, Screen, Subtitle, Title, colors } from "../src/components/ui";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function BranchScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const setBranch = useBranchStore((s) => s.setBranch);

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    enabled: Boolean(accessToken),
    queryFn: fetchPopsBranches,
  });

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (branch) {
    return <Redirect href="/home" />;
  }

  return (
    <Screen>
      <View>
        <Title>Select branch</Title>
        <Subtitle>Choose the restaurant branch you are serving today.</Subtitle>
      </View>

      <Card>
        <Label>Branches</Label>
        {branchesQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : branchesQuery.isError ? (
          <Muted>{(branchesQuery.error as Error).message}</Muted>
        ) : branchesQuery.data?.length === 0 ? (
          <Muted>No branches found. Create one in the desktop app first.</Muted>
        ) : (
          branchesQuery.data?.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => {
                setBranch(b);
                router.replace("/home");
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#334155" : "#020617",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
              })}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{b.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{b.code}</Text>
            </Pressable>
          ))
        )}
      </Card>

      <Pressable onPress={() => clearSession()}>
        <Text style={{ color: colors.muted, textAlign: "center", fontSize: 13 }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}
