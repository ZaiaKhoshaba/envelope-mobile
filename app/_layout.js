// app/_layout.js
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { BudgetProvider, useBudget } from "../context/BudgetContext";

// --- Spend Chooser Modal (pop-up when a spend occurs) ---
function SpendChooserModal() {
  const { state, commitSpendPart, cancelSpend, unallocated } = useBudget();
  const ps = state.pendingSpend;

  if (!ps) return null;

  const envs = [...state.envelopes].sort((a, b) => b.amount - a.amount);

  const handleSelect = (sourceId, available) => {
    const remainingBefore = ps.remaining;
    commitSpendPart(sourceId);

    // If that source wasn’t enough, prompt again
    if (available < remainingBefore) {
      const still = Number((remainingBefore - available).toFixed(2));
      if (still > 0) {
        Alert.alert(
          "Shortfall",
          `That source only covered $${(remainingBefore - still).toFixed(
            2
          )}.\nYou still need $${still.toFixed(2)}. Choose another source.`,
          [{ text: "OK" }]
        );
      }
    }
  };

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Choose envelope to cover</Text>
          <Text style={styles.subtitle}>
            {ps.merchant} — Remaining:{" "}
            <Text style={styles.remain}>${ps.remaining.toFixed(2)}</Text>
          </Text>

          <ScrollView style={{ maxHeight: 360, marginTop: 10 }}>
            {/* Unallocated first */}
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleSelect("unallocated", unallocated)}
            >
              <View>
                <Text style={styles.envName}>Unallocated</Text>
                <Text style={styles.envMeta}>
                  Available: ${unallocated.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.pick}>Use</Text>
            </TouchableOpacity>

            {/* All envelopes */}
            {envs.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.row}
                onPress={() => handleSelect(e.id, e.amount)}
              >
                <View>
                  <Text style={styles.envName}>{e.name}</Text>
                  <Text style={styles.envMeta}>
                    ${e.amount.toFixed(2)} • {e.type}/
                    {e.rollover ? "rollover" : "no-rollover"}
                  </Text>
                </View>
                <Text style={styles.pick}>Use</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ height: 12 }} />
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelSpend}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// --- Root layout wrapped with provider ---
export default function Layout() {
  return (
    <BudgetProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0E0F13" },
          headerTintColor: "#fff",
        }}
      />
      {/* Modal lives here so it can appear on top of all screens */}
      <SpendChooserModal />
    </BudgetProvider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
    justifyContent: "center",
  },
  sheet: {
    backgroundColor: "#151821",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#23283A",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#9BA3B4", marginTop: 6 },
  remain: { color: "#4FD1C5", fontWeight: "800" },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#23283A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  envName: { color: "#fff", fontWeight: "700", fontSize: 15 },
  envMeta: { color: "#9BA3B4", marginTop: 2, fontSize: 12 },
  pick: { color: "#4FD1C5", fontWeight: "800" },
  cancelBtn: {
    backgroundColor: "#2A2F40",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { color: "#fff", fontWeight: "700" },
});
