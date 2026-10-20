import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type CaptureKind = "photo" | "cnic-front" | "cnic-back";

async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  const asked = await ImagePicker.requestCameraPermissionsAsync();
  return asked.granted;
}

async function uriToDataUrl(uri: string, mime = "image/jpeg"): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Could not read photo"));
      reader.readAsDataURL(blob);
    });
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mime};base64,${base64}`;
}

/**
 * Opens the device camera (not gallery) for party photo or CNIC sides.
 * Returns a data URL ready to persist on purchase/sale/customer records.
 */
export async function captureWithCamera(kind: CaptureKind): Promise<string | null> {
  const ok = await ensureCameraPermission();
  if (!ok) {
    throw new Error("Camera permission is required to capture photos / CNIC.");
  }

  const isCnic = kind === "cnic-front" || kind === "cnic-back";
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: isCnic ? [16, 10] : [3, 4],
    quality: 0.72,
    cameraType: isCnic ? ImagePicker.CameraType.back : ImagePicker.CameraType.front,
    exif: false,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  const asset = result.assets[0];
  return uriToDataUrl(asset.uri, asset.mimeType || "image/jpeg");
}
