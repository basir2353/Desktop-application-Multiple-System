import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOBIZONE_DEMO_EMAIL, MOBIZONE_DEMO_PASSWORD } from "./assertMobizoneAccount";
import { useMz, useMzLayout } from "./theme";
import { MzThemeToggle } from "./ui";

type Props = {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
};

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "phone-portrait-outline", label: "IMEI" },
  { icon: "cart-outline", label: "Buy / Sell" },
  { icon: "people-outline", label: "Udhaar" },
  { icon: "stats-chart-outline", label: "Reports" },
];

export function MzLoginView({
  email,
  password,
  loading,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: Props): JSX.Element {
  const insets = useSafeAreaInsets();
  const mz = useMz();
  const { pad } = useMzLayout();

  return (
    <View style={{ flex: 1, backgroundColor: mz.bg, paddingTop: insets.top + 10 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: pad,
            paddingBottom: 24,
            gap: 12,
            flexGrow: 1,
            justifyContent: "center",
            maxWidth: 480,
            width: "100%",
            alignSelf: "center",
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: mz.navyDeep,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="phone-portrait" size={20} color={mz.accent} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ color: mz.ink, fontSize: 22, fontWeight: "800" }}>MobiZone</Text>
              <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>
                Phone shop ERP · IMEI stock
              </Text>
            </View>
            <MzThemeToggle />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {FEATURES.map((f) => (
              <View
                key={f.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: mz.card,
                  borderWidth: 1,
                  borderColor: mz.border,
                }}
              >
                <Ionicons name={f.icon} size={13} color={mz.accent} />
                <Text style={{ color: mz.text, fontSize: 11, fontWeight: "700" }}>{f.label}</Text>
              </View>
            ))}
          </View>

          <View
            style={{
              backgroundColor: mz.navyDeep,
              borderRadius: 14,
              padding: 14,
              gap: 10,
              borderWidth: 1,
              borderColor: mz.border,
            }}
          >
            <View style={{ gap: 3 }}>
              <Text
                style={{
                  color: mz.goldBright,
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 1.1,
                }}
              >
                SECURE LOGIN
              </Text>
              <Text style={{ color: mz.onNavy, fontSize: 17, fontWeight: "800" }}>
                Sign in to MobiZone
              </Text>
              <Text style={{ color: "rgba(233,238,243,0.65)", fontSize: 12, lineHeight: 16 }}>
                MobiZone accounts only — other ERP users are blocked.
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: "rgba(233,238,243,0.72)",
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                Email
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  paddingHorizontal: 10,
                  minHeight: 44,
                }}
              >
                <Ionicons
                  name="mail-outline"
                  size={17}
                  color={mz.muted}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={{
                    flex: 1,
                    color: mz.onNavy,
                    fontSize: 14,
                    paddingVertical: Platform.OS === "ios" ? 10 : 8,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder={MOBIZONE_DEMO_EMAIL}
                  placeholderTextColor={mz.placeholder}
                  value={email}
                  onChangeText={onEmailChange}
                />
              </View>
            </View>

            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: "rgba(233,238,243,0.72)",
                  fontSize: 11,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                Password
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  paddingHorizontal: 10,
                  minHeight: 44,
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={17}
                  color={mz.muted}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={{
                    flex: 1,
                    color: mz.onNavy,
                    fontSize: 14,
                    paddingVertical: Platform.OS === "ios" ? 10 : 8,
                  }}
                  placeholder="Password"
                  placeholderTextColor={mz.placeholder}
                  secureTextEntry
                  value={password}
                  onChangeText={onPasswordChange}
                  onSubmitEditing={onSubmit}
                />
              </View>
            </View>

            {error ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  backgroundColor: "rgba(225,29,72,0.22)",
                  borderRadius: 10,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: "rgba(254,205,211,0.35)",
                }}
              >
                <Ionicons name="alert-circle" size={16} color="#FECDD3" />
                <Text
                  style={{
                    flex: 1,
                    color: "#FECDD3",
                    fontSize: 12,
                    lineHeight: 17,
                    fontWeight: "600",
                  }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={loading}
              style={({ pressed }) => ({
                marginTop: 2,
                minHeight: 46,
                borderRadius: 10,
                backgroundColor: mz.accent,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: pressed || loading ? 0.88 : 1,
              })}
            >
              {loading ? (
                <ActivityIndicator color={mz.onAccent} />
              ) : (
                <>
                  <Text style={{ color: mz.onAccent, fontSize: 15, fontWeight: "800" }}>
                    Sign In
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={mz.onAccent} />
                </>
              )}
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="key-outline" size={14} color={mz.goldBright} />
              <Text style={{ flex: 1, color: "rgba(233,238,243,0.55)", fontSize: 11 }}>
                Demo · {MOBIZONE_DEMO_EMAIL} / {MOBIZONE_DEMO_PASSWORD}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
