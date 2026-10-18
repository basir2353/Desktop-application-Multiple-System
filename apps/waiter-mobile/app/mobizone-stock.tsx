import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

export default function MobizoneStockScreen(): React.JSX.Element {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { db } = useMobizoneDb();
  const [q, setQ] = useState("");

  const stock = useMemo(() => {
    const rows = db.devices.filter((d) => d.status === "in_stock");
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (d) =>
        d.brand.toLowerCase().includes(needle) ||
        d.model.toLowerCase().includes(needle) ||
        d.imei.toLowerCase().includes(needle),
    );
  }, [db.devices, q]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: mz.gold, fontSize: 20, fontWeight: "800" }}>Stock</Text>
          <Pressable
            onPress={() => router.push("/mobizone-purchase" as never)}
            style={{
              backgroundColor: mz.gold,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: mz.bg, fontWeight: "800", fontSize: 12 }}>Add Stock</Text>
          </Pressable>
        </View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search brand, model, IMEI"
          placeholderTextColor={mz.muted}
          style={inputStyle}
        />
        <Text style={{ color: mz.muted, fontSize: 12 }}>{stock.length} phones in stock</Text>
        {stock.length === 0 ? (
          <Text style={{ color: mz.muted }}>No stock yet — record a purchase</Text>
        ) : (
          stock.map((d) => (
            <View
              key={d.id}
              style={{
                backgroundColor: mz.card,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: mz.border,
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: mz.cardSoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: mz.blue, fontWeight: "800", fontSize: 11 }}>IMEI</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: mz.text, fontWeight: "700" }}>
                  {d.brand} {d.model}
                </Text>
                <Text style={{ color: mz.muted, fontSize: 12 }}>
                  IMEI {d.imei} · {d.condition}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: mz.gold, fontWeight: "800" }}>
                  {formatPkr(d.salePricePkr ?? d.purchasePricePkr)}
                </Text>
                <Text style={{ color: mz.muted, fontSize: 11 }}>
                  Cost {formatPkr(d.purchasePricePkr)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </MzShell>
  );
}

const inputStyle = {
  backgroundColor: mz.card,
  borderWidth: 1,
  borderColor: mz.border,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: mz.text,
  fontSize: 15,
} as const;
