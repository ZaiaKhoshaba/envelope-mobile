// app/new-envelope.js
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useBudget, TARGET_FREQS } from "../context/BudgetContext";

export default function NewEnvelope() {
  const router = useRouter();
  const { addEnvelope } = useBudget();

  const [name, setName] = useState("");
  const [initial, setInitial] = useState(""); // optional starting amount
  const [type, setType] = useState("flexible"); // 'flexible' | 'fixed'
  const [rollover, setRollover] = useState(true);
  const [target, setTarget] = useState(""); // optional
  const [freq, setFreq] = useState("monthly");
  const [targetDate, setTargetDate] = useState(""); // YYYY-MM-DD (optional)

  const onSave = () => {
    if (!name.trim()) {
      Alert.alert("Add Envelope", "Please enter a name.");
      return;
    }

    // Validate date format if provided
    let targetISO = null;
    if (targetDate.trim()) {
      const d = new Date(targetDate.trim());
      if (Number.isNaN(d.getTime())) {
        Alert.alert("Target Date", "Please enter a valid date in YYYY-MM-DD format.");
        return;
      }
      targetISO = d.toISOString();
    }

    addEnvelope(
      name.trim(),
      Number(initial) || 0,
      type,
      rollover,
      Number(target) || 0,
      freq,
      targetISO
    );

    Alert.alert("Envelope", "Envelope created.");
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Envelope</Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Groceries"
        placeholderTextColor="#6B7280"
      />

      <Text style={styles.label}>Start Amount (optional)</Text>
      <TextInput
        style={styles.input}
        value={initial}
        onChangeText={setInitial}
        keyboardType="decimal-pad"
        placeholder="e.g. 100"
        placeholderTextColor="#6B7280"
      />

      <Text style={styles.label}>Type</Text>
      <Row>
        <Chip active={type === "flexible"} onPress={() => setType("flexible")}>
          Flexible
        </Chip>
        <Chip active={type === "fixed"} onPress={() => setType("fixed")}>
          Fixed
        </Chip>
      </Row>

      <Text style={styles.label}>Rollover</Text>
      <Row>
        <Chip active={rollover === true} onPress={() => setRollover(true)}>
          On
        </Chip>
        <Chip active={rollover === false} onPress={() => setRollover(false)}>
          Off
        </Chip>
      </Row>

      <Text style={styles.label}>Target Budget (optional)</Text>
      <TextInput
        style={styles.input}
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        placeholder="e.g. 400"
        placeholderTextColor="#6B7280"
      />

      <Text style={styles.label}>Target Frequency</Text>
      <Row>
        {TARGET_FREQS.map((f) => (
          <Chip key={f} active={freq === f} onPress={() => setFreq(f)}>
            {f}
          </Chip>
        ))}
      </Row>

      <Text style={styles.label}>Target Date (YYYY-MM-DD) — optional</Text>
      <TextInput
        style={styles.input}
        value={targetDate}
        onChangeText={setTargetDate}
        placeholder="e.g. 2025-06-20"
        placeholderTextColor="#6B7280"
      />

      <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
        <Text style={styles.saveText}>Create Envelope</Text>
      </TouchableOpacity>
    </View>
  );
}

/* Helpers */
function Row({ children }) {
  return <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>{children}</View>;
}

function Chip({ active, children, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
        },
        active
          ? { backgroundColor: "rgba(37,99,235,0.15)", borderColor: "#2563EB" }
          : { backgroundColor: "#151821", borderColor: "#23283A" },
      ]}
    >
      <Text style={{ color: "#fff", fontWeight: "700", textTransform: "capitalize" }}>{children}</Text>
    </TouchableOpacity>
  );
}

/* Styles */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 14 },
  label: { color: "#9BA3B4", fontSize: 12, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: "#151821",
    color: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#23283A",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  saveText: { color: "#fff", fontWeight: "800" },
});
