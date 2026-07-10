import type { Bill, BillPayment } from "@platform/contracts";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Muted, colors } from "./ui";
import { formatPkr } from "../lib/orderDisplay";

type Props = {
  bill: Bill;
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payments: BillPayment[]) => void;
};

export function CloseOrderModal({ bill, visible, loading, onClose, onConfirm }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <Text style={styles.title}>Close order</Text>
          <Muted>
            {bill.billRef} · {bill.tableLabel}
          </Muted>
          <Text style={styles.total}>{formatPkr(bill.total)}</Text>

          <Text style={styles.label}>Payment method</Text>
          <View style={styles.methodRow}>
            {(["cash", "card"] as const).map((method) => (
              <Pressable
                key={method}
                onPress={() => setPaymentMethod(method)}
                style={[styles.methodBtn, paymentMethod === method && styles.methodBtnActive]}
              >
                <Text
                  style={[styles.methodText, paymentMethod === method && styles.methodTextActive]}
                >
                  {method === "cash" ? "Cash" : "Card"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <View style={styles.actionHalf}>
              <Button label="Cancel" variant="ghost" onPress={onClose} disabled={loading} />
            </View>
            <View style={styles.actionHalf}>
              <Button
                label={loading ? "Closing…" : "Close & pay"}
                onPress={() =>
                  onConfirm([{ method: paymentMethod, amount: bill.total }])
                }
                loading={loading}
                disabled={loading}
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
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  total: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 4,
  },
  methodRow: {
    flexDirection: "row",
    gap: 10,
  },
  methodBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#0b1220",
    paddingVertical: 12,
    alignItems: "center",
  },
  methodBtnActive: {
    backgroundColor: colors.accent,
    borderColor: "#d97706",
  },
  methodText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  methodTextActive: {
    color: colors.accentText,
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
