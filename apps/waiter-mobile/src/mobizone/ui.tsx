import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useThemeStore } from "../stores/themeStore";
import { useMz, useMzLayout, type MzColors } from "./theme";

export function MzThemeToggle({ size = 36 }: { size?: number }): React.JSX.Element {
  const mz = useMz();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: mz.cardSoft,
        borderWidth: 1,
        borderColor: mz.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons
        name={mode === "dark" ? "sunny-outline" : "moon-outline"}
        size={18}
        color={mz.accent}
      />
    </Pressable>
  );
}

export function mzScreenPad(mz: MzColors, pad: number, gap: number): ViewStyle {
  return {
    paddingHorizontal: pad,
    paddingTop: 8,
    paddingBottom: 20,
    gap,
  };
}

export function MzCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <View
      style={[
        {
          backgroundColor: mz.card,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: mz.border,
          gap: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function MzSection({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <MzCard>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        {icon ? <Ionicons name={icon} size={14} color={mz.accent} /> : null}
        <Text
          style={{
            color: mz.accent,
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Text>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </MzCard>
  );
}

export function MzField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      {children}
    </View>
  );
}

export function useMzInputStyle(): ViewStyle & { color: string; fontSize: number } {
  const mz = useMz();
  return {
    backgroundColor: mz.inputBg,
    color: mz.inputText,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: mz.inputBorder,
    width: "100%",
  };
}

/** @deprecated use MzInput — kept for call sites that spread mzInputStyle */
export const mzInputStyle = {
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 11,
  fontSize: 15,
  borderWidth: 1.5,
  width: "100%",
} as const;

export function MzInput(props: TextInputProps): React.JSX.Element {
  const mz = useMz();
  const base = useMzInputStyle();
  return (
    <TextInput
      placeholderTextColor={mz.placeholder}
      {...props}
      style={[base, props.style as object]}
    />
  );
}

export function MzPrimaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: mz.accent,
        borderRadius: 10,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
      })}
    >
      {icon ? <Ionicons name={icon} size={18} color={mz.onGold} /> : null}
      <Text style={{ color: mz.onGold, fontWeight: "800", fontSize: 15, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MzChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 64,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
        backgroundColor: active ? mz.navy : mz.cardSoft,
        borderWidth: 1.5,
        borderColor: active ? mz.accent : mz.border,
      }}
    >
      <Text
        style={{
          color: active ? mz.onNavy : mz.text,
          fontWeight: "700",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MzDateRangeChips({
  fromDate,
  toDate,
  onChange,
}: {
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
}): React.JSX.Element {
  const mz = useMz();
  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return {
      ymd: `${y}-${m}-${day}`,
      monthStart: `${y}-${m}-01`,
      yearStart: `${y}-01-01`,
    };
  })();
  const presets = [
    { label: "Today", from: today.ymd, to: today.ymd },
    { label: "Month", from: today.monthStart, to: today.ymd },
    { label: "Year", from: today.yearStart, to: today.ymd },
    { label: "All", from: "", to: "" },
  ] as const;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <MzField label="From date">
            <MzInput
              value={fromDate}
              onChangeText={(v) => onChange(v, toDate)}
              placeholder="YYYY-MM-DD"
            />
          </MzField>
        </View>
        <View style={{ flex: 1 }}>
          <MzField label="To date">
            <MzInput
              value={toDate}
              onChangeText={(v) => onChange(fromDate, v)}
              placeholder="YYYY-MM-DD"
            />
          </MzField>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {presets.map((p) => {
          const active = fromDate === p.from && toDate === p.to;
          return (
            <Pressable
              key={p.label}
              onPress={() => onChange(p.from, p.to)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: 8,
                backgroundColor: active ? mz.accent : mz.cardSoft,
                borderWidth: 1,
                borderColor: active ? mz.accent : mz.border,
              }}
            >
              <Text
                style={{
                  color: active ? mz.onGold : mz.text,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MzScreenTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: mz.ink,
            fontSize: 22,
            fontWeight: "800",
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: mz.muted, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {right}
        <MzThemeToggle />
      </View>
    </View>
  );
}

export function MzBadge({
  label,
  tone = "gold",
}: {
  label: string;
  tone?: "gold" | "teal" | "orange" | "rose";
}): React.JSX.Element {
  const mz = useMz();
  const dark = mz.mode === "dark";
  const bg =
    tone === "teal" || tone === "gold"
      ? dark
        ? "rgba(20,184,166,0.18)"
        : "#CCFBF1"
      : tone === "orange"
        ? dark
          ? "rgba(251,146,60,0.18)"
          : "#FFEDD5"
        : dark
          ? "rgba(251,113,133,0.18)"
          : "#FEE2E2";
  const fg =
    tone === "teal" || tone === "gold"
      ? mz.goldBright
      : tone === "orange"
        ? mz.orange
        : mz.rose;
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
      }}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: "800", textTransform: "capitalize" }}>
        {label}
      </Text>
    </View>
  );
}

export function MzEmpty({
  title,
  note,
  actionLabel,
  onAction,
  icon = "phone-portrait-outline",
}: {
  title: string;
  note?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <MzCard style={{ alignItems: "center", paddingVertical: 22 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: mz.cardSoft,
          borderWidth: 1,
          borderColor: mz.border,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Ionicons name={icon} size={20} color={mz.accent} />
      </View>
      <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 15 }}>{title}</Text>
      {note ? (
        <Text
          style={{
            color: mz.muted,
            fontSize: 12,
            marginTop: 4,
            textAlign: "center",
            paddingHorizontal: 8,
            lineHeight: 17,
          }}
        >
          {note}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 12,
            backgroundColor: mz.accent,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: mz.onGold, fontWeight: "800" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </MzCard>
  );
}

export function MzRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      <Text style={{ color: mz.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: tone ?? mz.text, fontWeight: "700", fontSize: 13 }}>{value}</Text>
    </View>
  );
}

export function MzNavyHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}): React.JSX.Element {
  const mz = useMz();
  const { pad } = useMzLayout();
  return (
    <View
      style={{
        backgroundColor: mz.navyDeep,
        marginHorizontal: -pad,
        marginTop: -4,
        paddingHorizontal: pad,
        paddingTop: 12,
        paddingBottom: 14,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: mz.border,
      }}
    >
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 100,
          backgroundColor: "rgba(15,155,142,0.12)",
        }}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="phone-portrait" size={11} color={mz.accent} />
            <Text
              style={{
                color: mz.accent,
                fontSize: 10,
                fontWeight: "800",
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              MobiZone
            </Text>
          </View>
          <Text
            style={{ color: mz.onNavy, fontSize: 20, fontWeight: "800", letterSpacing: -0.3 }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: "rgba(233,238,243,0.7)", fontSize: 11 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {right}
          <MzThemeToggle />
        </View>
      </View>
    </View>
  );
}
