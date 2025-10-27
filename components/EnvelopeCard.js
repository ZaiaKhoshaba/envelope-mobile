import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme/tokens";

export default function EnvelopeCard({ env, onAllocate, onEdit, onDelete }) {
  const [val, setVal] = useState("");

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View>
          <Text style={styles.meta}>{env.type.toUpperCase()}</Text>
          <Text style={styles.name}>{env.name}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.meta}>Allocated</Text>
          <Text style={styles.amount}>${env.amount.toFixed(2)}</Text>
        </View>
      </View>

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="Allocate $"
        placeholderTextColor={colors.muted}
        value={val}
        onChangeText={setVal}
      />

      <View style={styles.actions}>
        <Pressable
          style={styles.btn}
          onPress={() => { const n = Number(val); if (!isNaN(n)) onAllocate(n); }}
        >
          <Text style={styles.btnText}>Add</Text>
        </Pressable>
        <Pressable style={styles.btnSecondary} onPress={onEdit}>
          <Text style={styles.btnSecondaryText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={onDelete}>
          <Text style={styles.btnGhostText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { color: colors.muted, fontSize: 12 },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  amount: { color: colors.text, fontSize: 18, fontWeight: "800" },
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  btn: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
  btnText: { color: colors.onPrimary, fontWeight: "700" },
  btnSecondary: { backgroundColor: colors.secondary, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth:1, borderColor:colors.border },
  btnSecondaryText: { color: colors.onSecondary, fontWeight: "700" },
  btnGhost: { backgroundColor: "transparent", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth:1, borderColor:colors.border },
  btnGhostText: { color: colors.text, fontWeight: "700" },
});
