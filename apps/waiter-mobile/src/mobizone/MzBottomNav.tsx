import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMz } from "./theme";

const TABS = [
  { href: "/mobizone-home", label: "Home", icon: "home-outline" as const, iconOn: "home" as const },
  { href: "/mobizone-stock", label: "Stock", icon: "cube-outline" as const, iconOn: "cube" as const },
  { href: "/mobizone-scan", label: "Scan", icon: "scan-outline" as const, iconOn: "scan" as const },
  { href: "/mobizone-sale", label: "Sell", icon: "cart-outline" as const, iconOn: "cart" as const },
  { href: "/mobizone-more", label: "More", icon: "menu-outline" as const, iconOn: "menu" as const },
] as const;

export function MzBottomNav(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const mz = useMz();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: mz.card,
        borderTopWidth: 1,
        borderTopColor: mz.border,
        paddingBottom: Math.max(insets.bottom, 6),
        paddingTop: 6,
      }}
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          pathname?.startsWith(`${tab.href}?`) ||
          (tab.href === "/mobizone-sale" && !!pathname?.includes("mobizone-sale")) ||
          (tab.href === "/mobizone-stock" && !!pathname?.includes("mobizone-stock")) ||
          (tab.href === "/mobizone-scan" && !!pathname?.includes("mobizone-scan")) ||
          (tab.href === "/mobizone-more" && !!pathname?.includes("mobizone-more")) ||
          (tab.href === "/mobizone-home" &&
            (!!pathname?.includes("mobizone-home") || pathname === "/"));
        const color = active ? mz.accent : mz.muted;

        return (
          <Pressable
            key={tab.href}
            onPress={() => router.replace(tab.href as never)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: "center",
              gap: 2,
              paddingVertical: 2,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            {active ? (
              <View
                style={{
                  position: "absolute",
                  top: -6,
                  width: 22,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: mz.accent,
                }}
              />
            ) : null}
            <Ionicons name={active ? tab.iconOn : tab.icon} size={21} color={color} />
            <Text
              style={{
                color,
                fontSize: 10,
                fontWeight: active ? "800" : "600",
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
