import { AuthClient } from "@platform/auth-client";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Button, Card, Input, Notice, Screen, Subtitle, Title, colors } from "../src/components/ui";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { decodeAccessToken } from "../src/lib/jwt";
import { homeRouteForRole, resolveStaffRole, type StaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const ROLE_DEFAULTS: Record<StaffRole, { email: string; title: string; subtitle: string }> = {
  waiter: {
    email: "waiter1@platform.local",
    title: "Waiter",
    subtitle: "Sign in to take table orders. Orders sync to the desktop POS in real time.",
  },
  rider: {
    email: "rider1@platform.local",
    title: "Delivery rider",
    subtitle: "Sign in to view assigned deliveries and update delivery status.",
  },
};

export default function LoginScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const setTokens = useSessionStore((s) => s.setTokens);
  const branch = useBranchStore((s) => s.branch);

  const [roleTab, setRoleTab] = useState<StaffRole>("waiter");
  const [email, setEmail] = useState(ROLE_DEFAULTS.waiter.email);
  const [password, setPassword] = useState("changeme-please-01");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (accessToken) {
    const home = branch ? homeRouteForRole(resolveStaffRole(claims)) : "/branch";
    return <Redirect href={home} />;
  }

  function selectRole(role: StaffRole): void {
    setRoleTab(role);
    setEmail(ROLE_DEFAULTS[role].email);
    setError(null);
  }

  async function handleLogin(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.login(email.trim(), password);
      const claims = decodeAccessToken(tokens.accessToken);
      const resolvedRole = resolveStaffRole(claims);
      if (roleTab === "rider" && resolvedRole !== "rider") {
        throw new Error("This account is not a delivery rider. Use waiter credentials or contact admin.");
      }
      if (roleTab === "waiter" && resolvedRole === "rider") {
        throw new Error("This account is a delivery rider. Switch to the Delivery rider tab to sign in.");
      }
      setTokens(tokens.accessToken, tokens.refreshToken, claims, email.trim());
      router.replace("/branch");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const roleCopy = ROLE_DEFAULTS[roleTab];

  return (
    <Screen safeTop>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          <View>
            <Title>POPS Staff</Title>
            <Subtitle>Restaurant mobile app for waiters and delivery riders.</Subtitle>
            {Constants.appOwnership === "expo" ? (
              <Subtitle>
                Use your staff email and password below. Ignore Expo Go’s “Log In” on the home screen — that
                opens a browser and is not required.
              </Subtitle>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["waiter", "rider"] as const).map((role) => (
              <Pressable
                key={role}
                onPress={() => selectRole(role)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: roleTab === role ? colors.accent : colors.border,
                  backgroundColor: roleTab === role ? "#1e3a5f" : "#020617",
                  alignItems: "center",
                }}
              >
                <Subtitle>{role === "waiter" ? "Waiter" : "Delivery rider"}</Subtitle>
              </Pressable>
            ))}
          </View>

          <Card>
            <Title>{roleCopy.title}</Title>
            <Subtitle>{roleCopy.subtitle}</Subtitle>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Notice>{error}</Notice> : null}
            <Button label="Sign in" onPress={() => void handleLogin()} loading={loading} />
          </Card>

          <Card>
            <Subtitle>
              API: {getApiBaseUrl()}
              {"\n"}
              Waiter: waiter1@platform.local · Rider: rider1@platform.local
              {"\n"}
              Password: changeme-please-01
            </Subtitle>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
