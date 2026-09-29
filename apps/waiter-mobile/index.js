/**
 * Custom entry — do not use bare `expo-router/entry`.
 *
 * On some Android OEMs (TECNO / MediaTek), Expo Router's NavigationContainer stays on
 * `fallback={null}` while `Linking.getInitialURL()` is unresolved. That paints an empty
 * white FrameLayout under android:id/content even though JS is running ("main" registered).
 *
 * We (1) race getInitialURL so linking cannot hang, and (2) wrap App in a non-collapsible
 * dark root View so the first paint is never an empty Light AppTheme window.
 */
import "@expo/metro-runtime";
import React from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";

if (Platform.OS === "android") {
  const nativeGetInitialURL = Linking.getInitialURL.bind(Linking);
  Linking.getInitialURL = () =>
    Promise.race([
      Promise.resolve()
        .then(() => nativeGetInitialURL())
        .catch(() => null),
      // Hard cap — RN/expo-router also race at 150ms; keep ours shorter as a belt-and-suspenders.
      new Promise((resolve) => {
        setTimeout(() => resolve(null), 80);
      }),
    ]);
}

function BootShell() {
  // Diagnostic marker for logcat (ReactNativeJS). Survives Hermes minify as a string literal.
  console.log("Running main");
  return (
    <View style={styles.root} collapsable={false}>
      <App />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
});

renderRootComponent(BootShell);
