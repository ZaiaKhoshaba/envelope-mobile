// app/add-income.js
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useBudget } from "../context/BudgetContext";

export default function AddIncomeScreen() {
  const router = useRouter();
  const { addIncome, state } = useBudget();

  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");

  const onSubmit = () => {
    const amount = Number(amountText.replace(/[^0-9.]/g, ""));
    if (!amount || amount <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount greater than 0.");
      return;
    }
    addIncome(amount, note);

    Alert.alert(
      "Income added",
      `+$${amount.toFixed(2)} added to Unallocated.\nUnallocated total: $${(state.unallocated + amount).toFixed(2)}.\nAllocate now?`,
      [
        { text: "Later", style: "cancel", onPress: () => router.back() },
        { text: "Allocate", onPress: () => router.push("/envelopes") }
      ]
    );
    setAmountText("");
    setNote("");
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={{ flex: 1 }}>
      <View style={styles.container}>
        <Text style={styles.title}>Add Income</Text>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="$0.00"
          style={styles.input}
        />

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g., Salary, Refund"
          style={styles.input}
        />

        <TouchableOpacity style={styles.button} onPress={onSubmit}>
          <Text style={styles.buttonText}>Add to Unallocated</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={() => router.back()}>
          <Text style={[styles.buttonText, styles.secondaryText]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  label: { fontSize: 14, color: "#475569", marginTop: 6 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 16, backgroundColor: "#fff" },
  button: { backgroundColor: "#007AFF", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { backgroundColor: "#e2e8f0" },
  secondaryText: { color: "#0f172a" }
});
