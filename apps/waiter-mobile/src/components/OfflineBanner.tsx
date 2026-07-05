import { View, Text } from "react-native";
import { useConnectivityStore } from "../stores/connectivityStore";

export function OfflineBanner() {
  const online = useConnectivityStore((s) => s.online);
  if (online) return null;
  return (
    <View
      style={{
        backgroundColor: "rgba(245,158,11,0.2)",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(245,158,11,0.35)",
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: "#fde68a", fontSize: 12, textAlign: "center", fontWeight: "600" }}>
        Offline — connect to your hosted API to sync orders.
      </Text>
    </View>
  );
}
