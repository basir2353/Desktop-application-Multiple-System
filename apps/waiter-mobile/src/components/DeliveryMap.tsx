import { useMemo } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "./ui";

type Props = {
  address: string;
  /** Optional label above the map (default: Map). */
  title?: string;
  height?: number;
};

/** Build a Maps query that prefers the given delivery address (never device GPS). */
export function mapsDestinationQuery(address: string): string {
  let q = address.trim().replace(/\s+/g, " ");
  if (!q) return "";
  // Phone-only strings are not destinations — reject for map use.
  if (/^\+?\d[\d\s()-]{5,}$/.test(q) && !/[a-zA-Z\u0600-\u06FF]{2,}/.test(q)) {
    return "";
  }
  // Help geocoder resolve Pakistani localities (e.g. Toba Tek Singh / chak numbers).
  if (!/pakistan/i.test(q)) {
    q = `${q}, Pakistan`;
  }
  return q;
}

function mapsSearchUrl(address: string): string {
  const q = mapsDestinationQuery(address) || address.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function mapsDirectionsUrl(address: string): string {
  const q = mapsDestinationQuery(address) || address.trim();
  // destination= forces navigation to the order address (not current phone location as destination).
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`;
}

/** In-app Google Maps embed pinned to the delivery address query. */
function mapsEmbedHtml(address: string): string {
  const q = encodeURIComponent(mapsDestinationQuery(address) || address.trim());
  // Explicit search embed — does not follow device geolocation as the pin.
  const src = `https://maps.google.com/maps?q=${q}&hl=en&z=16&output=embed`;
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html,body{margin:0;padding:0;height:100%;background:#0B1220;}
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
 * Always maps the provided delivery address — never the phone GPS as destination.
 */
export function DeliveryMap({ address, title = "Google Maps", height = 220 }: Props): JSX.Element | null {
  const trimmed = address.trim();
  const query = mapsDestinationQuery(trimmed);
  const embedHtml = useMemo(() => (trimmed ? mapsEmbedHtml(trimmed) : ""), [trimmed]);

  if (!trimmed || trimmed.toLowerCase() === "n/a" || trimmed === "—") return null;

  if (!query) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.address}>{trimmed}</Text>
        <Text style={styles.warn}>
          This looks like a phone number, not a delivery address. Add a street / area address on the order so the map
          can open the correct location.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.mapFrame, { height }]}>
        <WebView
          key={query}
          originWhitelist={["*"]}
          source={{ html: embedHtml }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          geolocationEnabled={false}
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
    backgroundColor: colors.bg,
  },
  webview: { flex: 1, backgroundColor: "transparent" },
  address: { color: colors.text, fontSize: 14, lineHeight: 20 },
  warn: { color: colors.warning, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: colors.accentText, fontWeight: "800", fontSize: 14 },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  btnGhostText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  pressed: { opacity: 0.85 },
});
