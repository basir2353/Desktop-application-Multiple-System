import { Pressable, Text, StyleSheet } from "react-native";
import { useThemeStore, colorsForMode } from "../stores/themeStore";

export function ThemeToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const c = colorsForMode(mode);
  const dim = size === "sm" ? 34 : 40;

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: c.card,
          borderColor: c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.icon, { color: c.text, fontSize: size === "sm" ? 15 : 17 }]}>
        {mode === "dark" ? "☀" : "☾"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontWeight: "600",
    lineHeight: 20,
  },
});
