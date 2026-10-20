import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { normalizeImeiScan } from "./normalizeImei";
import { useMz } from "./theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (imei: string) => void;
  title?: string;
};

export function MzImeiScanner({
  visible,
  onClose,
  onScanned,
  title = "IMEI scanner",
}: Props): React.JSX.Element {
  const mz = useMz();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  const onBarcode = useCallback(
    (result: BarcodeScanningResult) => {
      if (handled.current || busy) return;
      const value = normalizeImeiScan(result.data);
      if (!value || value.length < 8) return;
      handled.current = true;
      setBusy(true);
      onScanned(value);
      setTimeout(() => {
        handled.current = false;
        setBusy(false);
        onClose();
      }, 250);
    },
    [busy, onClose, onScanned],
  );

  const corner = {
    position: "absolute" as const,
    width: 28,
    height: 28,
    borderColor: mz.accent,
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: mz.navyDeep }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingTop: 48,
            paddingBottom: 12,
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={22} color={mz.onNavy} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: mz.onNavy, fontSize: 17, fontWeight: "800" }}>{title}</Text>
            <Text style={{ color: "rgba(233,238,243,0.6)", fontSize: 12, marginTop: 2 }}>
              Align barcode / QR inside the frame
            </Text>
          </View>
          <Ionicons name="barcode-outline" size={22} color={mz.accent} />
        </View>

        {!permission?.granted ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              gap: 14,
            }}
          >
            <Ionicons name="camera-outline" size={40} color={mz.accent} />
            <Text
              style={{
                color: "rgba(233,238,243,0.75)",
                textAlign: "center",
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              Camera access needed to scan IMEI barcodes.
            </Text>
            <Pressable
              style={{
                backgroundColor: mz.accent,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 10,
              }}
              onPress={() => void requestPermission()}
            >
              <Text style={{ color: mz.onAccent, fontWeight: "800" }}>Allow camera</Text>
            </Pressable>
          </View>
        ) : Platform.OS === "web" && typeof navigator !== "undefined" && !("mediaDevices" in navigator) ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <Text
              style={{
                color: "rgba(233,238,243,0.75)",
                textAlign: "center",
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              Camera scanner needs a secure browser context. Type IMEI on the form, or use the native
              APK.
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, margin: 14, borderRadius: 16, overflow: "hidden" }}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: [
                  "qr",
                  "code128",
                  "code39",
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "itf14",
                  "codabar",
                ],
              }}
              onBarcodeScanned={busy ? undefined : onBarcode}
            />
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                marginVertical: "28%",
                marginHorizontal: "10%",
              }}
              pointerEvents="none"
            >
              <View style={{ ...corner, top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }} />
              <View style={{ ...corner, top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }} />
              <View
                style={{ ...corner, bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }}
              />
              <View
                style={{ ...corner, bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }}
              />
            </View>
            {busy ? (
              <View
                style={{
                  ...StyleSheet.absoluteFillObject,
                  backgroundColor: "rgba(7,14,24,0.55)",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <ActivityIndicator color={mz.accent} />
                <Text style={{ color: mz.onNavy, fontWeight: "700" }}>Saving scan…</Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}
