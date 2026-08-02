import { menuItemDisplayPrice, type MenuItem, type MenuItemVariant } from "@platform/contracts";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatPkr } from "../lib/orderDisplay";
import { colors } from "./ui";

type Props = {
  item: MenuItem;
  variants: MenuItemVariant[];
  onSelect: (variant: MenuItemVariant) => void;
  onClose: () => void;
};

export function DishVariantModal({ item, variants, onSelect, onClose }: Props): JSX.Element {
  const fromPrice = menuItemDisplayPrice(item);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle}>Choose size · Small / Medium / Large / Half / Full</Text>
          {variants.length > 1 ? (
            <Text style={styles.fromPrice}>From {formatPkr(fromPrice)}</Text>
          ) : null}
          <ScrollView style={styles.list}>
            {variants.map((variant) => (
              <Pressable
                key={variant.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => onSelect(variant)}
              >
                <Text style={styles.rowLabel}>{variant.label}</Text>
                <Text style={styles.rowPrice}>{formatPkr(variant.price)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: "80%",
    padding: 16,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
  },
  fromPrice: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 11,
  },
  list: {
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: colors.bg,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  rowPrice: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  closeBtn: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 10,
  },
  closeText: {
    color: colors.muted,
    fontSize: 14,
  },
});
