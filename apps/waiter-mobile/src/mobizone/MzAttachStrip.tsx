import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { maybeUploadToGoogleDrive } from "./googleDrive";
import { captureWithCamera, type CaptureKind } from "./mediaCapture";
import { useMz } from "./theme";

export type AttachBundle = {
  photoDataUrl: string | null;
  cnicFrontDataUrl: string | null;
  cnicBackDataUrl: string | null;
};

type Props = {
  value: AttachBundle;
  onChange: (next: AttachBundle) => void;
  photoLabel?: string;
};

type Slot = {
  key: keyof AttachBundle;
  kind: CaptureKind;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint: string;
};

const SLOTS: Slot[] = [
  {
    key: "photoDataUrl",
    kind: "photo",
    label: "Face photo",
    icon: "person-circle-outline",
    hint: "Front camera",
  },
  {
    key: "cnicFrontDataUrl",
    kind: "cnic-front",
    label: "CNIC front",
    icon: "card-outline",
    hint: "ID camera",
  },
  {
    key: "cnicBackDataUrl",
    kind: "cnic-back",
    label: "CNIC back",
    icon: "card-outline",
    hint: "ID camera",
  },
];

export function MzAttachStrip({
  value,
  onChange,
  photoLabel = "Face photo",
}: Props): React.JSX.Element {
  const mz = useMz();
  const [busy, setBusy] = useState<CaptureKind | null>(null);

  async function capture(slot: Slot): Promise<void> {
    setBusy(slot.kind);
    try {
      const dataUrl = await captureWithCamera(slot.kind);
      if (!dataUrl) return;
      const stored = await maybeUploadToGoogleDrive(
        dataUrl,
        `${slot.kind}-${Date.now()}.jpg`,
      );
      onChange({ ...value, [slot.key]: stored });
    } catch (err) {
      Alert.alert("Camera", err instanceof Error ? err.message : "Could not open camera");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: mz.muted,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        Photos · camera
      </Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {SLOTS.map((slot) => {
          const uri = value[slot.key];
          const label = slot.key === "photoDataUrl" ? photoLabel : slot.label;
          const loading = busy === slot.kind;
          return (
            <Pressable
              key={slot.key}
              onPress={() => void capture(slot)}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                backgroundColor: mz.cardSoft,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: mz.border,
                padding: 6,
                alignItems: "center",
                gap: 3,
                minHeight: 96,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{
                    width: "100%",
                    aspectRatio: 1.15,
                    borderRadius: 8,
                    backgroundColor: mz.navy,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 1.15,
                    borderRadius: 8,
                    backgroundColor: mz.inputBg,
                    borderWidth: 1,
                    borderColor: mz.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color={mz.accent} />
                  ) : (
                    <Ionicons name={slot.icon} size={20} color={mz.accent} />
                  )}
                </View>
              )}
              <Text
                style={{ color: mz.ink, fontSize: 10, fontWeight: "800" }}
                numberOfLines={1}
              >
                {uri ? `${label} ✓` : label}
              </Text>
              <Text style={{ color: mz.muted, fontSize: 9, fontWeight: "600" }}>{slot.hint}</Text>
              {uri ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => onChange({ ...value, [slot.key]: null })}
                  style={{ position: "absolute", top: 2, right: 2 }}
                >
                  <Ionicons name="close-circle" size={15} color={mz.rose} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
