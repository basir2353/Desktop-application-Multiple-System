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
        backgroundColor: mz.navyDeep,
        borderTopWidth: 1,
        borderTopColor: mz.border,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 10,
      }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}?`);
        return (
          <Pressable
            key={tab.href}
            onPress={() => router.replace(tab.href as never)}
            style={{ flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 }}
          >
            <View
              style={{
                width: 36,
                height: 28,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? "rgba(185,150,83,0.18)" : "transparent",
              }}
            >
              <Text style={{ color: active ? mz.goldBright : mz.muted, fontSize: 17 }}>
                {tab.icon}
              </Text>
            </View>
            <Text
              style={{
                color: active ? mz.goldBright : mz.muted,
                fontSize: 10,
                fontWeight: active ? "800" : "500",
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
