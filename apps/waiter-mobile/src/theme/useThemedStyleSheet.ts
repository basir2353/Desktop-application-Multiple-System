import { useMemo, useRef } from "react";
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { useThemeStore, colorsForMode } from "../stores/themeStore";
import type { AppColors } from "./palettes";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Rebuild StyleSheet when theme mode changes so module-level color baking is avoided.
 * Factory should only depend on the colors argument (not outer changing values).
 */
export function useThemedStyleSheet<T extends NamedStyles<T>>(
  factory: (c: AppColors) => T | NamedStyles<T>,
): T {
  const mode = useThemeStore((s) => s.mode);
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  return useMemo(
    () => StyleSheet.create(factoryRef.current(colorsForMode(mode))) as T,
    [mode],
  );
}
