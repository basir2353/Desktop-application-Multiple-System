import { AuthClient } from "@platform/auth-client";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { pinLogin } from "../src/api/auth";
import {
  Button,
  Card,
  Input,
  Notice,
  PinPad,
  Screen,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { decodeAccessToken } from "../src/lib/jwt";
import { homeRouteForRole, resolveStaffRole, type StaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

type LoginMode = "pin" | "password";

const ROLE_DEFAULTS: Record<StaffRole, { email: string; title: string; subtitle: string; demoPin?: string }> = {
  waiter: {
    email: "waiter1@platform.local",
    title: "Waiter",
    subtitle: "Sign in to take table orders. Orders sync to the desktop POS in real time.",
    demoPin: "1111",
  },
  rider: {
    email: "rider1@platform.local",
    title: "Delivery rider",
    subtitle: "Sign in to view assigned deliveries and update delivery status.",
    demoPin: "6666",
  },
  cashier: {
    email: "cashier1@platform.local",
    title: "Cashier",
    subtitle: "Sign in to close held orders and collect payments.",
    demoPin: "2222",
  },
};

const defaultRole =
  (Constants.expoConfig?.extra as { defaultRole?: StaffRole } | undefined)?.defaultRole ?? "waiter";

export default function LoginScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const setTokens = useSessionStore((s) => s.setTokens);
  const branch = useBranchStore((s) => s.branch);

  const [loginMode, setLoginMode] = useState<LoginMode>("pin");
  const [roleTab, setRoleTab] = useState<StaffRole>(defaultRole);
  const [branchCode, setBranchCode] = useState("ISB-GT");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState(ROLE_DEFAULTS[defaultRole].email);
  const [password, setPassword] = useState("changeme-please-01");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (accessToken || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [accessToken]);

  if (accessToken) {
    const home = branch ? homeRouteForRole(resolveStaffRole(claims)) : "/branch";
    return <Redirect href={home} />;
  }

  function selectRole(role: StaffRole): void {
    setRoleTab(role);
    setEmail(ROLE_DEFAULTS[role].email);
    setPassword("changeme-please-01");
    setPin("");
    setError(null);
  }

  async function handlePinLogin(pinValue = pin): Promise<void> {
    setError(null);
    if (!/^\d{4}$/.test(pinValue)) {
      setError("Enter a 4-digit PIN.");
      return;
    }
    if (!branchCode.trim()) {
      setError("Enter your branch code (e.g. ISB-GT).");
      return;
    }
    setLoading(true);
    try {
      const tokens = await pinLogin(branchCode, pinValue);
      const decoded = decodeAccessToken(tokens.accessToken);
      const resolvedRole = resolveStaffRole(decoded);
      if (roleTab === "rider" && resolvedRole !== "rider") {
        throw new Error("This PIN is not a delivery rider. Switch to the correct role tab.");
      }
      if (roleTab === "cashier" && resolvedRole !== "cashier") {
        throw new Error("This PIN is not a cashier account. Use waiter credentials or contact admin.");
      }
      if (roleTab === "waiter" && resolvedRole === "rider") {
        throw new Error("This PIN is a delivery rider. Switch to the Delivery rider tab.");
      }
      if (roleTab === "waiter" && resolvedRole === "cashier") {
        throw new Error("This PIN is a cashier account. Switch to the Cashier tab.");
      }
      setTokens(tokens.accessToken, tokens.refreshToken, decoded);
      router.replace("/branch");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PIN login failed");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const client = new AuthClient({ baseUrl: getApiBaseUrl() });
      const tokens = await client.login(email.trim(), password);
      const decoded = decodeAccessToken(tokens.accessToken);
      const resolvedRole = resolveStaffRole(decoded);
      if (roleTab === "rider" && resolvedRole !== "rider") {
        throw new Error("This account is not a delivery rider. Use waiter credentials or contact admin.");
      }
      if (roleTab === "cashier" && resolvedRole !== "cashier") {
        throw new Error("This account is not a cashier. Switch to the correct role tab.");
      }
      if (roleTab === "waiter" && resolvedRole === "rider") {
        throw new Error("This account is a delivery rider. Switch to the Delivery rider tab.");
      }
      setTokens(tokens.accessToken, tokens.refreshToken, decoded, email.trim());
      router.replace("/branch");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      if (message.toLowerCase().includes("invalid")) {
        setError(
          `${message}\n\nUse the demo account for this role:\n${ROLE_DEFAULTS[roleTab].email} / changeme-please-01`,
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const roleCopy = ROLE_DEFAULTS[roleTab];
  const roleTabs: StaffRole[] =
    defaultRole === "waiter" ? ["waiter", "cashier", "rider"] : [defaultRole];

  return (
    <Screen safeTop>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          <View>
            <Title>{defaultRole === "rider" ? "POPS Rider" : "POPS Staff"}</Title>
            <Subtitle>
              {defaultRole === "rider"
                ? "Delivery rider app — view assigned orders and update delivery status."
                : "Restaurant mobile app for waiters, cashiers, and delivery riders."}
            </Subtitle>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {roleTabs.map((role) => (
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
                <Subtitle>
                  {role === "waiter" ? "Waiter" : role === "cashier" ? "Cashier" : "Rider"}
                </Subtitle>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["pin", "password"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => {
                  setLoginMode(mode);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: loginMode === mode ? colors.accent : colors.border,
                  backgroundColor: loginMode === mode ? "rgba(245, 158, 11, 0.15)" : "#020617",
                  alignItems: "center",
                }}
              >
                <Subtitle>{mode === "pin" ? "4-digit PIN" : "Email & password"}</Subtitle>
              </Pressable>
            ))}
          </View>

          <Card>
            <Title>{roleCopy.title}</Title>
            <Subtitle>{roleCopy.subtitle}</Subtitle>

            {loginMode === "pin" ? (
              <View style={{ gap: 14, marginTop: 8 }}>
                <Input
                  placeholder="Branch code (e.g. ISB-GT)"
                  value={branchCode}
                  onChangeText={setBranchCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <PinPad
                  value={pin}
                  onChange={setPin}
                  onSubmit={() => void handlePinLogin()}
                  disabled={loading}
                />
                <Button
                  label={loading ? "Signing in…" : "Sign in with PIN"}
                  onPress={() => void handlePinLogin()}
                  loading={loading}
                  disabled={pin.length !== 4}
                />
              </View>
            ) : (
              <View style={{ gap: 12, marginTop: 8 }}>
                <Input
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder={ROLE_DEFAULTS[roleTab].email}
                  value={email}
                  onChangeText={setEmail}
                />
                <Input
                  placeholder="Password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <Button label="Sign in" onPress={() => void handlePasswordLogin()} loading={loading} />
              </View>
            )}

            {error ? <Notice>{error}</Notice> : null}
          </Card>

          <Card>
            <Subtitle>
              API: {getApiBaseUrl()}
              {"\n"}
              Branch: ISB-GT
              {"\n"}
              Waiter PIN: 1111 · Cashier PIN: 2222 · Rider PIN: 6666
              {"\n"}
              Or email/password: changeme-please-01
            </Subtitle>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
