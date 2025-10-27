// app/edit-envelope.js
import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";

const FREQS = ["Weekly", "Fortnightly", "Monthly"];

export default function EditEnvelopeScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { state, editEnvelope } = useBudget();

  // If id is missing, immediately go back (prevents “Envelope not found” showing in Envelopes list)
  useEffect(() => {
    if (!id) router.back();
  }, [id, router]);

  const env = useMemo(() => state.envelopes.find((e) => e.id === id), [state.envelopes, id]);

  const [targetBudgetText, setTargetBudgetText] = useState(
    env?.targetBudget != null ? String(env.targetBudget) : ""
  );
  const [targetFreq, setTargetFreq] = useState(env?.targetFreq || "Monthly");

  if (!env) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: "#fff" }}>Envelope not found.</Text>
      </View>
    );
  }

  const onSave = () => {
    const tb = Number(targetBudgetText);
    if (Number.isNaN(tb) || tb < 0) {
      Alert.alert("Invalid amount", "Please enter a number ≥ 0.");
      return;
    }
    editEnvelope(env.id, {
      targetBudget: Number(tb.toFixed(2)),
      targetFreq,
    });
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit “{env.name}”</Text>
      <Text style={styles.subtitle}>Current balance: ${env.amount.toFixed(2)}</Text>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Target Budget (optional)</Text>
        <TextInput
          value={targetBudgetText}
          onChangeText={setTargetBudgetText}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#6B7280"
          style={styles.input}
        />
        <Text style={styles.help}>
          Set to <Text style={{ fontWeight: "800", color: "#fff" }}>0</Text> to hide the progress bar.
        </Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Frequency</Text>
        <View style={styles.chipsRow}>
          {FREQS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, targetFreq === f && styles.chipActive]}
              onPress={() => setTargetFreq(f)}
            >
              <Text style={[styles.chipText, targetFreq === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "#9BA3B4", marginTop: 6, marginBottom: 16 },

  fieldBlock: { marginTop: 14 },
  label: { color: "#9BA3B4", marginBottom: 8, fontSize: 13 },
  input: {
    backgroundColor: "#151821",
    borderColor: "#23283A",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
  },
  help: { color: "#9BA3B4", marginTop: 8, fontSize: 12 },

  chipsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  chip: {
    borderColor: "#374151",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#0E0F13",
  },
  chipActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  chipText: { color: "#9BA3B4", fontWeight: "700" },
  chipTextActive: { color: "#fff" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#374151",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: { color: "#fff", fontWeight: "800" },
  saveBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "800" },
});
