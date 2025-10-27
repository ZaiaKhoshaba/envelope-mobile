// app/cycle.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useBudget } from "../context/BudgetContext";

const CYCLE_OPTIONS = [
  { key: "weekly", label: "Weekly" },
  { key: "fortnightly", label: "Fortnightly" },
  { key: "monthly", label: "Monthly" },
];

export default function CycleScreen() {
  const { cycle, setCycle, endCycle } = useBudget();

  const onSelect = (c) => {
    setCycle(c);
    Alert.alert("Cycle Updated", `Cycle set to ${c}.`);
  };

  const onEndCycle = () => {
    endCycle();
    Alert.alert("Cycle Ended", "Non-rollover envelope balances returned to Unallocated.");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cycle Settings</Text>
      <Text style={styles.current}>Current cycle: <Text style={styles.currentValue}>{cycle}</Text></Text>

      <View style={{ height: 16 }} />

      {CYCLE_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.pick, cycle === opt.key && styles.pickActive]}
          onPress={() => onSelect(opt.key)}
        >
          <Text style={[styles.pickText, cycle === opt.key && styles.pickTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={{ height: 24 }} />

      <TouchableOpacity style={styles.endBtn} onPress={onEndCycle}>
        <Text style={styles.endText}>End {cycle} cycle</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Ending a cycle will move any remaining money from non-rollover envelopes back to Unallocated and reset those envelopes to $0.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  current: { color: "#9BA3B4", marginTop: 10, textAlign: "center" },
  currentValue: { color: "#4FD1C5", fontWeight: "800" },

  pick: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A2F40",
    backgroundColor: "#151821",
    marginBottom: 10,
    alignItems: "center",
  },
  pickActive: {
    borderColor: "#4FD1C5",
  },
  pickText: { color: "#E5E7EB", fontWeight: "700" },
  pickTextActive: { color: "#4FD1C5" },

  endBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  endText: { color: "#fff", fontWeight: "800", fontSize: 16 },

  hint: { color: "#9BA3B4", marginTop: 12, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
