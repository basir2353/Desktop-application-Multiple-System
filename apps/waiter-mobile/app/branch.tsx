import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { fetchPopsBranches } from "../src/api/operations";
import { Card, Label, Muted, Screen, Subtitle, Title, colors } from "../src/components/ui";
import { homeRouteForRole, resolveStaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function BranchScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const setBranch = useBranchStore((s) => s.setBranch);
  const clearBranch = useBranchStore((s) => s.clear);

  const role = resolveStaffRole(claims);
  const homeRoute = homeRouteForRole(role);

  const branchesQuery = useQuery({
    queryKey: ["branches"],
    enabled: Boolean(accessToken),
    queryFn: fetchPopsBranches,
  });

  const visibleBranches = useMemo(() => {
    const all = branchesQuery.data ?? [];
    const scope = claims?.branchScope;
    if (!scope || scope === "all") return all;
    return all.filter((b) => b.code === scope);
  }, [branchesQuery.data, claims?.branchScope]);

  useEffect(() => {
    if (role !== "rider" || branch || branchesQuery.isLoading) return;
    const scope = claims?.branchScope;
    const match =
      scope && scope !== "all"
        ? branchesQuery.data?.find((b) => b.code === scope)
        : visibleBranches[0];
    if (match) {
      setBranch(match);
      router.replace(homeRoute);
    }
  }, [
    role,
    branch,
    branchesQuery.isLoading,
    branchesQuery.data,
    claims?.branchScope,
    visibleBranches,
    setBranch,
    router,
    homeRoute,
  ]);

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  if (branch) {
    return <Redirect href={homeRoute} />;
  }

  return (
    <Screen>
      <View>
        <Title>Select branch</Title>
        <Subtitle>
          {role === "rider"
            ? "Choose the branch you are delivering for today."
            : "Choose the restaurant branch you are serving today."}
        </Subtitle>
      </View>

      <Card>
        <Label>Branches</Label>
        {branchesQuery.isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : branchesQuery.isError ? (
          <Muted>{(branchesQuery.error as Error).message}</Muted>
        ) : visibleBranches.length === 0 ? (
          <Muted>No branches found. Create one in the desktop app first.</Muted>
        ) : (
          visibleBranches.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => {
                setBranch(b);
                router.replace(homeRoute);
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

      <Pressable
        onPress={() => {
          clearSession();
          clearBranch();
          router.replace("/");
        }}
      >
        <Text style={{ color: colors.muted, textAlign: "center", fontSize: 13 }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}
