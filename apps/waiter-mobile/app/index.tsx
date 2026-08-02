import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
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
import { decodeAccessToken } from "../src/lib/jwt";
import { warmApiConnection } from "../src/lib/warmApi";
import {
  homeRouteForRole,
  isAdminOrIncharge,
  resolveStaffRole,
  type AppKind,
  type StaffRole,
} from "../src/lib/roles";
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
    title: "Rider",
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

const extra = Constants.expoConfig?.extra as
  | { defaultRole?: StaffRole | "admin"; appKind?: AppKind; appVariant?: string }
  | undefined;

const appKind: AppKind = extra?.appKind ?? "staff";
const isAdminApp = appKind === "admin";
const defaultRole: StaffRole =
  extra?.defaultRole === "rider" || extra?.defaultRole === "cashier" || extra?.defaultRole === "waiter"
    ? extra.defaultRole
    : "waiter";

const appName = Constants.expoConfig?.name ?? (isAdminApp ? "POPS Admin" : "POPS Staff");

/** Staff APK shows Waiter | Rider. Locked APKs show one role. Admin has no role tabs. */
const roleTabs: StaffRole[] =
  appKind === "staff" ? ["waiter", "rider"] : appKind === "staff-locked" ? [defaultRole] : [];

export default function LoginScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const setTokens = useSessionStore((s) => s.setTokens);
  const clearBranch = useBranchStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);

  // Staff opens on Email first; PIN remains available as a second option.
  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [roleTab, setRoleTab] = useState<StaffRole>(defaultRole);
  const [branchCode, setBranchCode] = useState("ISB-GT");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState(
    isAdminApp ? "admin.restaurant@pops.demo" : ROLE_DEFAULTS[defaultRole].email,
  );
  const [password, setPassword] = useState(isAdminApp ? "Owner@12345" : "changeme-please-01");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [postLoginNav, setPostLoginNav] = useState(false);

  useEffect(() => {
    if (accessToken || Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => subscription.remove();
  }, [accessToken]);

  if (accessToken && !loading && !postLoginNav) {
    if (isAdminApp) {
      return <Redirect href="/admin-home" />;
    }
    const home = branch ? homeRouteForRole(resolveStaffRole(claims), appKind) : "/branch";
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

  function assertRoleMatches(resolvedRole: StaffRole | null): void {
    if (isAdminApp) return;
    if (roleTab === "rider" && resolvedRole !== "rider") {
      throw new Error("This login is not a Rider account. Switch to the Waiter tab or use rider credentials.");
    }
    if (roleTab === "waiter" && resolvedRole === "rider") {
      throw new Error("This login is a Rider. Switch to the Rider tab.");
    }
    if (roleTab === "waiter" && resolvedRole === "cashier") {
      throw new Error("This login is a cashier account. Use the desktop POS or contact admin.");
    }
  }

  async function handlePinLogin(pinValue = pin): Promise<void> {
    setError(null);
    if (isAdminApp) {
      setError("Admin app uses Email login. Use email & password for Incharge/Admin.");
      return;
    }
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
      assertRoleMatches(resolvedRole);
      setPostLoginNav(true);
      clearBranch();
      setTokens(tokens.accessToken, tokens.refreshToken, decoded);
      markOnline();
      router.replace("/branch");
    } catch (err) {
      setPostLoginNav(false);
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

      if (isAdminApp) {
        if (!isAdminOrIncharge(decoded)) {
          throw new Error("This Admin APK is for Incharge/Admin only. Waiters and riders must use the Staff app.");
        }
        setPostLoginNav(true);
        clearBranch();
        setTokens(tokens.accessToken, tokens.refreshToken, decoded, email.trim());
        markOnline();
        router.replace("/admin-home");
        return;
      }

      const resolvedRole = resolveStaffRole(decoded);
      assertRoleMatches(resolvedRole);
      setPostLoginNav(true);
      clearBranch();
      setTokens(tokens.accessToken, tokens.refreshToken, decoded, email.trim());
      markOnline();
      router.replace("/branch");
    } catch (err) {
      setPostLoginNav(false);
      const message = err instanceof Error ? err.message : "Login failed";
      if (message.toLowerCase().includes("invalid") && !isAdminApp) {
        setError(
          `${message}\n\nDemo for this tab:\n${ROLE_DEFAULTS[roleTab].email} / changeme-please-01`,
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const roleCopy = isAdminApp
    ? {
        title: "Admin / Incharge",
        subtitle: "Full dashboard — sales, users, activity, and PRA.",
        demoPin: undefined as string | undefined,
      }
    : ROLE_DEFAULTS[roleTab];

  return (
    <Screen safeTop>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          <View>
            <Title>{appName}</Title>
            <Subtitle>
              {isAdminApp
                ? "Admin login — sales dashboard, users, activity, and PRA."
                : "One Staff APK · Waiter or Rider · then Email or PIN below."}
            </Subtitle>
          </View>

          {roleTabs.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                Choose role
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {roleTabs.map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => selectRole(role)}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: roleTab === role ? colors.accent : colors.border,
                      backgroundColor: roleTab === role ? "rgba(15, 118, 110, 0.18)" : colors.bg,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: roleTab === role ? colors.accent : colors.muted,
                        fontWeight: "800",
                        fontSize: 15,
                      }}
                    >
                      {role === "waiter" ? "Waiter" : "Rider"}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                      {role === "waiter" ? "Orders & kitchen" : "Deliveries"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {!isAdminApp ? <LoginModeTabs mode={loginMode} onChange={switchLoginMode} /> : null}

          <Card>
            <Title>{roleCopy.title}</Title>
            <Subtitle>
              {isAdminApp || loginMode === "password"
                ? "Enter your email address and password."
                : "Enter your branch code and 4-digit PIN."}
            </Subtitle>

            {isAdminApp || loginMode === "password" ? (
              <View style={{ gap: 12, marginTop: 8 }}>
                <Input
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder={isAdminApp ? "admin@yourbiz.com" : ROLE_DEFAULTS[roleTab].email}
                  value={email}
                  onChangeText={setEmail}
                />
                <Input
                  placeholder="Password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <Button
                  label={loading ? "Signing in…" : "Sign In"}
                  onPress={() => void handlePasswordLogin()}
                  loading={loading}
                />
                {!isAdminApp ? (
                  <Subtitle>
                    Demo: {ROLE_DEFAULTS[roleTab].email} / changeme-please-01
                  </Subtitle>
                ) : (
                  <Subtitle>
                    Demo: admin.restaurant@pops.demo / Owner@12345
                    {"\n"}
                    (or admin@platform.local / Owner@12345)
                  </Subtitle>
                )}
              </View>
            ) : (
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
                  <Subtitle>
                    Demo PIN: {roleCopy.demoPin} · Branch: {branchCode || "ISB-GT"}
                  </Subtitle>
                ) : null}
              </View>
            )}

            {error ? <Notice>{error}</Notice> : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
