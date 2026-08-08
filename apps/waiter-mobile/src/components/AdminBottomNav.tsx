import { useRouter, usePathname } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "./ui";
import { useThemedStyleSheet } from "../theme/useThemedStyleSheet";

export type AdminTab = "home" | "orders" | "menu" | "tax" | "more";

const TABS: Array<{ id: AdminTab; label: string; icon: string; href: string }> = [
  { id: "home", label: "Home", icon: "⌂", href: "/admin-home" },
  { id: "orders", label: "Orders", icon: "≡", href: "/admin-orders" },
  { id: "menu", label: "Menu", icon: "☰", href: "/admin-menu" },
  { id: "tax", label: "Tax", icon: "₨", href: "/admin-tax" },
  { id: "more", label: "More", icon: "···", href: "/admin-more" },
];

const MORE_ROUTES = [
  "/admin-more",
  "/admin-sales",
  "/admin-reports",
  "/admin-payout",
  "/admin-cash",
  "/admin-vendors",
  "/admin-ledger",
  "/admin-users",
  "/admin-activity",
  "/admin-tables",
  "/admin-kitchen",
  "/admin-inventory",
  "/admin-pra",
  "/printers",
];

export function resolveAdminTab(pathname: string): AdminTab {
  if (pathname.includes("admin-orders")) return "orders";
  if (pathname.includes("admin-menu")) return "menu";
  if (pathname.includes("admin-tax") || pathname.includes("admin-pra")) return "tax";
  if (MORE_ROUTES.some((r) => pathname.includes(r.replace("/", "")))) return "more";
  if (pathname.includes("admin-home")) return "home";
  return "home";
}

export function AdminBottomNav({ active }: { active?: AdminTab }) {
  const styles = useScreenStyles();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const current = active ?? resolveAdminTab(pathname);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        {TABS.map((tab) => {
          const selected = current === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                if (selected) return;
                router.replace(tab.href as never);
              }}
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
            >
              <View style={[styles.iconWrap, selected && styles.iconWrapActive]}>
                <Text style={[styles.icon, selected && styles.iconActive]}>{tab.icon}</Text>
              </View>
              <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function AdminShell({
  children,
  tab,
  noPadding,
}: {
  children: React.ReactNode;
  tab?: AdminTab;
  /** When true, leave horizontal padding to the screen itself. */
  noPadding?: boolean;
}) {
  const styles = useScreenStyles();
  return (
    <View style={styles.shell}>
      <View style={[styles.body, noPadding ? null : styles.bodyPad]}>{children}</View>
      <AdminBottomNav active={tab} />
    </View>
  );
}


function useScreenStyles() {
  return useThemedStyleSheet((c) => ({

  shell: {
    flex: 1,
    backgroundColor: c.bg,
  },
  body: {
    flex: 1,
  },
  bodyPad: {
    paddingHorizontal: 16,
  },
  wrap: {
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.bg,
    paddingTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  tabPressed: {
    opacity: 0.75,
  },
  iconWrap: {
    width: 36,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(15, 118, 110, 0.22)",
  },
  icon: {
    color: c.muted,
    fontSize: 16,
    fontWeight: "700",
  },
  iconActive: {
    color: c.accentSoft,
  },
  label: {
    color: c.muted,
    fontSize: 10,
    fontWeight: "600",
  },
  labelActive: {
    color: c.accentSoft,
  },

  }));
}

