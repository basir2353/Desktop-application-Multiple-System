import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { mz } from "./theme";

export function MzCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}): React.JSX.Element {
  return (
    <View
      style={[
        {
          backgroundColor: mz.card,
          borderRadius: 14,
          padding: 16,
          borderWidth: 1,
          borderColor: mz.border,
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
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <MzCard>
      <Text
        style={{
          color: mz.accent,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 1.1,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      <View style={{ gap: 10 }}>{children}</View>
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
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: mz.muted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      {children}
    </View>
  );
}

export const mzInputStyle = {
  backgroundColor: mz.inputBg,
  color: mz.inputText,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 13,
  fontSize: 15,
  borderWidth: 1.5,
  borderColor: mz.inputBorder,
  flex: 1,
} as const;

export function MzInput(props: TextInputProps): React.JSX.Element {
  return (
    <TextInput
      placeholderTextColor="#8A9AAB"
      {...props}
      style={[mzInputStyle, props.style as object]}
    />
  );
}

export function MzPrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: mz.accent,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text style={{ color: mz.onGold, fontWeight: "800", fontSize: 16, letterSpacing: 0.3 }}>
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
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 72,
        paddingVertical: 11,
        borderRadius: 10,
        alignItems: "center",
        backgroundColor: active ? mz.ink : mz.white,
        borderWidth: 1.5,
        borderColor: active ? mz.ink : mz.border,
      }}
    >
      <Text style={{ color: active ? mz.white : mz.text, fontWeight: "700", fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Quick date presets for From/To filters on reports & history. */
export function MzDateRangeChips({
  fromDate,
  toDate,
  onChange,
}: {
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
}): React.JSX.Element {
  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { y, m, day, ymd: `${y}-${m}-${day}`, monthStart: `${y}-${m}-01`, yearStart: `${y}-01-01` };
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {presets.map((p) => {
          const active = fromDate === p.from && toDate === p.to;
          return (
            <Pressable
              key={p.label}
              onPress={() => onChange(p.from, p.to)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: active ? mz.accent : mz.cardSoft,
                borderWidth: 1,
                borderColor: active ? mz.accent : mz.border,
              }}
            >
              <Text style={{ color: active ? mz.onGold : mz.text, fontWeight: "700", fontSize: 12 }}>
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
  return (
    <View
      style={{
        marginBottom: 4,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: mz.ink, fontSize: 24, fontWeight: "800", letterSpacing: -0.3 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: mz.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
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
  const bg =
    tone === "teal" || tone === "gold"
      ? "#CCFBF1"
      : tone === "orange"
        ? "#FFEDD5"
        : "#FEE2E2";
  const fg =
    tone === "teal" || tone === "gold"
      ? mz.goldDim
      : tone === "orange"
        ? mz.orange
        : mz.rose;
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
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
}: {
  title: string;
  note?: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.JSX.Element {
  return (
    <MzCard style={{ alignItems: "center", paddingVertical: 36 }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: mz.cardSoft,
          borderWidth: 1,
          borderColor: mz.border,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: mz.accent, fontSize: 20, fontWeight: "800" }}>MZ</Text>
      </View>
      <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 16 }}>{title}</Text>
      {note ? (
        <Text
          style={{
            color: mz.muted,
            fontSize: 13,
            marginTop: 6,
            textAlign: "center",
            paddingHorizontal: 12,
            lineHeight: 18,
          }}
        >
          {note}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 16,
            backgroundColor: mz.accent,
            borderRadius: 12,
            paddingHorizontal: 18,
            paddingVertical: 12,
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
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ color: mz.muted }}>{label}</Text>
      <Text style={{ color: tone ?? mz.text, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

/** Brand header strip — ink + teal mark */
export function MzNavyHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}): React.JSX.Element {
  return (
    <View
      style={{
        backgroundColor: mz.ink,
        marginHorizontal: -16,
        marginTop: -4,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 20,
        marginBottom: 14,
      }}
    >
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 120,
          backgroundColor: "rgba(15,155,142,0.12)",
        }}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              color: mz.accent,
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            MobiZone
          </Text>
          <Text style={{ color: mz.onNavy, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: "rgba(233,238,243,0.72)", fontSize: 12, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}
