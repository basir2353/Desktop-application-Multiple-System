import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "./ui";

type Props = {
  address: string;
  /** Optional label above the map (default: Map). */
  title?: string;
  height?: number;
};

function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}&travelmode=driving`;
}

/** In-app Google Maps embed (no API key required for search embed). */
function mapsEmbedHtml(address: string): string {
  const q = encodeURIComponent(address.trim());
  // Google Maps embed via search query — works in WebView without a Maps SDK key.
  const src = `https://maps.google.com/maps?q=${q}&z=15&output=embed`;
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html,body{margin:0;padding:0;height:100%;background:#0f172a;}
  iframe{border:0;width:100%;height:100%;}
</style>
</head><body>
<iframe
  src="${src}"
  allowfullscreen
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>
</body></html>`;
}

async function openExternal(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // ignore — device may not have a browser / maps app
  }
}

/**
 * Google Maps panel for delivery addresses (rider + waiter delivery flow).
 * Shows an embedded map and opens Google Maps for navigation.
 */
export function DeliveryMap({ address, title = "Google Maps", height = 220 }: Props): JSX.Element | null {
  const trimmed = address.trim();
  if (!trimmed || trimmed.toLowerCase() === "n/a" || trimmed === "—") return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.mapFrame, { height }]}>
        <WebView
          originWhitelist={["*"]}
          source={{ html: mapsEmbedHtml(trimmed) }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          startInLoadingState
        />
      </View>
      <Text style={styles.address} numberOfLines={3}>
        {trimmed}
      </Text>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
          onPress={() => void openExternal(mapsDirectionsUrl(trimmed))}
        >
          <Text style={styles.btnPrimaryText}>Navigate</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
          onPress={() => void openExternal(mapsSearchUrl(trimmed))}
        >
          <Text style={styles.btnGhostText}>
            {Platform.OS === "ios" ? "Open Maps" : "Open in Google Maps"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  title: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mapFrame: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#0f172a",
  },
  webview: { flex: 1, backgroundColor: "transparent" },
  address: { color: colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: "#0f172a", fontWeight: "800", fontSize: 14 },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  btnGhostText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  pressed: { opacity: 0.85 },
});
