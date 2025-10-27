// envelope-mobile/app/bank.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { bankListNew, bankMarkImported, bankGenerate } from "../lib/api";
import { useBudget } from "../context/BudgetContext";

export default function BankScreen() {
  const { startPendingSpend, state } = useBudget();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]); // bank transactions not yet imported

  const refresh = async () => {
    try {
      setLoading(true);
      const data = await bankListNew();
      setItems(data.transactions || []);
    } catch (e) {
      Alert.alert("Bank", "Failed to fetch transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onGenerate = async () => {
    try {
      await bankGenerate();
      await refresh();
    } catch (e) {
      Alert.alert("Bank", "Failed to generate a mock transaction.");
    }
  };

  const onImport = async (tx) => {
    // Avoid duplicates in app state: if we already have this id in the ledger, just mark imported and refresh
    const exists = state.transactions.some(t => t.id === tx.id);
    if (!exists) {
      // Start the live chooser with the bank tx id so it updates in-place
      startPendingSpend(tx.amount, tx.merchant || "Unknown", tx.id);
    }
    // Mark it imported on backend so it won't show again
    try {
      await bankMarkImported(tx.id);
    } catch {
      // non-fatal for UI
    }
    await refresh();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bank (Mock)</Text>

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={refresh} disabled={loading}>
          <Text style={styles.btnText}>{loading ? "Refreshing..." : "Pull New"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onGenerate}>
          <Text style={styles.btnText}>Generate Mock</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {items.length === 0 ? (
          <Text style={styles.empty}>No new bank transactions.</Text>
        ) : (
          items.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.rowTop}>
                <Text style={styles.merchant}>{t.merchant || "Unknown"}</Text>
                <Text style={styles.amount}>-${Number(t.amount).toFixed(2)}</Text>
              </View>
              <View style={{ marginTop: 8, flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={styles.blueBtn} onPress={() => onImport(t)}>
                  <Text style={styles.blueBtnText}>Import & Allocate</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E0F13", padding: 16 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 14 },
  row: { flexDirection: "row", gap: 10, marginBottom: 12 },
  btn: { flex: 1, backgroundColor: "#2A2F40", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800" },
  empty: { color: "#9BA3B4", textAlign: "center", marginTop: 20 },
  card: {
    backgroundColor: "#151821",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#23283A",
    marginBottom: 10,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  merchant: { color: "#fff", fontWeight: "700", fontSize: 16 },
  amount: { color: "#fca5a5", fontWeight: "800", fontSize: 16 },
  blueBtn: { backgroundColor: "#2563EB", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  blueBtnText: { color: "#fff", fontWeight: "800" },
});
