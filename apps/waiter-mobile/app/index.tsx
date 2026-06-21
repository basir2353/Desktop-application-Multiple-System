import { AuthClient } from "@platform/auth-client";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Button, Card, Input, Notice, Screen, Subtitle, Title } from "../src/components/ui";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { decodeAccessToken } from "../src/lib/jwt";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

export default function LoginScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const setTokens = useSessionStore((s) => s.setTokens);
  const branch = useBranchStore((s) => s.branch);

  const [email, setEmail] = useState("waiter1@platform.local");
  const [password, setPassword] = useState("changeme-please-01");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (accessToken) {
    return <Redirect href={branch ? "/home" : "/branch"} />;
  }

  async function handleLogin(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.login(email.trim(), password);
      const claims = decodeAccessToken(tokens.accessToken);
      setTokens(tokens.accessToken, tokens.refreshToken, claims, email.trim());
      router.replace("/branch");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen safeTop>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          <View>
            <Title>POPS Waiter</Title>
            <Subtitle>Sign in to take table orders. Orders sync to the desktop Orders page.</Subtitle>
            {Constants.appOwnership === "expo" ? (
              <Subtitle>
                Use your waiter email and password below. Ignore Expo Go’s “Log In” on the home screen — that
                opens a browser and is not required.
              </Subtitle>
            ) : null}
          </View>

          <Card>
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
              Use your machine LAN IP on a physical device (EXPO_PUBLIC_API_BASE_URL).
            </Subtitle>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
