import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { passwordLogin, pinLogin } from "../src/api/auth";
import {
  Button,
  Card,
  Input,
  LoginModeTabs,
  Notice,
  PinPad,
  Screen,
  Subtitle,
  Title,
  colors,
} from "../src/components/ui";
import { getApiBaseUrl } from "../src/lib/apiBase";
import { decodeAccessToken } from "../src/lib/jwt";
import { warmApiConnection } from "../src/lib/warmApi";
import { homeRouteForRole, resolveStaffRole, type StaffRole } from "../src/lib/roles";
import { useBranchStore } from "../src/stores/branchStore";
import { markOnline } from "../src/stores/connectivityStore";
import { useSessionStore } from "../src/stores/sessionStore";

type LoginMode = "pin" | "password";

const ROLE_DEFAULTS: Record<StaffRole, { email: string; title: string; subtitle: string; demoPin?: string }> = {
  waiter: {
    email: "waiter1@platform.local",
    title: "Waiter",
    subtitle: "Take table orders and send them to the kitchen.",
    demoPin: "1111",
  },
  rider: {
    email: "rider1@platform.local",
    title: "Delivery rider",
    subtitle: "View assigned deliveries and update delivery status.",
    demoPin: "6666",
  },
  cashier: {
    email: "cashier1@platform.local",
    title: "Cashier",
    subtitle: "Close held orders and collect payments.",
    demoPin: "2222",
  },
};

const defaultRole =
  (Constants.expoConfig?.extra as { defaultRole?: StaffRole } | undefined)?.defaultRole ?? "waiter";

const appName = Constants.expoConfig?.name ?? (defaultRole === "rider" ? "POPS Rider" : "POPS Waiter");

/** Dedicated waiter/rider APKs lock the role tab to that role (both Sign In and PIN login remain available). */
const dedicatedApp = defaultRole === "waiter" || defaultRole === "rider";

export default function LoginScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const setTokens = useSessionStore((s) => s.setTokens);
  const branch = useBranchStore((s) => s.branch);

  const [loginMode, setLoginMode] = useState<LoginMode>("password");
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

  function switchLoginMode(mode: LoginMode): void {
    setLoginMode(mode);
    setError(null);
    setPin("");
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
      await warmApiConnection();
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
      markOnline();
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
      await warmApiConnection();
      const tokens = await passwordLogin(email.trim(), password);
      const decoded = decodeAccessToken(tokens.accessToken);
      const resolvedRole = resolveStaffRole(decoded);
      if (roleTab === "rider" && resolvedRole !== "rider") {
        throw new Error("This account is not a delivery rider. Use rider credentials or contact admin.");
      }
      if (roleTab === "cashier" && resolvedRole !== "cashier") {
        throw new Error("This account is not a cashier. Switch to the correct role tab.");
      }
      if (roleTab === "waiter" && resolvedRole === "rider") {
        throw new Error("This account is a delivery rider. Switch to the Delivery rider tab.");
      }
      setTokens(tokens.accessToken, tokens.refreshToken, decoded, email.trim());
      markOnline();
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
  const roleTabs: StaffRole[] = dedicatedApp ? [defaultRole] : ["waiter", "cashier", "rider"];

  return (
    <Screen safeTop>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          <View>
            <Title>{appName}</Title>
            <Subtitle>
              {defaultRole === "rider"
                ? "Sign in with email or your 4-digit PIN to manage deliveries."
                : defaultRole === "waiter"
                  ? "Sign in with email or your 4-digit PIN to take table orders."
                  : "Restaurant mobile app for waiters, cashiers, and delivery riders."}
            </Subtitle>
          </View>

          {roleTabs.length > 1 ? (
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
          ) : null}

          <LoginModeTabs mode={loginMode} onChange={switchLoginMode} />

          <Card>
            <Title>{roleCopy.title}</Title>
            <Subtitle>
              {loginMode === "pin"
                ? "Enter your branch code and 4-digit PIN."
                : "Enter your email address and password."}
            </Subtitle>

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
                  label={loading ? "Signing in…" : "Login with PIN"}
                  onPress={() => void handlePinLogin()}
                  loading={loading}
                  disabled={pin.length !== 4}
                />
                {roleCopy.demoPin ? (
                  <Subtitle>Demo PIN: {roleCopy.demoPin} · Branch: {branchCode || "ISB-GT"}</Subtitle>
                ) : null}
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
                <Button label="Sign In" onPress={() => void handlePasswordLogin()} loading={loading} />
                <Subtitle>
                  Demo: {ROLE_DEFAULTS[roleTab].email} / changeme-please-01
                  {"\n"}
                  First sign-in may take up to 30 seconds while the server wakes up.
                </Subtitle>
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
              {defaultRole === "waiter"
                ? "Waiter PIN: 1111"
                : defaultRole === "rider"
                  ? "Rider PIN: 6666"
                  : "Waiter PIN: 1111 · Rider PIN: 6666"}
              {"\n"}
              Set your own PIN after signing in via Home → Manage PIN.
            </Subtitle>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
