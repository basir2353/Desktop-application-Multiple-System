import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mz } from "./theme";

const TABS = [
  { href: "/mobizone-home", label: "Home", icon: "⌂" },
  { href: "/mobizone-sale", label: "Sales", icon: "↗" },
  { href: "/mobizone-purchase", label: "Purchase", icon: "↙" },
  { href: "/mobizone-customers", label: "Customers", icon: "◉" },
  { href: "/mobizone-more", label: "More", icon: "☰" },
] as const;

export function MzBottomNav(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: mz.surface,
        borderTopWidth: 1,
        borderTopColor: mz.border,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}?`);
        return (
          <Pressable
            key={tab.href}
            onPress={() => router.replace(tab.href as never)}
            style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: 4 }}
          >
            <Text style={{ color: active ? mz.gold : mz.muted, fontSize: 18 }}>{tab.icon}</Text>
            <Text
              style={{
                color: active ? mz.gold : mz.muted,
                fontSize: 10,
                fontWeight: active ? "700" : "500",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
