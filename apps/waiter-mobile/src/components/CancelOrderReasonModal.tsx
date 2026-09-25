import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, Muted, colors } from "./ui";

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

const MIN_REASON_LEN = 3;

/** Strict cancel/void reason — confirm stays disabled until a real reason is typed. */
export function CancelOrderReasonModal({
  visible,
  title = "Cancel order",
  subtitle = "Reason is required before this order can be canceled.",
  confirmLabel = "Cancel order",
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason("");
    setTouched(false);
  }, [visible]);

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_REASON_LEN;
  const showError = touched && !valid;

  function submit(): void {
    setTouched(true);
    if (!valid || loading) return;
    onConfirm(trimmed);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onClose}>
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Muted>{subtitle}</Muted>

          <Text style={styles.label}>
            Reason <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            onBlur={() => setTouched(true)}
            editable={!loading}
            multiline
            maxLength={300}
            placeholder="e.g. Customer left, wrong table, duplicate order…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus
          />
          <View style={styles.metaRow}>
            {showError ? (
              <Text style={styles.error}>Enter at least {MIN_REASON_LEN} characters.</Text>
            ) : (
              <Muted>Required — min {MIN_REASON_LEN} characters</Muted>
            )}
            <Muted>
              {trimmed.length}/300
            </Muted>
          </View>

          <View style={styles.actions}>
            <View style={styles.actionHalf}>
              <Button label="Back" variant="ghost" onPress={onClose} disabled={loading} />
            </View>
            <View style={styles.actionHalf}>
              <Button
                label={loading ? "Canceling…" : confirmLabel}
                onPress={submit}
                loading={loading}
                disabled={!valid || loading}
              />
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 4,
  },
  required: {
    color: "#f87171",
  },
  input: {
    minHeight: 88,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: "top",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  error: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  actionHalf: {
    flex: 1,
  },
});
