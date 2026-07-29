import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { currentBusinessDateKey, shiftDateKeyForRange } from "../lib/dateRange";
import { colors, Label } from "./ui";

export type DateRangeValue = { from: string; to: string };

type Props = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
};

const PRESETS: { id: string; label: string; range: () => DateRangeValue }[] = [
  {
    id: "today",
    label: "Today",
    range: () => {
      const d = currentBusinessDateKey();
      return { from: d, to: d };
    },
  },
  {
    id: "7d",
    label: "7 days",
    range: () => {
      const to = currentBusinessDateKey();
      return { from: shiftDateKeyForRange(to, -6), to };
    },
  },
  {
    id: "month",
    label: "This month",
    range: () => {
      const to = currentBusinessDateKey();
      return { from: `${to.slice(0, 7)}-01`, to };
    },
  },
];

/** Shared date-to-date filter for Admin reports. */
export function DateRangeFilter({ value, onChange }: Props) {
  const [editing, setEditing] = useState<"from" | "to" | null>(null);
  const activePreset = useMemo(() => {
    return PRESETS.find((p) => {
      const r = p.range();
      return r.from === value.from && r.to === value.to;
    })?.id;
  }, [value.from, value.to]);

  return (
    <View style={{ gap: 10 }}>
      <Label>Date range (day to day)</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PRESETS.map((p) => {
          const on = activePreset === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => onChange(p.range())}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: on ? colors.accent : colors.border,
                backgroundColor: on ? colors.accent : "transparent",
              }}
            >
              <Text
                style={{
                  color: on ? colors.accentText : colors.text,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>From (YYYY-MM-DD)</Text>
          <TextInput
            value={value.from}
            onChangeText={(t) => onChange({ ...value, from: t.trim() })}
            onFocus={() => setEditing("from")}
            onBlur={() => setEditing(null)}
            placeholder="2026-07-01"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: editing === "from" ? colors.accent : colors.border,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 10,
              color: colors.text,
              backgroundColor: colors.card,
              fontSize: 14,
            }}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>To (YYYY-MM-DD)</Text>
          <TextInput
            value={value.to}
            onChangeText={(t) => onChange({ ...value, to: t.trim() })}
            onFocus={() => setEditing("to")}
            onBlur={() => setEditing(null)}
            placeholder="2026-07-28"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: editing === "to" ? colors.accent : colors.border,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 10,
              color: colors.text,
              backgroundColor: colors.card,
              fontSize: 14,
            }}
          />
        </View>
      </View>
    </View>
  );
}

export function defaultDateRange(): DateRangeValue {
  const d = currentBusinessDateKey();
  return { from: d, to: d };
}
