import { useMemo } from "react";
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
import { colorsForMode, getColors, useThemeStore } from "../stores/themeStore";
import type { AppColors } from "../theme/palettes";
export type { AppColors } from "../theme/palettes";
export { useThemedStyleSheet } from "../theme/useThemedStyleSheet";

/** Live palette — reads current theme (works for inline style objects on re-render). */
export const colors: AppColors = new Proxy({} as AppColors, {
  get(_t, prop: string | symbol) {
    return getColors()[prop as keyof AppColors];
  },
});

export function useColors(): AppColors {
  const mode = useThemeStore((s) => s.mode);
  return colorsForMode(mode);
}

function useUiStyles() {
  const mode = useThemeStore((s) => s.mode);
  return useMemo(() => makeStyles(colorsForMode(mode)), [mode]);
}

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
  const styles = useUiStyles();
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
  const styles = useUiStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  const styles = useUiStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const styles = useUiStyles();
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  const styles = useUiStyles();
  return <Text style={styles.label}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  const styles = useUiStyles();
  return <Text style={styles.muted}>{children}</Text>;
}

export function Notice({ children, tone = "warning" }: { children: React.ReactNode; tone?: "warning" | "success" }) {
  const styles = useUiStyles();
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
  const styles = useUiStyles();
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
  const styles = useUiStyles();
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, style]}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles = useUiStyles();
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
  const styles = useUiStyles();
  const text = String(value);
  const compact = text.length > 8;
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text
        style={[styles.statValue, compact ? styles.statValueCompact : null, accent ? { color: accent } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {text}
      </Text>
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
  const styles = useUiStyles();
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
  const styles = useUiStyles();
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
  const styles = useUiStyles();
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
  onPress,
  tone,
  sublabel,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  /** "mine" = booked by me (green), "locked" = booked by another waiter (red). */
  tone?: "mine" | "locked";
  sublabel?: string;
  disabled?: boolean;
}) {
  const styles = useUiStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        tone === "mine" && styles.chipMine,
        tone === "locked" && styles.chipLocked,
        selected && styles.chipSelected,
        selected && tone === "locked" && styles.chipSelectedLocked,
        pressed && !disabled && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          tone === "mine" && !selected && styles.chipTextMine,
          tone === "locked" && !selected && styles.chipTextLocked,
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
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
    </Pressable>
  );
}

export function QtyStepper({
  qty,
  onDecrement,
  onIncrement,
  minQty = 0,
  decrementDisabled,
}: {
  qty: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Soft floor — decrement disabled at or below this qty. */
  minQty?: number;
  decrementDisabled?: boolean;
}) {
  const styles = useUiStyles();
  const locked = Boolean(decrementDisabled) || qty <= minQty;
  return (
    <View style={styles.qtyStepper}>
      <Pressable
        onPress={onDecrement}
        disabled={locked}
        style={[styles.qtyBtn, locked && styles.qtyBtnDisabled]}
        hitSlop={8}
      >
        <Text style={[styles.qtyBtnText, locked && styles.qtyBtnTextDisabled]}>−</Text>
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
  const styles = useUiStyles();
  const options: { id: "password" | "pin"; label: string; hint: string }[] = [
    { id: "password", label: "Email", hint: "Email & password" },
    { id: "pin", label: "PIN", hint: "4-digit branch PIN" },
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
  const styles = useUiStyles();
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
  const styles = useUiStyles();
  return (
    <View style={styles.categoryHeading}>
      <View style={styles.categoryAccent} />
      <Text style={styles.categoryTitle}>{title}</Text>
      {count != null ? <Text style={styles.categoryCount}>{count}</Text> : null}
    </View>
  );
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    gap: 8,
  },
  title: {
    color: c.text,
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: c.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  muted: {
    color: c.muted,
    fontSize: 13,
  },
  notice: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  noticeWarning: {
    backgroundColor: "rgba(15, 118, 110, 0.12)",
    borderColor: "rgba(20, 184, 166, 0.35)",
  },
  noticeSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderColor: "rgba(34, 197, 94, 0.35)",
  },
  noticeText: {
    color: c.text,
    fontSize: 13,
  },
  button: {
    backgroundColor: c.accent,
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
    borderColor: c.border,
  },
  buttonDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: c.danger,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: c.accentText,
    fontSize: 15,
    fontWeight: "600",
  },
  buttonTextGhost: {
    color: c.text,
  },
  buttonTextDanger: {
    color: c.danger,
  },
  input: {
    backgroundColor: c.bgDeep,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    color: c.text,
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
    backgroundColor: c.bgDeep,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    gap: 4,
  },
  statLabel: {
    color: c.muted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  statValue: {
    color: c.text,
    fontSize: 22,
    fontWeight: "700",
  },
  statValueCompact: {
    fontSize: 15,
  },
  statHint: {
    color: c.muted,
    fontSize: 11,
  },
  actionTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
  },
  actionTilePrimary: {
    backgroundColor: c.accent,
    borderColor: c.accentSoft,
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
    color: c.accentText,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: "700",
  },
  actionTitlePrimary: {
    color: c.accentText,
  },
  actionSubtitle: {
    color: c.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionSubtitlePrimary: {
    color: "rgba(240, 253, 250, 0.78)",
  },
  actionChevron: {
    color: c.muted,
    fontSize: 24,
    fontWeight: "300",
  },
  actionChevronPrimary: {
    color: c.accentText,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionAction: {
    color: c.accent,
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
    color: c.text,
    fontSize: 15,
    fontWeight: "600",
  },
  emptyMessage: {
    color: c.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bg,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: c.accent,
    borderColor: c.accentSoft,
  },
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
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipDisabled: {
    opacity: 0.55,
  },
  chipText: {
    color: c.text,
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: c.accentText,
  },
  chipTextMine: {
    color: "#4ade80",
  },
  chipTextLocked: {
    color: "#f87171",
  },
  chipSublabel: {
    fontSize: 10,
    fontWeight: "600",
    color: c.muted,
    marginTop: 2,
    maxWidth: 110,
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
    borderColor: c.border,
    backgroundColor: c.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnAccent: {
    backgroundColor: "rgba(15, 118, 110, 0.2)",
    borderColor: "rgba(20, 184, 166, 0.45)",
  },
  qtyBtnDisabled: {
    opacity: 0.35,
  },
  qtyBtnText: {
    color: c.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 20,
  },
  qtyBtnTextDisabled: {
    color: c.muted,
  },
  qtyBtnTextAccent: {
    color: c.accent,
  },
  qtyValue: {
    color: c.text,
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
    backgroundColor: c.accent,
  },
  categoryTitle: {
    flex: 1,
    color: c.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  categoryCount: {
    color: c.muted,
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
    borderColor: c.border,
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    backgroundColor: c.accent,
    borderColor: c.accent,
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
    borderColor: c.border,
    backgroundColor: c.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  pinKeyWide: {
    width: 72,
  },
  pinKeyPressed: {
    opacity: 0.85,
    backgroundColor: c.card,
  },
  pinKeyText: {
    color: c.text,
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
    borderColor: c.border,
    backgroundColor: c.bgDeep,
    alignItems: "center",
    gap: 4,
  },
  loginModeTabActive: {
    borderColor: c.accentSoft,
    backgroundColor: "rgba(15, 118, 110, 0.2)",
  },
  loginModeLabel: {
    color: c.muted,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  loginModeLabelActive: {
    color: c.text,
  },
  loginModeHint: {
    color: c.muted,
    fontSize: 11,
    textAlign: "center",
  },
  loginModeHintActive: {
    color: c.accent,
  },
});
}
