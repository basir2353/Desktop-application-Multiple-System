import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr } from "../src/mobizone/storeCore";
import { mz } from "../src/mobizone/theme";
import {
  MzBadge,
  MzCard,
  MzEmpty,
  MzInput,
  MzScreenTitle,
} from "../src/mobizone/ui";
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

  const newCount = stock.filter((d) => d.condition === "new").length;
  const usedCount = stock.length - newCount;

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 28 }}>
        <MzScreenTitle
          title="Stock"
          subtitle={`${stock.length} in stock · New ${newCount} · Used ${usedCount}`}
          right={
            <Pressable
              onPress={() => router.push("/mobizone-purchase" as never)}
              style={{
                backgroundColor: mz.accent,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: mz.onGold, fontWeight: "800", fontSize: 12 }}>+ Add</Text>
            </Pressable>
          }
        />

        <MzInput
          value={q}
          onChangeText={setQ}
          placeholder="Type / USB-scan IMEI, brand, model"
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: undefined }}
        />
        <Text style={{ color: mz.muted, fontSize: 11, lineHeight: 15 }}>
          IMEI search: type or hardware scanner. Camera permission sirf tab jab aap alag se camera scan
          choose karein (purchase pe camera forced nahi).
        </Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatPill label="In stock" value={String(stock.length)} />
          <StatPill label="New" value={String(newCount)} />
          <StatPill label="Used" value={String(usedCount)} />
        </View>

        {stock.length === 0 ? (
          <MzEmpty title="No stock yet" note="Purchase se phone add karein" />
        ) : (
          stock.map((d) => (
            <MzCard
              key={d.id}
              style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 14 }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: mz.ink,
                  borderWidth: 1,
                  borderColor: mz.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 10 }}>PHONE</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: mz.ink, fontWeight: "800", flexShrink: 1 }}>
                    {d.brand} {d.model}
                  </Text>
                  <MzBadge
                    label={d.condition}
                    tone={d.condition === "new" ? "teal" : "orange"}
                  />
                </View>
                <Text style={{ color: mz.muted, fontSize: 12, marginTop: 4 }}>
                  IMEI {d.imei}
                  {d.colour ? ` · ${d.colour}` : ""}
                  {d.storage ? ` · ${d.storage}` : ""}
                </Text>
                <Text style={{ color: mz.muted, fontSize: 11, marginTop: 2 }}>
                  Cost {formatPkr(d.purchasePricePkr)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: mz.accent, fontWeight: "800" }}>
                  {formatPkr(d.salePricePkr ?? d.purchasePricePkr)}
                </Text>
                <Text style={{ color: mz.muted, fontSize: 10, marginTop: 2 }}>sale</Text>
              </View>
            </MzCard>
          ))
        )}
      </ScrollView>
    </MzShell>
  );
}

function StatPill({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: mz.card,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: mz.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: mz.muted, fontSize: 10, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: mz.navy, fontWeight: "800", fontSize: 16, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
