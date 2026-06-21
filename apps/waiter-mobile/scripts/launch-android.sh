#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
export EXPO_PUBLIC_API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-http://10.0.2.2:3000}"
unset CI

AVD="${ANDROID_AVD:-quran_flutter_avd}"
EXPO_GO_VERSION="2.32.20"
EXPO_GO_APK="$HOME/.expo/android-apk-cache/Expo-Go-${EXPO_GO_VERSION}.apk"
EXPO_GO_URL="https://github.com/expo/expo-go-releases/releases/download/Expo-Go-${EXPO_GO_VERSION}/Expo-Go-${EXPO_GO_VERSION}.apk"

echo "==> Ensuring Android emulator ($AVD) is running…"
if ! adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {found=1} END{exit !found}'; then
  pkill -f "qemu-system-x86_64" 2>/dev/null || true
  pkill -f "emulator -avd" 2>/dev/null || true
  adb kill-server || true
  sleep 3
  emulator -avd "$AVD" -gpu host -no-boot-anim &
  adb wait-for-device
  for _ in $(seq 1 120); do
    boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)
    state=$(adb devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $2; exit}')
    if [ "$state" = "device" ] && [ "$boot" = "1" ]; then
      break
    fi
    sleep 2
  done
fi

adb wait-for-device
echo "==> Waiting for Android boot to finish…"
for _ in $(seq 1 120); do
  state=$(adb devices | awk 'NR>1 && $1 ~ /^emulator-/ {print $2; exit}')
  boot=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)
  if [ "$state" = "device" ] && [ "$boot" = "1" ]; then
    break
  fi
  sleep 2
done
adb devices

if [ ! -f "$EXPO_GO_APK" ]; then
  echo "==> Downloading Expo Go ${EXPO_GO_VERSION}…"
  mkdir -p "$(dirname "$EXPO_GO_APK")"
  curl -fsSL "$EXPO_GO_URL" -o "$EXPO_GO_APK"
fi

INSTALLED_EXPO_GO="$(adb shell dumpsys package host.exp.exponent 2>/dev/null | awk -F= '/versionName=/{print $2; exit}' | tr -d '\r')"
if [ "$INSTALLED_EXPO_GO" != "$EXPO_GO_VERSION" ]; then
  echo "==> Installing Expo Go ${EXPO_GO_VERSION} (was: ${INSTALLED_EXPO_GO:-not installed})…"
  adb uninstall host.exp.exponent 2>/dev/null || true
  adb install "$EXPO_GO_APK"
  sleep 2
fi

adb wait-for-device

pkill -f "expo start" 2>/dev/null || true
sleep 1

echo "==> Forwarding ports (Metro 8081, API 3000)…"
adb wait-for-device
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000

echo "==> Starting Metro…"
cd "$ROOT"
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 EXPO_NO_INTERACTIVE=1 pnpm exec expo start --localhost --clear --port 8081 &
METRO_PID=$!

PROJECT_URL="exp://127.0.0.1:8081"
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:8081/status" >/dev/null 2>&1; then
    if curl -sf "http://127.0.0.1:8081" 2>/dev/null | grep -q "POPS Waiter"; then
      break
    fi
  fi
  sleep 2
done

echo "==> Opening POPS Waiter in Expo Go (no Expo account / browser needed)…"
# Deep-link straight into the project. Do not use Expo Go’s “Log In” — that opens a browser.
adb shell am start -a android.intent.action.VIEW -d "$PROJECT_URL" host.exp.exponent >/dev/null 2>&1 || true
sleep 4
if ! adb shell dumpsys activity activities 2>/dev/null | grep -q "pops-waiter\|POPS Waiter\|index"; then
  adb shell monkey -p host.exp.exponent -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 2
  adb shell am start -a android.intent.action.VIEW -d "$PROJECT_URL" host.exp.exponent
fi

echo "    If you still see Expo Go Home: tap “Enter URL manually” and type: $PROJECT_URL"

wait "$METRO_PID"
