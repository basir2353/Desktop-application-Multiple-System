import type { ReactNode } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MzBottomNav } from "./MzBottomNav";
import { mz } from "./theme";
import { useMobizoneDb } from "./useMobizone";

export function MzShell({ children }: { children: ReactNode }): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { ready } = useMobizoneDb();

  return (
    <View style={{ flex: 1, backgroundColor: mz.bg, paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" backgroundColor={mz.bg} />
      <View style={{ flex: 1 }}>
        {!ready ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={mz.gold} size="large" />
          </View>
        ) : (
          children
        )}
      </View>
      <MzBottomNav />
    </View>
  );
}
