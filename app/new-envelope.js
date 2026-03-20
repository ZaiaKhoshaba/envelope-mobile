// app/new-envelope.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
];

export default function NewEnvelope() {
  const router = useRouter();
  const { dispatch } = useBudget();

  const [name, setName] = useState("");
  const [startAmount, setStartAmount] = useState("");
  const [type, setType] = useState("fixed"); // "fixed" | "flexible"
  const [targetBudget, setTargetBudget] = useState("");
  const [targetFrequency, setTargetFrequency] = useState("monthly");
  const [targetDate, setTargetDate] = useState("1");
  const [rollover, setRollover] = useState(true);

  const onSave = () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter an envelope name.");
      return;
    }

    const amountNum = Number(startAmount || 0);
    if (Number.isNaN(amountNum)) {
      Alert.alert("Invalid amount", "Starting amount must be a number.");
      return;
    }

    const targetBudgetNum = Number(targetBudget || 0);
    if (Number.isNaN(targetBudgetNum)) {
      Alert.alert(
        "Invalid target",
        "Target budget must be a number (or leave blank)."
      );
      return;
    }

    const targetDateNum = Number(targetDate || 1);
    if (Number.isNaN(targetDateNum) || targetDateNum < 1 || targetDateNum > 31) {
      Alert.alert(
        "Invalid date",
        "Target date should be a day of the month between 1 and 31."
      );
      return;
    }

    const envelope = {
      id: `env_${Date.now()}`,
      name: name.trim(),
      amount: amountNum,
      type, // "fixed" or "flexible"
      rollover,

      // Planning fields for the income engine
      targetBudget: targetBudgetNum,
      targetFrequency, // "weekly" | "fortnightly" | "monthly"
      targetDate: String(targetDateNum), // store as string for existing UI
    };

    dispatch({ type: "ADD_ENVELOPE", envelope });

    Alert.alert("Envelope created", `${envelope.name} has been added.`, [
      {
        text: "OK",
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <Text style={styles.title}>New Envelope</Text>

      {/* Name */}
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Groceries, Mortgage, Savings"
        placeholderTextColor="#6B7280"
        value={name}
        onChangeText={setName}
      />

      {/* Starting amount */}
      <Text style={styles.label}>Starting Amount</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor="#6B7280"
        keyboardType="numeric"
        value={startAmount}
        onChangeText={setStartAmount}
      />

      {/* Type: Fixed vs Flexible */}
      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.chip, type === "fixed" && styles.chipSelected]}
          onPress={() => setType("fixed")}
        >
          <Text
            style={[
              styles.chipText,
              type === "fixed" && styles.chipTextSelected,
            ]}
          >
            Fixed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, type === "flexible" && styles.chipSelected]}
          onPress={() => setType("flexible")}
        >
          <Text
            style={[
              styles.chipText,
              type === "flexible" && styles.chipTextSelected,
            ]}
          >
            Flexible
          </Text>
        </TouchableOpacity>
      </View>

      {/* Target budget */}
      <Text style={styles.label}>Target Budget (per period)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 1500"
        placeholderTextColor="#6B7280"
        keyboardType="numeric"
        value={targetBudget}
        onChangeText={setTargetBudget}
      />

      {/* Target frequency */}
      <Text style={styles.label}>Target Frequency</Text>
      <View style={styles.typeRow}>
        {FREQUENCY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.chip,
              targetFrequency === opt.value && styles.chipSelected,
            ]}
            onPress={() => setTargetFrequency(opt.value)}
          >
            <Text
              style={[
                styles.chipText,
                targetFrequency === opt.value && styles.chipTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Target date */}
      <Text style={styles.label}>Target Date (day of month)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 1, 15, 22"
        placeholderTextColor="#6B7280"
        keyboardType="numeric"
        value={targetDate}
        onChangeText={setTargetDate}
      />

      {/* Rollover */}
      <View style={styles.rowSwitch}>
        <View>
          <Text style={styles.label}>Rollover unused funds?</Text>
          <Text style={styles.subLabel}>
            If on, leftover balance carries into the next cycle.
          </Text>
        </View>
        <Switch value={rollover} onValueChange={setRollover} />
      </View>

      {/* Save button */}
      <TouchableOpacity style={styles.saveButton} onPress={onSave}>
        <Text style={styles.saveText}>Create Envelope</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
  },
  label: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 6,
  },
  subLabel: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 2,
    maxWidth: 220,
  },
  input: {
    backgroundColor: "#111827",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#111827",
  },
  chipSelected: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  chipText: {
    color: "#9CA3AF",
    fontWeight: "600",
    fontSize: 13,
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  rowSwitch: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
});
