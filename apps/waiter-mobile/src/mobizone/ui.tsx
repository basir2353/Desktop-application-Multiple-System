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
          borderRadius: 16,
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
          color: mz.gold,
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 0.6,
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
  paddingVertical: 12,
  fontSize: 15,
  borderWidth: 1,
  borderColor: mz.inputBorder,
  flex: 1,
} as const;

export function MzInput(props: TextInputProps): React.JSX.Element {
  return (
    <TextInput
      placeholderTextColor={mz.muted}
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
        backgroundColor: mz.gold,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
        shadowColor: mz.gold,
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 16 }}>{label}</Text>
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
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: active ? mz.gold : mz.cardSoft,
        borderWidth: 1,
        borderColor: active ? mz.gold : mz.border,
      }}
    >
      <Text style={{ color: active ? mz.ink : mz.text, fontWeight: "700" }}>{label}</Text>
    </Pressable>
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
        <Text style={{ color: mz.goldBright, fontSize: 22, fontWeight: "800", letterSpacing: 0.2 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: mz.muted, fontSize: 13, marginTop: 4 }}>{subtitle}</Text>
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
    tone === "teal"
      ? "rgba(61,184,168,0.18)"
      : tone === "orange"
        ? "rgba(224,160,96,0.2)"
        : tone === "rose"
          ? "rgba(224,122,138,0.2)"
          : "rgba(185,150,83,0.2)";
  const fg =
    tone === "teal"
      ? mz.teal
      : tone === "orange"
        ? mz.orange
        : tone === "rose"
          ? mz.rose
          : mz.goldBright;
  return (
    <View
      style={{
        backgroundColor: bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
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
}: {
  title: string;
  note?: string;
}): React.JSX.Element {
  return (
    <MzCard style={{ alignItems: "center", paddingVertical: 28 }}>
      <Text style={{ color: mz.gold, fontSize: 28, marginBottom: 8 }}>◇</Text>
      <Text style={{ color: mz.text, fontWeight: "700", fontSize: 15 }}>{title}</Text>
      {note ? (
        <Text style={{ color: mz.muted, fontSize: 13, marginTop: 6, textAlign: "center" }}>
          {note}
        </Text>
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
