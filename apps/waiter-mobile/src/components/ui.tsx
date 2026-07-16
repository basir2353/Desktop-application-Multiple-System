import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const colors = {
  bg: "#0f172a",
  card: "#1e293b",
  border: "#334155",
  text: "#f8fafc",
  muted: "#94a3b8",
  accent: "#f59e0b",
  accentText: "#0f172a",
  success: "#22c55e",
  warning: "#fbbf24",
  danger: "#ef4444",
};

export function Screen({
  children,
  style,
  safeTop,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Extra top inset for screens without a stack header (e.g. home). */
  safeTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        safeTop ? { paddingTop: insets.top + 16 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Notice({ children, tone = "warning" }: { children: React.ReactNode; tone?: "warning" | "success" }) {
  return (
    <View style={[styles.notice, tone === "success" ? styles.noticeSuccess : styles.noticeWarning]}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.accentText : colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "ghost" && styles.buttonTextGhost,
            variant === "danger" && styles.buttonTextDanger,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Input({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, style]}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ready" || status === "completed" || status === "Paid"
      ? colors.success
      : status === "cooking" || status === "Cooking"
        ? "#38bdf8"
        : status === "held" || status === "On hold"
          ? colors.warning
          : colors.warning;
  return (
    <View style={[styles.badge, { borderColor: tone }]}>
      <Text style={[styles.badgeText, { color: tone }]}>{status}</Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function ActionTile({
  title,
  subtitle,
  onPress,
  icon,
  variant = "default",
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  icon: string;
  variant?: "default" | "primary";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        variant === "primary" && styles.actionTilePrimary,
        pressed && styles.actionTilePressed,
      ]}
    >
      <Text style={[styles.actionIcon, variant === "primary" && styles.actionIconPrimary]}>{icon}</Text>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, variant === "primary" && styles.actionTitlePrimary]}>{title}</Text>
        <Text style={[styles.actionSubtitle, variant === "primary" && styles.actionSubtitlePrimary]}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.actionChevron, variant === "primary" && styles.actionChevronPrimary]}>›</Text>
    </Pressable>
  );
}

export function SectionHeader({ title, actionLabel, onAction }: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  disabled,
  onPress,
  tone,
  sublabel,
  disabled,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** "mine" = booked by me (green), "locked" = booked by another waiter (red). */
  tone?: "mine" | "locked";
  sublabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        tone === "mine" && styles.chipMine,
        tone === "locked" && styles.chipLocked,
        selected && styles.chipSelected,
<<<<<<< Updated upstream
        selected && tone === "locked" && styles.chipSelectedLocked,
        pressed && styles.chipPressed,
        disabled && styles.chipDisabled,
=======
        disabled && styles.chipDisabled,
        pressed && !disabled && styles.chipPressed,
>>>>>>> Stashed changes
      ]}
    >
      <Text
        style={[
          styles.chipText,
<<<<<<< Updated upstream
          tone === "mine" && !selected && styles.chipTextMine,
          tone === "locked" && !selected && styles.chipTextLocked,
          selected && styles.chipTextSelected,
=======
          selected && styles.chipTextSelected,
          disabled && styles.chipTextDisabled,
>>>>>>> Stashed changes
        ]}
      >
        {label}
      </Text>
<<<<<<< Updated upstream
      {sublabel ? (
        <Text
          style={[
            styles.chipSublabel,
            tone === "mine" && !selected && styles.chipTextMine,
            tone === "locked" && !selected && styles.chipTextLocked,
            selected && styles.chipTextSelected,
          ]}
          numberOfLines={1}
        >
          {sublabel}
        </Text>
      ) : null}
=======
>>>>>>> Stashed changes
    </Pressable>
  );
}

export function QtyStepper({
  qty,
  onDecrement,
  onIncrement,
}: {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <View style={styles.qtyStepper}>
      <Pressable onPress={onDecrement} style={styles.qtyBtn} hitSlop={8}>
        <Text style={styles.qtyBtnText}>−</Text>
      </Pressable>
      <Text style={styles.qtyValue}>{qty}</Text>
      <Pressable onPress={onIncrement} style={[styles.qtyBtn, styles.qtyBtnAccent]} hitSlop={8}>
        <Text style={[styles.qtyBtnText, styles.qtyBtnTextAccent]}>+</Text>
      </Pressable>
    </View>
  );
}

export function LoginModeTabs({
  mode,
  onChange,
}: {
  mode: "password" | "pin";
  onChange: (mode: "password" | "pin") => void;
}) {
  const options: { id: "password" | "pin"; label: string; hint: string }[] = [
    { id: "password", label: "Sign In", hint: "Email & password" },
    { id: "pin", label: "Login with PIN", hint: "4-digit branch PIN" },
  ];

  return (
    <View style={styles.loginModeWrap}>
      <Label>Choose how to sign in</Label>
      <View style={styles.loginModeRow}>
        {options.map((option) => {
          const active = mode === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              style={[styles.loginModeTab, active && styles.loginModeTabActive]}
            >
              <Text style={[styles.loginModeLabel, active && styles.loginModeLabelActive]}>
                {option.label}
              </Text>
              <Text style={[styles.loginModeHint, active && styles.loginModeHintActive]}>
                {option.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PinPad({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (pin: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}) {
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

  function press(key: string): void {
    if (disabled) return;
    if (key === "clear") {
      onChange("");
      return;
    }
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= 4) return;
    const next = value + key;
    onChange(next);
    if (next.length === 4) onSubmit?.();
  }

  return (
    <View style={styles.pinPad}>
      <View style={styles.pinDots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.pinDot, value.length > i && styles.pinDotFilled]} />
        ))}
      </View>
      <View style={styles.pinGrid}>
        {digits.map((key) => (
          <Pressable
            key={key}
            onPress={() => press(key)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.pinKey,
              key === "clear" || key === "back" ? styles.pinKeyWide : null,
              pressed && !disabled && styles.pinKeyPressed,
            ]}
          >
            <Text style={styles.pinKeyText}>
              {key === "clear" ? "C" : key === "back" ? "⌫" : key}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function CategoryHeading({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.categoryHeading}>
      <View style={styles.categoryAccent} />
      <Text style={styles.categoryTitle}>{title}</Text>
      {count != null ? <Text style={styles.categoryCount}>{count}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
  notice: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  noticeWarning: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.35)",
  },
  noticeSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  noticeText: {
    color: colors.text,
    fontSize: 13,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.accentText,
    fontSize: 15,
    fontWeight: "600",
  },
  buttonTextGhost: {
    color: colors.text,
  },
  buttonTextDanger: {
    color: colors.danger,
  },
  input: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  statCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#020617",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  statHint: {
    color: colors.muted,
    fontSize: 11,
  },
  actionTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  actionTilePrimary: {
    backgroundColor: colors.accent,
    borderColor: "#d97706",
  },
  actionTilePressed: {
    opacity: 0.88,
  },
  actionIcon: {
    fontSize: 24,
    width: 32,
    textAlign: "center",
  },
  actionIconPrimary: {
    color: colors.accentText,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  actionTitlePrimary: {
    color: colors.accentText,
  },
  actionSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionSubtitlePrimary: {
    color: "rgba(15, 23, 42, 0.75)",
  },
  actionChevron: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: "300",
  },
  actionChevronPrimary: {
    color: colors.accentText,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionAction: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 12,
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyMessage: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#0b1220",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: "#d97706",
  },
<<<<<<< Updated upstream
  chipSelectedLocked: {
    backgroundColor: "#dc2626",
    borderColor: "#b91c1c",
  },
  chipMine: {
    borderColor: "rgba(34, 197, 94, 0.55)",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  chipLocked: {
    borderColor: "rgba(248, 113, 113, 0.55)",
    backgroundColor: "rgba(248, 113, 113, 0.12)",
=======
  chipDisabled: {
    opacity: 0.45,
    borderColor: "#7f1d1d",
    backgroundColor: "#3f1515",
>>>>>>> Stashed changes
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: colors.accentText,
  },
<<<<<<< Updated upstream
  chipTextMine: {
    color: "#4ade80",
  },
  chipTextLocked: {
    color: "#f87171",
  },
  chipSublabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
    maxWidth: 110,
=======
  chipTextDisabled: {
    color: "#fca5a5",
>>>>>>> Stashed changes
  },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnAccent: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.45)",
  },
  qtyBtnText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 20,
  },
  qtyBtnTextAccent: {
    color: colors.accent,
  },
  qtyValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
  categoryHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  categoryAccent: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  categoryTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  categoryCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  pinPad: {
    gap: 16,
    alignItems: "center",
  },
  pinDots: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 8,
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    maxWidth: 280,
  },
  pinKey: {
    width: 72,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "center",
  },
  pinKeyWide: {
    width: 72,
  },
  pinKeyPressed: {
    opacity: 0.85,
    backgroundColor: "#1e293b",
  },
  pinKeyText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
  },
  loginModeWrap: {
    gap: 8,
  },
  loginModeRow: {
    flexDirection: "row",
    gap: 8,
  },
  loginModeTab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#020617",
    alignItems: "center",
    gap: 4,
  },
  loginModeTabActive: {
    borderColor: colors.accent,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  loginModeLabel: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  loginModeLabelActive: {
    color: colors.text,
  },
  loginModeHint: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
  },
  loginModeHintActive: {
    color: colors.accent,
  },
});
