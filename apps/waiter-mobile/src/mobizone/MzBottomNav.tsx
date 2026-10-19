import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Pic footer: Home · Stock · Sales · Customers · More — drawn icons (no font deps). */
const TABS = [
  { href: "/mobizone-home", label: "Home", kind: "home" as const },
  { href: "/mobizone-stock", label: "Stock", kind: "stock" as const },
  { href: "/mobizone-sale", label: "Sales", kind: "sales" as const },
  { href: "/mobizone-customers", label: "Customers", kind: "customers" as const },
  { href: "/mobizone-more", label: "More", kind: "more" as const },
] as const;

const ACTIVE = "#1B5E3B";
const INACTIVE = "#5F6368";

export function MzBottomNav(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 10,
      }}
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          pathname?.startsWith(`${tab.href}?`) ||
          (tab.href === "/mobizone-sale" && !!pathname?.includes("mobizone-sale")) ||
          (tab.href === "/mobizone-stock" && !!pathname?.includes("mobizone-stock")) ||
          (tab.href === "/mobizone-customers" && !!pathname?.includes("mobizone-customers")) ||
          (tab.href === "/mobizone-more" && !!pathname?.includes("mobizone-more")) ||
          (tab.href === "/mobizone-home" &&
            (!!pathname?.includes("mobizone-home") || pathname === "/"));
        const color = active ? ACTIVE : INACTIVE;

        return (
          <Pressable
            key={tab.href}
            onPress={() => router.replace(tab.href as never)}
            style={{ flex: 1, alignItems: "center", gap: 5, paddingVertical: 2 }}
          >
            <TabIcon kind={tab.kind} color={color} active={active} />
            <Text
              style={{
                color,
                fontSize: 11,
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

function TabIcon({
  kind,
  color,
  active,
}: {
  kind: (typeof TABS)[number]["kind"];
  color: string;
  active: boolean;
}): React.JSX.Element {
  if (kind === "home") return <HomeIcon color={color} />;
  if (kind === "stock") return <CubeIcon color={color} />;
  if (kind === "sales") return <DocIcon color={color} active={active} />;
  if (kind === "customers") return <PeopleIcon color={color} />;
  return <MoreIcon color={color} />;
}

/** House outline — matches pic Home */
function HomeIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={{ width: 26, height: 24, alignItems: "center", justifyContent: "flex-end" }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 12,
          borderRightWidth: 12,
          borderBottomWidth: 10,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          marginBottom: -1,
        }}
      />
      <View
        style={{
          width: 18,
          height: 12,
          borderWidth: 2,
          borderTopWidth: 0,
          borderColor: color,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          width: 6,
          height: 7,
          borderWidth: 2,
          borderBottomWidth: 0,
          borderColor: color,
          backgroundColor: "#FFFFFF",
        }}
      />
    </View>
  );
}

/** 3D cube / box outline — matches pic Stock */
function CubeIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={{ width: 26, height: 24, alignItems: "center", justifyContent: "center" }}>
      {/* top face */}
      <View
        style={{
          width: 14,
          height: 8,
          borderWidth: 2,
          borderColor: color,
          borderBottomWidth: 0,
          transform: [{ rotate: "0deg" }, { skewX: "-20deg" }],
          marginBottom: -1,
        }}
      />
      <View style={{ flexDirection: "row" }}>
        {/* left face */}
        <View
          style={{
            width: 11,
            height: 12,
            borderWidth: 2,
            borderColor: color,
            borderRightWidth: 1,
          }}
        />
        {/* right face */}
        <View
          style={{
            width: 11,
            height: 12,
            borderWidth: 2,
            borderColor: color,
            borderLeftWidth: 1,
            marginLeft: -1,
          }}
        />
      </View>
    </View>
  );
}

/** Document with fold — solid green when active (pic Sales) */
function DocIcon({ color, active }: { color: string; active: boolean }): React.JSX.Element {
  if (active) {
    return (
      <View
        style={{
          width: 20,
          height: 24,
          backgroundColor: color,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderLeftWidth: 7,
            borderBottomWidth: 7,
            borderLeftColor: "transparent",
            borderBottomColor: "rgba(255,255,255,0.35)",
          }}
        />
        <View
          style={{
            marginTop: 9,
            marginHorizontal: 4,
            height: 2,
            backgroundColor: "rgba(255,255,255,0.85)",
            borderRadius: 1,
          }}
        />
        <View
          style={{
            marginTop: 3,
            marginHorizontal: 4,
            height: 2,
            backgroundColor: "rgba(255,255,255,0.85)",
            borderRadius: 1,
          }}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        width: 20,
        height: 24,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 2,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -2,
          right: -2,
          width: 0,
          height: 0,
          borderLeftWidth: 7,
          borderBottomWidth: 7,
          borderLeftColor: "transparent",
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          marginTop: 9,
          marginHorizontal: 3,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      <View
        style={{
          marginTop: 3,
          marginHorizontal: 3,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

/** Two people outlines — matches pic Customers */
function PeopleIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View style={{ width: 28, height: 24, flexDirection: "row", alignItems: "flex-end" }}>
      <View style={{ alignItems: "center", zIndex: 2 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: color,
          }}
        />
        <View
          style={{
            width: 14,
            height: 9,
            borderTopLeftRadius: 7,
            borderTopRightRadius: 7,
            borderWidth: 2,
            borderBottomWidth: 0,
            borderColor: color,
            marginTop: 1,
          }}
        />
      </View>
      <View style={{ alignItems: "center", marginLeft: -4, opacity: 0.9 }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: color,
          }}
        />
        <View
          style={{
            width: 12,
            height: 8,
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            borderWidth: 2,
            borderBottomWidth: 0,
            borderColor: color,
            marginTop: 1,
          }}
        />
      </View>
    </View>
  );
}

/** Three horizontal dots — matches pic More */
function MoreIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <View
      style={{
        width: 26,
        height: 24,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}
