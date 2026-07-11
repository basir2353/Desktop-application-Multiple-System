import { useMutation } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { setOwnPin } from "../src/api/auth";
import { Button, Card, Notice, PinPad, Screen, Subtitle, Title } from "../src/components/ui";
import { useSessionStore } from "../src/stores/sessionStore";

type Step = "new" | "confirm";

export default function ManagePinScreen() {
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const [step, setStep] = useState<Step>("new");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "warning" } | null>(null);

  if (!accessToken) {
    return <Redirect href="/" />;
  }

  function resetForm(): void {
    setStep("new");
    setNewPin("");
    setConfirmPin("");
  }

  const saveMutation = useMutation({
    mutationFn: (pin: string) => setOwnPin(pin),
    onSuccess: () => {
      resetForm();
      setNotice({ text: "PIN saved. Use it next time from Login with PIN.", tone: "success" });
    },
    onError: (err: Error) => setNotice({ text: err.message, tone: "warning" }),
  });

  const removeMutation = useMutation({
    mutationFn: () => setOwnPin(null),
    onSuccess: () => {
      resetForm();
      setNotice({ text: "PIN removed. Sign in with email & password until you set a new one.", tone: "success" });
    },
    onError: (err: Error) => setNotice({ text: err.message, tone: "warning" }),
  });

  const busy = saveMutation.isPending || removeMutation.isPending;

  function handleContinue(): void {
    setNotice(null);
    setStep("confirm");
  }

  function handleConfirm(): void {
    if (confirmPin !== newPin) {
      setNotice({ text: "PINs didn't match. Enter your new PIN again." , tone: "warning" });
      resetForm();
      return;
    }
    setNotice(null);
    saveMutation.mutate(confirmPin);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        <Card>
          <Title>Manage your PIN</Title>
          <Subtitle>
            Set a 4-digit PIN so you can sign in with Login with PIN instead of email &amp; password.
          </Subtitle>

          {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

          <View style={{ gap: 14, marginTop: 12 }}>
            <Subtitle>
              {step === "new" ? "Enter a new 4-digit PIN" : "Confirm your new PIN"}
            </Subtitle>
            <PinPad
              value={step === "new" ? newPin : confirmPin}
              onChange={step === "new" ? setNewPin : setConfirmPin}
              disabled={busy}
            />
            {step === "new" ? (
              <Button
                label="Continue"
                onPress={handleContinue}
                disabled={newPin.length !== 4}
              />
            ) : (
              <View style={{ gap: 10 }}>
                <Button
                  label={saveMutation.isPending ? "Saving…" : "Save PIN"}
                  onPress={handleConfirm}
                  loading={saveMutation.isPending}
                  disabled={confirmPin.length !== 4 || busy}
                />
                <Button label="Back" variant="ghost" onPress={resetForm} disabled={busy} />
              </View>
            )}
          </View>
        </Card>

        <Card>
          <Title>Remove PIN</Title>
          <Subtitle>Turns off PIN login for your account. You can set a new PIN anytime.</Subtitle>
          <View style={{ marginTop: 12 }}>
            <Button
              label={removeMutation.isPending ? "Removing…" : "Remove my PIN"}
              variant="danger"
              onPress={() => removeMutation.mutate()}
              loading={removeMutation.isPending}
              disabled={busy}
            />
          </View>
        </Card>

        <Button label="Done" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
