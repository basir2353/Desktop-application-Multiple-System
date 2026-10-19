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
          shadowColor: "#14243A",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
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
          color: mz.navy,
          fontSize: 12,
          fontWeight: "800",
          letterSpacing: 0.5,
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
      placeholderTextColor="#9CA3AF"
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
      }}
    >
      <Text style={{ color: mz.onGold, fontWeight: "800", fontSize: 16 }}>{label}</Text>
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
        backgroundColor: active ? mz.navy : mz.white,
        borderWidth: 1,
        borderColor: active ? mz.navy : mz.border,
      }}
    >
      <Text style={{ color: active ? mz.white : mz.text, fontWeight: "700" }}>{label}</Text>
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
        <Text style={{ color: mz.navy, fontSize: 22, fontWeight: "800", letterSpacing: 0.2 }}>
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
      ? "#D1FAE5"
      : tone === "orange"
        ? "#FFEDD5"
        : tone === "rose"
          ? "#FEE2E2"
          : "#F3E8D0";
  const fg =
    tone === "teal"
      ? mz.green
      : tone === "orange"
        ? mz.orange
        : tone === "rose"
          ? mz.rose
          : mz.goldDim;
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
  actionLabel,
  onAction,
}: {
  title: string;
  note?: string;
  actionLabel?: string;
  onAction?: () => void;
}): React.JSX.Element {
  return (
    <MzCard style={{ alignItems: "center", paddingVertical: 32 }}>
      <Text style={{ color: mz.gold, fontSize: 36, marginBottom: 10 }}>◇</Text>
      <Text style={{ color: mz.navy, fontWeight: "800", fontSize: 16 }}>{title}</Text>
      {note ? (
        <Text
          style={{
            color: mz.muted,
            fontSize: 13,
            marginTop: 6,
            textAlign: "center",
            paddingHorizontal: 12,
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
            backgroundColor: mz.gold,
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
        backgroundColor: mz.navy,
        marginHorizontal: -16,
        marginTop: -4,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: mz.gold, fontSize: 22, fontWeight: "800" }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: "rgba(246,244,239,0.75)", fontSize: 12, marginTop: 3 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}
